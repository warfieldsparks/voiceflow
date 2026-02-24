import { VoiceFlowSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/constants';

export const settingsSchema = {
  hotkey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.hotkey,
  },
  transcription: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.transcription,
    properties: {
      mode: { type: 'string', enum: ['cloud', 'local'] },
      apiKey: { type: 'string' },
      localModel: { type: 'string' },
    },
  },
  commands: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.commands,
    properties: {
      detectionMode: { type: 'string', enum: ['contextual', 'prefix'] },
      prefixWord: { type: 'string' },
      literalEscape: { type: 'string' },
      customCommands: { type: 'array' },
    },
  },
  audio: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.audio,
    properties: {
      inputDeviceId: { type: 'string' },
      silenceThreshold: { type: 'number' },
      autoStopAfterSilence: { type: 'number' },
    },
  },
  ui: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.ui,
    properties: {
      overlayPosition: { type: 'string', enum: ['top', 'bottom'] },
      showWaveform: { type: 'boolean' },
      soundFeedback: { type: 'boolean' },
      startMinimized: { type: 'boolean' },
      launchAtLogin: { type: 'boolean' },
    },
  },
  typing: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.typing,
    properties: {
      speed: { type: 'number' },
    },
  },
};

export type { VoiceFlowSettings };
