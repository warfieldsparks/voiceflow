import { app, BrowserWindow } from 'electron';
import { createTray, updateTrayState, destroyTray } from './tray';
import { registerHotkey, unregisterAll, updateHotkeyMode } from './globalHotkey';
import { registerIpcHandlers, broadcastToRenderers } from './ipc-handlers';
import {
  createOverlayWindow,
  createSettingsWindow,
  showOverlay,
  hideOverlay,
  getOverlayWindow,
  destroyAllWindows,
} from './window-manager';
import { initSettingsStore, getSetting } from './services/settings/SettingsStore';
import { transcribe } from './services/transcription/TranscriptionService';
import { shutdownWhisperServer } from './services/transcription/WhisperLocalProvider';
import { CommandParser } from './services/commands/CommandParser';
import { ActionExecutor } from './services/keyboard/ActionExecutor';
import { RecordingState, HotkeyMode } from '../shared/types';
import { IPC } from '../shared/constants';
import { createLogger } from './utils/logger';

const log = createLogger('main');

// ── State ──
let recordingState: RecordingState = 'idle';
let commandParser: CommandParser;
let actionExecutor: ActionExecutor;

// ── Single Instance Lock ──
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn('Another instance is running — quitting');
  app.quit();
}

app.on('second-instance', () => {
  // Show/focus the settings window — create one if it was closed
  createSettingsWindow();
});

// ── App Lifecycle ──

app.on('ready', async () => {
  log.info('VoiceFlow starting...');

  // Initialize settings
  initSettingsStore();

  // Initialize services
  const commandSettings = getSetting('commands');
  commandParser = new CommandParser(undefined, {
    detectionMode: commandSettings.detectionMode,
    prefixWord: commandSettings.prefixWord,
    literalEscape: commandSettings.literalEscape,
  });

  const typingSettings = getSetting('typing');
  actionExecutor = new ActionExecutor(typingSettings.speed);

  // Register custom commands
  for (const cmd of commandSettings.customCommands) {
    commandParser.getRegistry().register(cmd);
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create overlay window (hidden)
  createOverlayWindow();

  // Show settings window on first launch so user sees the app
  const uiSettings = getSetting('ui');
  if (!uiSettings.startMinimized) {
    createSettingsWindow();
  }

  // Create system tray
  createTray({
    onToggleRecording: toggleRecording,
    onShowSettings: () => createSettingsWindow(),
    onQuit: () => app.quit(),
  });

  // Register global hotkey with uiohook (supports Win key + proper hold-to-record)
  const hotkey = getSetting('hotkey');
  const hotkeyModeVal = (getSetting('hotkeyMode') as HotkeyMode) || 'toggle';
  const hotkeyOk = registerHotkey(hotkey, toggleRecording, {
    mode: hotkeyModeVal,
    onStart: startRecording,
    onStop: stopRecording,
  });
  if (!hotkeyOk) {
    log.warn(`Hotkey "${hotkey}" not recognized, falling back to Ctrl+Shift+Space`);
    registerHotkey('Ctrl+Shift+Space', toggleRecording, {
      mode: hotkeyModeVal,
      onStart: startRecording,
      onStop: stopRecording,
    });
  }

  log.info('VoiceFlow ready');
});

app.on('will-quit', () => {
  unregisterAll();
  destroyTray();
  destroyAllWindows();
  shutdownWhisperServer();
});

app.on('window-all-closed', () => {
  // Don't quit when all windows close — we live in the tray
  // Do nothing — app stays alive in system tray
});

// ── Recording Flow ──

function setRecordingState(state: RecordingState): void {
  recordingState = state;
  broadcastToRenderers(IPC.RECORDING_STATE, state);
  updateTrayState(state, {
    onToggleRecording: toggleRecording,
    onShowSettings: () => createSettingsWindow(),
    onQuit: () => app.quit(),
  });
}

function toggleRecording(): void {
  if (recordingState === 'idle') {
    startRecording();
  } else if (recordingState === 'recording') {
    stopRecording();
  }
  // If processing, ignore
}

function startRecording(): void {
  log.info('Recording started');
  setRecordingState('recording');
  showOverlay();

  // Send directly to overlay in case the broadcast above was missed (window throttled)
  const overlay = getOverlayWindow();
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send(IPC.RECORDING_STATE, 'recording');
    overlay.webContents.send(IPC.RECORDING_START);
  }
}

function stopRecording(): void {
  log.info('Recording stopped');
  setRecordingState('processing');

  // Tell renderer to stop capturing and send audio
  broadcastToRenderers(IPC.RECORDING_STOP);
}

// Handle audio data from renderer
import { ipcMain } from 'electron';

// Allow renderer to pull current recording state (belt-and-suspenders)
ipcMain.handle(IPC.RECORDING_GET_STATE, () => recordingState);

let cancelled = false;

ipcMain.on(IPC.TRANSCRIPTION_CANCEL, () => {
  log.info('Transcription cancelled by user');
  cancelled = true;
  setRecordingState('idle');
  hideOverlay();
});

ipcMain.on(IPC.AUDIO_DATA, async (_event, audioBuffer: ArrayBuffer, _format: string) => {
  cancelled = false;

  try {
    // Audio arrives as WAV (16kHz mono PCM) from renderer — no conversion needed
    const result = await transcribe(audioBuffer, 'wav');

    if (cancelled) {
      log.info('Transcription result discarded (cancelled)');
      return;
    }

    if (result.text.trim()) {
      // Parse commands
      const parsed = commandParser.parse(result.text);
      log.info(`Parsed ${parsed.segments.length} segments from: "${result.text}"`);

      // Broadcast result to renderer
      broadcastToRenderers(IPC.TRANSCRIPTION_RESULT, result.text);

      // Hide overlay before executing (so keystrokes go to the right window)
      hideOverlay();

      // Small delay to let focus return to previous window
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Execute actions
      await actionExecutor.execute(parsed);

      broadcastToRenderers(IPC.COMMAND_EXECUTED, parsed.segments);
    } else {
      log.info('Empty transcription — nothing to execute');
      hideOverlay();
    }
  } catch (err) {
    if (cancelled) return;
    log.error('Pipeline error', err);
    broadcastToRenderers(IPC.TRANSCRIPTION_ERROR, (err as Error).message);
  } finally {
    if (!cancelled) {
      setRecordingState('idle');
    }
  }
});
