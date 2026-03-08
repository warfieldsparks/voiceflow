import { app, ipcMain } from 'electron';
import { createTray, updateTrayState, destroyTray } from './tray';
import { registerHotkey, unregisterAll } from './globalHotkey';
import { registerIpcHandlers, broadcastToRenderers } from './ipc-handlers';
import {
  createOverlayWindow,
  createSettingsWindow,
  showOverlay,
  hideOverlay,
  getOverlayWindow,
  destroyAllWindows,
  waitForOverlayReady,
} from './window-manager';
import { initSettingsStore, getSetting } from './services/settings/SettingsStore';
import { transcribe } from './services/transcription/TranscriptionService';
import { CommandParser } from './services/commands/CommandParser';
import { ActionExecutor } from './services/keyboard/ActionExecutor';
import type {
  AudioData,
  HotkeyMode,
  RecordingCaptureFailedPayload,
  RecordingCaptureStartedPayload,
  RecordingControlPayload,
  RecordingNoAudioPayload,
  RecordingState,
  RecordingStatus,
} from '../shared/types';
import { IPC } from '../shared/constants';
import { createLogger, initLogging, installProcessErrorLogging } from './utils/logger';

const log = createLogger('main');

// ── State ──
let recordingState: RecordingState = 'idle';
let commandParser: CommandParser;
let actionExecutor: ActionExecutor;

let sessionCounter = 0;
let activeSessionId: number | null = null;

let pipelineGeneration = 0;
let activePipelineAbort: AbortController | null = null;

let captureStartTimer: ReturnType<typeof setTimeout> | null = null;
let audioDeliveryTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

const WATCHDOG_TIMEOUT_MS = 45_000;
const CAPTURE_START_TIMEOUT_MS = 15_000;
const AUDIO_DELIVERY_TIMEOUT_MS = 8_000;
const TRANSCRIPTION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 10_000;

installProcessErrorLogging();

// ── Single Instance Lock ──
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn('Another instance is running — quitting');
  app.quit();
}

app.on('second-instance', () => {
  log.info('Second instance requested — focusing settings window');
  createSettingsWindow();
});

// ── Helpers ──

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function getRecordingStatus(): RecordingStatus {
  return {
    state: recordingState,
    sessionId: activeSessionId,
  };
}

function getTrayCallbacks() {
  return {
    onToggleRecording: toggleRecording,
    onAbortSession: abortCurrentSession,
    onShowSettings: () => createSettingsWindow(),
    onQuit: () => app.quit(),
  };
}

function clearCaptureStartTimer(): void {
  if (captureStartTimer) {
    clearTimeout(captureStartTimer);
    captureStartTimer = null;
  }
}

function clearAudioDeliveryTimer(): void {
  if (audioDeliveryTimer) {
    clearTimeout(audioDeliveryTimer);
    audioDeliveryTimer = null;
  }
}

function clearWatchdog(): void {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

function clearSessionTimers(): void {
  clearCaptureStartTimer();
  clearAudioDeliveryTimer();
  clearWatchdog();
}

function sendOverlayMessage(channel: string, payload?: unknown): void {
  const overlay = getOverlayWindow();
  if (!overlay) return;

  try {
    overlay.webContents.send(channel, payload);
  } catch (err) {
    log.warn(`Failed to send overlay message "${channel}"`, err);
  }
}

function startWatchdog(): void {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    if (recordingState === 'processing') {
      log.error('Watchdog: stuck in processing state — force-resetting', {
        sessionId: activeSessionId,
        timeoutMs: WATCHDOG_TIMEOUT_MS,
      });
      forceResetPipeline('processing watchdog timeout', {
        message: 'Processing timed out — please try again',
      });
    }
  }, WATCHDOG_TIMEOUT_MS);
}

function armCaptureStartTimeout(sessionId: number): void {
  clearCaptureStartTimer();
  captureStartTimer = setTimeout(() => {
    if (recordingState === 'recording' && activeSessionId === sessionId) {
      log.error('Timed out waiting for renderer to arm the microphone', {
        sessionId,
        timeoutMs: CAPTURE_START_TIMEOUT_MS,
      });
      forceResetPipeline('capture start timeout', {
        message: 'Microphone did not start in time. Check permissions and try again.',
      });
    }
  }, CAPTURE_START_TIMEOUT_MS);
}

function armAudioDeliveryTimeout(sessionId: number): void {
  clearAudioDeliveryTimer();
  audioDeliveryTimer = setTimeout(() => {
    if (recordingState === 'processing' && activeSessionId === sessionId) {
      log.error('Timed out waiting for audio from renderer after stop', {
        sessionId,
        timeoutMs: AUDIO_DELIVERY_TIMEOUT_MS,
      });
      forceResetPipeline('audio delivery timeout', {
        message: 'Recording stopped but no audio arrived. Please try again.',
      });
    }
  }, AUDIO_DELIVERY_TIMEOUT_MS);
}

