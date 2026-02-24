/**
 * Mock VoiceFlow API for browser preview (no Electron).
 * Simulates the preload bridge so the UI can be previewed standalone.
 */

import { DEFAULT_SETTINGS } from '../shared/constants';
import type { VoiceFlowSettings } from '../shared/types';

let settings: VoiceFlowSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as VoiceFlowSettings;

const noop = () => () => {};

const mockApi = {
  // Recording
  onRecordingStart: noop,
  onRecordingStop: noop,
  onRecordingState: noop,
  sendAudioData: () => {},

  // Transcription
  transcribe: async () => ({ success: true, data: { text: 'hello world period' } }),
  onTranscriptionResult: noop,
  onTranscriptionError: noop,

  // Commands
  onCommandExecuted: noop,

  // Settings
  getSettings: async () => settings,
  getSetting: async (key: string) => (settings as any)[key],
  setSetting: async (key: string, value: any) => {
    (settings as any)[key] = value;
    return true;
  },
  resetSettings: async () => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    return settings;
  },

  // Models
  listModels: async () => [
    { name: 'tiny', size: '75 MB', downloaded: true, path: '/mock/tiny.bin' },
    { name: 'base', size: '142 MB', downloaded: false },
    { name: 'small', size: '466 MB', downloaded: false },
    { name: 'medium', size: '1.5 GB', downloaded: false },
    { name: 'large', size: '2.9 GB', downloaded: false },
  ],
  downloadModel: async () => ({ success: true, path: '/mock/model.bin' }),
  onModelProgress: noop,

  // App
  getAppStatus: async () => ({ transcriptionReady: true }),
  quit: () => {},
  showSettings: () => {},
};

// Install mock if not running in Electron
if (!(window as any).voiceflow) {
  (window as any).voiceflow = mockApi;
}
