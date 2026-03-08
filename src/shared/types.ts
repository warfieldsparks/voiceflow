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
  sessionId: number;
  buffer: ArrayBuffer;
  format: string;
  duration: number;
}

export type RecordingState = 'idle' | 'recording' | 'processing';

export interface RecordingStatus {
  state: RecordingState;
  sessionId: number | null;
}

export interface RecordingControlPayload {
  sessionId: number;
  reason?: string;
}

export interface RecordingCaptureStartedPayload {
  sessionId: number;
  sampleRate: number;
  trackLabel?: string;
  channelCount?: number;
}

export interface RecordingCaptureFailedPayload {
  sessionId: number;
  message: string;
  errorName?: string;
}

export interface RecordingNoAudioPayload {
  sessionId: number;
  chunkCount: number;
  sampleCount: number;
  reason: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEventPayload {
  level: LogLevel;
  tag: string;
  message: string;
  details?: unknown;
  source?: 'main' | 'renderer' | 'preload';
}

export interface AppStatus {
  recording: RecordingState;
  transcriptionReady: boolean;
  logFilePath?: string;
  lastError?: string;
}