function setRecordingState(state: RecordingState, reason = 'state update'): void {
  const previousState = recordingState;
  recordingState = state;

  log.info(`Recording state ${previousState} -> ${state}`, {
    reason,
    sessionId: activeSessionId,
  });

  broadcastToRenderers(IPC.RECORDING_STATE, state);
  sendOverlayMessage(IPC.RECORDING_STATE, state);
  updateTrayState(state, getTrayCallbacks());

  if (state === 'processing') {
    startWatchdog();
  } else {
    clearWatchdog();
  }
}

function forceResetPipeline(
  reason: string,
  options?: {
    message?: string;
    notifyRenderer?: boolean;
  }
): void {
  const sessionId = activeSessionId;

  log.warn('Force-resetting active session', {
    reason,
    sessionId,
    state: recordingState,
  });

  pipelineGeneration++;

  if (activePipelineAbort) {
    activePipelineAbort.abort();
    activePipelineAbort = null;
  }

  clearSessionTimers();

  if (options?.notifyRenderer !== false && sessionId !== null) {
    const payload: RecordingControlPayload = { sessionId, reason };
    sendOverlayMessage(IPC.RECORDING_ABORT, payload);
  }

  activeSessionId = null;
  hideOverlay();
  setRecordingState('idle', reason);

  if (options?.message) {
    broadcastToRenderers(IPC.TRANSCRIPTION_ERROR, options.message);
  }
}

function abortCurrentSession(): void {
  forceResetPipeline('aborted by user', { notifyRenderer: true });
}

// ── App Lifecycle ──

app.on('ready', async () => {
  const logFile = initLogging();
  log.info('VoiceFlow starting...', {
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
    logFile,
  });

  initSettingsStore();

  const commandSettings = getSetting('commands');
  commandParser = new CommandParser(undefined, {
    detectionMode: commandSettings.detectionMode,
    prefixWord: commandSettings.prefixWord,
    literalEscape: commandSettings.literalEscape,
  });

  const typingSettings = getSetting('typing');
  actionExecutor = new ActionExecutor(typingSettings.speed);

  for (const cmd of commandSettings.customCommands) {
    commandParser.getRegistry().register(cmd);
  }

  registerIpcHandlers();
  createOverlayWindow();

  const uiSettings = getSetting('ui');
  if (!uiSettings.startMinimized) {
    createSettingsWindow();
  }

  createTray(getTrayCallbacks());

  const hotkey = getSetting('hotkey');
  const hotkeyMode = (getSetting('hotkeyMode') as HotkeyMode) || 'hold';
  const registerOk = registerHotkey(hotkey, toggleRecording, {
    mode: hotkeyMode,
    onStart: () => {
      void startRecording();
    },
    onStop: stopRecording,
  });

  if (!registerOk) {
    log.warn(`Hotkey "${hotkey}" not recognized, falling back to Ctrl+Shift+Space`);
    registerHotkey('Ctrl+Shift+Space', toggleRecording, {
      mode: hotkeyMode,
      onStart: () => {
        void startRecording();
      },
      onStop: stopRecording,
    });
  }

  log.info('VoiceFlow ready');
});

app.on('will-quit', () => {
  forceResetPipeline('app quitting', { notifyRenderer: true });
  unregisterAll();
  destroyTray();
  destroyAllWindows();
});

app.on('window-all-closed', () => {
  // Stay resident in the tray.
});

// ── Recording Flow ──

function toggleRecording(): void {
  log.debug('Toggle recording requested', getRecordingStatus());

  if (recordingState === 'idle') {
    void startRecording();
    return;
  }

  if (recordingState === 'recording') {
    stopRecording();
    return;
  }

  forceResetPipeline('cancelled via hotkey while processing', { notifyRenderer: true });
}

async function startRecording(): Promise<void> {
  if (recordingState !== 'idle') {
    log.warn('Ignoring start request because recorder is not idle', getRecordingStatus());
    return;
  }

  const sessionId = ++sessionCounter;
  activeSessionId = sessionId;

  log.info('Recording requested', { sessionId });
  setRecordingState('recording', 'recording requested');
  showOverlay();
  armCaptureStartTimeout(sessionId);

  await waitForOverlayReady();

  const currentStatus = getRecordingStatus();
  if (currentStatus.sessionId !== sessionId || currentStatus.state !== 'recording') {
    log.info('Start request became stale before overlay was ready', {
      sessionId,
      activeSessionId: currentStatus.sessionId,
      state: currentStatus.state,
    });
    return;
  }

  const payload: RecordingControlPayload = { sessionId };
  sendOverlayMessage(IPC.RECORDING_START, payload);
}

function stopRecording(): void {
  if (recordingState !== 'recording' || activeSessionId === null) {
    log.warn('Ignoring stop request because recorder is not actively recording', getRecordingStatus());
    return;
  }

  const sessionId = activeSessionId;
  log.info('Recording stop requested', { sessionId });

  clearCaptureStartTimer();
  setRecordingState('processing', 'waiting for renderer audio');
  armAudioDeliveryTimeout(sessionId);

  const payload: RecordingControlPayload = { sessionId };
  sendOverlayMessage(IPC.RECORDING_STOP, payload);
}

