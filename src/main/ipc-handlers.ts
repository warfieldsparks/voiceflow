import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/constants';
import { transcribe, isTranscriptionReady } from './services/transcription/TranscriptionService';
import { getSettings, getSetting, setSetting, setSettings, resetSettings } from './services/settings/SettingsStore';
import { updateHotkey, updateHotkeyMode, getCurrentHotkey, getCurrentMode } from './globalHotkey';
import { createLogger } from './utils/logger';

const log = createLogger('ipc');

export function registerIpcHandlers(): void {
  // ── Transcription ──
  ipcMain.handle(IPC.TRANSCRIBE, async (_event, audioBuffer: ArrayBuffer, format?: string) => {
    try {
      const result = await transcribe(audioBuffer, format);
      return { success: true, data: result };
    } catch (err) {
      log.error('Transcription failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Settings ──
  ipcMain.handle(IPC.SETTINGS_GET_ALL, async () => {
    return getSettings();
  });

  ipcMain.handle(IPC.SETTINGS_GET, async (_event, key: string) => {
    return getSetting(key as any);
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, key: string, value: any) => {
    setSetting(key as any, value);

    // Re-register hotkey when it changes
    if (key === 'hotkey' && typeof value === 'string') {
      const ok = updateHotkey(value);
      log.info(`Hotkey updated to "${value}": ${ok ? 'success' : 'failed'}`);
    }

    // Update hotkey mode when it changes
    if (key === 'hotkeyMode' && (value === 'toggle' || value === 'hold')) {
      updateHotkeyMode(value);
      log.info(`Hotkey mode updated to "${value}"`);
    }

    return true;
  });

  ipcMain.handle(IPC.SETTINGS_RESET, async () => {
    resetSettings();
    return getSettings();
  });

  // ── App status ──
  ipcMain.handle(IPC.APP_STATUS, async () => {
    const transcriptionReady = await isTranscriptionReady();
    return { transcriptionReady };
  });

  // ── Diagnostics ──
  ipcMain.handle(IPC.DIAGNOSTIC_RUN, async () => {
    const results: string[] = [];

    try {
      // 1. Check transcription
      const settings = getSetting('transcription');
      results.push(`[INFO] Transcription: Groq Cloud`);
      results.push(settings.groqApiKey
        ? `[OK] Groq API key is configured`
        : `[ERROR] Groq API key is NOT configured — set it in Settings > Whisper`);

      // 2. Check hotkey
      const hotkey = getSetting('hotkey');
      const activeHotkey = getCurrentHotkey();
      const activeMode = getCurrentMode();
      results.push(`[INFO] Hotkey setting: ${hotkey}`);
      results.push(`[INFO] Active hotkey: ${activeHotkey || 'none'}`);
      results.push(`[INFO] Hotkey mode: ${activeMode}`);
      results.push(`[OK] Using uiohook-napi (supports Win key + hold-to-record)`);

      // 3. Platform info
      results.push(`[INFO] Platform: ${process.platform}`);
      results.push(`[INFO] Arch: ${process.arch}`);
      results.push(`[INFO] Electron: ${process.versions.electron}`);
      results.push(`[INFO] Node: ${process.versions.node}`);

    } catch (err) {
      results.push(`[ERROR] Diagnostic failed: ${(err as Error).message}`);
    }

    return results;
  });

  // ── Test Transcription ──
  ipcMain.handle(IPC.DIAGNOSTIC_TRANSCRIBE_TEST, async (_event, wavBuffer: ArrayBuffer) => {
    const results: string[] = [];

    try {
      results.push(`[INFO] Received WAV buffer: ${wavBuffer.byteLength} bytes`);

      // Check WAV header
      const buf = Buffer.from(wavBuffer);
      if (buf.length > 44) {
        const riff = buf.toString('ascii', 0, 4);
        const wave = buf.toString('ascii', 8, 12);
        results.push(`[INFO] Header: ${riff}...${wave}`);
        results.push(`[INFO] Is valid WAV: ${riff === 'RIFF' && wave === 'WAVE'}`);

        // Read WAV details
        const channels = buf.readUInt16LE(22);
        const sampleRate = buf.readUInt32LE(24);
        const bitsPerSample = buf.readUInt16LE(34);
        const dataSize = buf.readUInt32LE(40);
        const durationSec = dataSize / (sampleRate * channels * (bitsPerSample / 8));
        results.push(`[INFO] Channels: ${channels}, Rate: ${sampleRate}Hz, Bits: ${bitsPerSample}`);
        results.push(`[INFO] Audio duration: ${durationSec.toFixed(1)}s`);
      } else {
        results.push(`[ERROR] Buffer too small for WAV: ${buf.length} bytes`);
      }

      // Try transcription
      results.push(`[INFO] Starting transcription...`);
      const start = Date.now();
      const result = await transcribe(wavBuffer, 'wav');
      const elapsed = Date.now() - start;
      results.push(`[OK] Transcription done in ${elapsed}ms: "${result.text}"`);
    } catch (err) {
      results.push(`[ERROR] Transcription failed: ${(err as Error).message}`);
      results.push(`[ERROR] Stack: ${(err as Error).stack?.substring(0, 500)}`);
    }

    return results;
  });

  log.info('IPC handlers registered');
}

/**
 * Send a message to all renderer windows.
 */
export function broadcastToRenderers(channel: string, ...args: any[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
