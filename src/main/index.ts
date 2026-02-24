import { app, BrowserWindow } from 'electron';
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
} from './window-manager';
import { initSettingsStore, getSetting } from './services/settings/SettingsStore';
import { transcribe } from './services/transcription/TranscriptionService';
import { CommandParser } from './services/commands/CommandParser';
import { ActionExecutor } from './services/keyboard/ActionExecutor';
import { RecordingState } from '../shared/types';
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
  // Focus the settings window if it exists
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    if (wins[0].isMinimized()) wins[0].restore();
    wins[0].focus();
  }
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

  // Create system tray
  createTray({
    onToggleRecording: toggleRecording,
    onShowSettings: () => createSettingsWindow(),
    onQuit: () => app.quit(),
  });

  // Register global hotkey
  const hotkey = getSetting('hotkey');
  registerHotkey(hotkey, toggleRecording);

  log.info('VoiceFlow ready');
});

app.on('will-quit', () => {
  unregisterAll();
  destroyTray();
  destroyAllWindows();
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

  // Tell renderer to start capturing audio
  broadcastToRenderers(IPC.RECORDING_START);
}

function stopRecording(): void {
  log.info('Recording stopped');
  setRecordingState('processing');

  // Tell renderer to stop capturing and send audio
  broadcastToRenderers(IPC.RECORDING_STOP);
}

// Handle audio data from renderer
import { ipcMain } from 'electron';

ipcMain.on(IPC.AUDIO_DATA, async (_event, audioBuffer: ArrayBuffer, format: string) => {
  try {
    // Transcribe
    const result = await transcribe(audioBuffer, format);

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
    log.error('Pipeline error', err);
    broadcastToRenderers(IPC.TRANSCRIPTION_ERROR, (err as Error).message);
  } finally {
    setRecordingState('idle');
  }
});