// Allow renderer to pull current recording state (belt-and-suspenders sync)
ipcMain.handle(IPC.RECORDING_GET_STATE, () => getRecordingStatus());

ipcMain.on(IPC.TRANSCRIPTION_CANCEL, () => {
  log.info('Pipeline cancelled by renderer', getRecordingStatus());
  forceResetPipeline('cancelled by renderer', { notifyRenderer: true });
});

ipcMain.on(IPC.RECORDING_CAPTURE_STARTED, (_event, payload: RecordingCaptureStartedPayload) => {
  if (payload.sessionId !== activeSessionId || recordingState !== 'recording') {
    log.warn('Ignoring capture-start from stale session', {
      payload,
      activeSessionId,
      state: recordingState,
    });
    return;
  }

  clearCaptureStartTimer();
  log.info('Renderer armed microphone capture', payload);
});

ipcMain.on(IPC.RECORDING_CAPTURE_FAILED, (_event, payload: RecordingCaptureFailedPayload) => {
  log.error('Renderer failed to start microphone capture', payload);

  if (payload.sessionId !== activeSessionId) {
    log.warn('Capture failure belongs to a stale session — ignoring', {
      payload,
      activeSessionId,
    });
    return;
  }

  forceResetPipeline('capture start failed', {
    message: payload.message,
    notifyRenderer: true,
  });
});

ipcMain.on(IPC.RECORDING_NO_AUDIO, (_event, payload: RecordingNoAudioPayload) => {
  log.warn('Renderer reported that no usable audio was captured', payload);

  if (payload.sessionId !== activeSessionId) {
    log.info('No-audio report belongs to a stale session — ignoring', {
      payload,
      activeSessionId,
    });
    return;
  }

  forceResetPipeline('no audio captured', {
    message: payload.reason,
    notifyRenderer: true,
  });
});

ipcMain.on(IPC.AUDIO_DATA, async (_event, payload: AudioData) => {
  const sessionId = payload.sessionId;
  const format = payload.format || 'wav';

  log.info('Audio payload received from renderer', {
    sessionId,
    bytes: payload.buffer.byteLength,
    durationSec: payload.duration,
    state: recordingState,
    activeSessionId,
  });

  if (sessionId !== activeSessionId) {
    log.warn('Discarding audio from stale session', {
      sessionId,
      activeSessionId,
      state: recordingState,
    });
    return;
  }

  if (recordingState !== 'processing') {
    log.warn('Discarding audio because recorder is not waiting for audio', {
      sessionId,
      state: recordingState,
    });
    return;
  }

  clearAudioDeliveryTimer();

  const pipelineId = ++pipelineGeneration;
  if (activePipelineAbort) {
    activePipelineAbort.abort();
  }

  const abortController = new AbortController();
  activePipelineAbort = abortController;

  const isStale = (): boolean => (
    pipelineId !== pipelineGeneration || activeSessionId !== sessionId
  );

  try {
    const result = await withTimeout(
      transcribe(payload.buffer, format, abortController.signal),
      TRANSCRIPTION_TIMEOUT_MS,
      'Transcription'
    );

    if (isStale()) {
      log.info('Discarding transcription result from superseded pipeline', {
        sessionId,
        pipelineId,
        activeSessionId,
        pipelineGeneration,
      });
      return;
    }

    if (result.text.trim()) {
      const parsed = commandParser.parse(result.text);
      log.info('Parsed transcription result', {
        sessionId,
        pipelineId,
        segmentCount: parsed.segments.length,
        text: result.text,
      });

      broadcastToRenderers(IPC.TRANSCRIPTION_RESULT, result.text);
      hideOverlay();

      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isStale()) return;

      await withTimeout(
        actionExecutor.execute(parsed),
        ACTION_TIMEOUT_MS,
        'Action execution'
      );

      if (isStale()) return;
      broadcastToRenderers(IPC.COMMAND_EXECUTED, parsed.segments);
    } else {
      log.info('Transcription returned empty text', { sessionId, pipelineId });
      hideOverlay();
    }
  } catch (err) {
    if (isStale()) {
      log.info('Suppressing pipeline error from stale session', {
        sessionId,
        pipelineId,
        error: err,
      });
      return;
    }

    log.error('Pipeline error', {
      sessionId,
      pipelineId,
      error: err,
    });
    broadcastToRenderers(IPC.TRANSCRIPTION_ERROR, (err as Error).message);
    hideOverlay();
  } finally {
    if (activePipelineAbort === abortController) {
      activePipelineAbort = null;
    }

    if (!isStale()) {
      activeSessionId = null;
      setRecordingState('idle', 'pipeline complete');
    }
  }
});
