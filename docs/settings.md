# Settings System

## Storage
`electron-store` with JSON Schema validation. File: `%APPDATA%/voiceflow/` on Windows.

## Default Settings
```typescript
{
  hotkey: 'Alt+Z',
  hotkeyMode: 'hold',
  transcription: { mode: 'groq', groqApiKey: '', localModel: 'small.en' },
  commands: { detectionMode: 'contextual', prefixWord: 'command', literalEscape: 'literal', customCommands: [] },
  audio: { inputDeviceId: 'default', silenceThreshold: 0.02, autoStopAfterSilence: 5000 },
  ui: { overlayPosition: 'top', showWaveform: true, soundFeedback: true, startMinimized: false, launchAtLogin: false },
  typing: { speed: 0 },
}
```

## Types
```typescript
type TranscriptionMode = 'local' | 'groq';
type HotkeyMode = 'toggle' | 'hold';
type CommandDetectionMode = 'contextual' | 'prefix';
type RecordingState = 'idle' | 'recording' | 'processing';
type CommandAction = { type: 'key', key } | { type: 'combo', keys[] } | { type: 'text', text } | { type: 'sequence', actions[] } | { type: 'modifier', modifier };
```

## Schema Validation
Settings validated against schema in `SettingsSchema.ts`. Invalid configs cleared automatically (`clearInvalidConfig: true`).

## Migration
On startup, `migrateSettings()` in `SettingsStore.ts` removes stale fields:
- `transcription.apiKey` — removed (was for OpenAI)
- `transcription.useGpu` — removed (GPU acceleration removed)
- `transcription.mode === 'cloud'` — reset to default `'groq'`

## Reactive Side Effects
When settings change via `SETTINGS_SET` IPC handler:
- **Hotkey changed** → `updateHotkey()` re-registers keyboard hook
- **Hotkey mode changed** → `updateHotkeyMode()` switches toggle/hold
- **Transcription mode changed** → `shutdownWhisperServer()` to restart

## Global Hotkeys

### Why uiohook-napi?
Electron's `globalShortcut` cannot intercept Win/Meta key. `uiohook-napi` provides OS-level hooks.

### Available Presets
| ID | Keys | Description |
|----|------|-------------|
| `Alt+Z` | Alt + Z | Default — quick two-key |
| `Ctrl+Win` | Ctrl + Meta | Wispr Flow style |
| `Ctrl+Shift+Space` | Ctrl + Shift + Space | Classic |
| `Ctrl+Alt+Space` | Ctrl + Alt + Space | WhisperWriter style |
| `F9` | F9 | Single key |

### Recording Modes
- **Hold** (default): Hold hotkey → recording starts. Release → stops and transcribes.
- **Toggle**: Press to start, press again to stop.
