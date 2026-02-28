// IPC channel names — single source of truth
export const IPC = {
  // Audio
  AUDIO_DATA: 'audio:data',
  AUDIO_LEVEL: 'audio:level',

  // Recording control
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_TOGGLE: 'recording:toggle',
  RECORDING_STATE: 'recording:state',

  // Transcription
  TRANSCRIBE: 'transcribe:run',
  TRANSCRIPTION_CANCEL: 'transcription:cancel',
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_ERROR: 'transcription:error',

  // Commands
  COMMAND_EXECUTED: 'command:executed',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_RESET: 'settings:reset',

  // App
  APP_STATUS: 'app:status',
  APP_QUIT: 'app:quit',
  APP_SHOW_SETTINGS: 'app:showSettings',

  // Audio devices
  AUDIO_DEVICES: 'audio:devices',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_CLOSE: 'window:close',

  // Diagnostics
  DIAGNOSTIC_RUN: 'diagnostic:run',
  DIAGNOSTIC_TRANSCRIBE_TEST: 'diagnostic:transcribeTest',

  // Recording state (pull)
  RECORDING_GET_STATE: 'recording:getState',
} as const;

export const DEFAULT_HOTKEY = 'Alt+Z';

export const DEFAULT_SETTINGS = {
  hotkey: DEFAULT_HOTKEY,
  hotkeyMode: 'hold' as const,
  transcription: {
    mode: 'groq' as const,
    groqApiKey: '',
  },
  commands: {
    detectionMode: 'contextual' as const,
    prefixWord: 'command',
    literalEscape: 'literal',
    customCommands: [],
  },
  audio: {
    inputDeviceId: 'default',
    silenceThreshold: 0.02,
    autoStopAfterSilence: 5000,
  },
  ui: {
    overlayPosition: 'top' as const,
    showWaveform: true,
    soundFeedback: true,
    startMinimized: false,
    launchAtLogin: false,
  },
  typing: {
    speed: 0,
  },
};
