import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/constants';
import { transcribe, isTranscriptionReady } from './services/transcription/TranscriptionService';
import { getSettings, getSetting, setSetting, setSettings, resetSettings } from './services/settings/SettingsStore';
import { listModels, downloadModel } from './services/transcription/ModelManager';
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
    return true;
  });

  ipcMain.handle(IPC.SETTINGS_RESET, async () => {
    resetSettings();
    return getSettings();
  });

  // ── Models ──
  ipcMain.handle(IPC.MODEL_LIST, async () => {
    return listModels();
  });

  ipcMain.handle(IPC.MODEL_DOWNLOAD, async (event, modelName: string) => {
    try {
      const path = await downloadModel(modelName, (percent) => {
        event.sender.send(IPC.MODEL_DOWNLOAD_PROGRESS, { modelName, percent });
      });
      return { success: true, path };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── App status ──
  ipcMain.handle(IPC.APP_STATUS, async () => {
    const transcriptionReady = await isTranscriptionReady();
    return { transcriptionReady };
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
