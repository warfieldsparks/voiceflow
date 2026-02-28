// ── Transcription ──

export type TranscriptionMode = 'groq';

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface TranscriptionProvider {
  transcribe(audioBuffer: ArrayBuffer, format?: string): Promise<TranscriptionResult>;
  isAvailable(): Promise<boolean>;
}

// ── Commands ──

export type CommandAction =
  | { type: 'key'; key: string }
  | { type: 'combo'; keys: string[] }
  | { type: 'text'; text: string }
  | { type: 'sequence'; actions: CommandAction[] }
  | { type: 'modifier'; modifier: 'capitalize' | 'allCaps' | 'noCaps' };

export interface CommandDefinition {
  phrase: string;
  action: CommandAction;
  category: string;
  description: string;
}

export interface ParsedSegment {
  type: 'text' | 'command';
  value: string;
  command?: CommandDefinition;
}

export type CommandDetectionMode = 'contextual' | 'prefix';

// ── Settings ──

export type HotkeyMode = 'toggle' | 'hold';

export interface VoiceFlowSettings {
  hotkey: string;
  hotkeyMode: HotkeyMode;
  transcription: {
    mode: TranscriptionMode;
    groqApiKey: string;
  };
  commands: {
    detectionMode: CommandDetectionMode;
    prefixWord: string;
    literalEscape: string;
    customCommands: CommandDefinition[];
  };
  audio: {
    inputDeviceId: string;
    silenceThreshold: number;
    autoStopAfterSilence: number; // ms
  };
  ui: {
    overlayPosition: 'top' | 'bottom';
    showWaveform: boolean;
    soundFeedback: boolean;
    startMinimized: boolean;
    launchAtLogin: boolean;
  };
  typing: {
    speed: number; // chars per second, 0 = instant
  };
}

// ── IPC Payloads ──

export interface AudioData {
  buffer: ArrayBuffer;
  format: string;
  duration: number;
}

export type RecordingState = 'idle' | 'recording' | 'processing';

export interface AppStatus {
  recording: RecordingState;
  transcriptionReady: boolean;
  lastError?: string;
}

