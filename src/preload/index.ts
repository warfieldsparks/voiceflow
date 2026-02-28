import { contextBridge, ipcRenderer, shell } from 'electron';
import { IPC } from '../shared/constants';

// Secure API exposed to renderer via contextBridge
const api = {
  // ── Recording ──
  onRecordingStart: (callback: () => void) => {
    ipcRenderer.on(IPC.RECORDING_START, callback);
    return () => ipcRenderer.removeListener(IPC.RECORDING_START, callback);
  },
  onRecordingStop: (callback: () => void) => {
    ipcRenderer.on(IPC.RECORDING_STOP, callback);
    return () => ipcRenderer.removeListener(IPC.RECORDING_STOP, callback);
  },
  onRecordingState: (callback: (state: string) => void) => {
    const handler = (_event: any, state: string) => callback(state);
    ipcRenderer.on(IPC.RECORDING_STATE, handler);
    return () => ipcRenderer.removeListener(IPC.RECORDING_STATE, handler);
  },
  sendAudioData: (buffer: ArrayBuffer, format: string) => {
    ipcRenderer.send(IPC.AUDIO_DATA, buffer, format);
  },

  // ── Transcription ──
  cancelTranscription: () => ipcRenderer.send(IPC.TRANSCRIPTION_CANCEL),
  transcribe: (audioBuffer: ArrayBuffer, format?: string) =>
    ipcRenderer.invoke(IPC.TRANSCRIBE, audioBuffer, format),
  onTranscriptionResult: (callback: (text: string) => void) => {
    const handler = (_event: any, text: string) => callback(text);
    ipcRenderer.on(IPC.TRANSCRIPTION_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC.TRANSCRIPTION_RESULT, handler);
  },
  onTranscriptionError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error);
    ipcRenderer.on(IPC.TRANSCRIPTION_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.TRANSCRIPTION_ERROR, handler);
  },

  // ── Commands ──
  onCommandExecuted: (callback: (segments: any[]) => void) => {
    const handler = (_event: any, segments: any[]) => callback(segments);
    ipcRenderer.on(IPC.COMMAND_EXECUTED, handler);
    return () => ipcRenderer.removeListener(IPC.COMMAND_EXECUTED, handler);
  },

  // ── Settings ──
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
  getSetting: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  resetSettings: () => ipcRenderer.invoke(IPC.SETTINGS_RESET),

  // ── Recording state (pull) ──
  getRecordingState: () => ipcRenderer.invoke(IPC.RECORDING_GET_STATE),

  // ── App ──
  getAppStatus: () => ipcRenderer.invoke(IPC.APP_STATUS),
  quit: () => ipcRenderer.send(IPC.APP_QUIT),
  showSettings: () => ipcRenderer.send(IPC.APP_SHOW_SETTINGS),

  // ── Diagnostics ──
  runDiagnostic: () => ipcRenderer.invoke(IPC.DIAGNOSTIC_RUN),
  testTranscription: (wavBuffer: ArrayBuffer) =>
    ipcRenderer.invoke(IPC.DIAGNOSTIC_TRANSCRIBE_TEST, wavBuffer),

  // ── Shell ──
  openExternal: (url: string) => shell.openExternal(url),
};

contextBridge.exposeInMainWorld('voiceflow', api);

// TypeScript declaration for renderer
export type VoiceFlowAPI = typeof api;
