# File Reference

## Main Process

### `src/main/index.ts` — App Lifecycle & Recording Flow

**Purpose**: Entry point. Manages the recording state machine, app lifecycle, and single-instance lock.

**Key state**:
- `recordingState: RecordingState` — `'idle'` | `'recording'` | `'processing'`
- `commandParser: CommandParser` — initialized with settings on `app.ready`
- `actionExecutor: ActionExecutor` — initialized with typing speed on `app.ready`
- `cancelled: boolean` — tracks if user cancelled transcription

**App lifecycle**:
- `app.requestSingleInstanceLock()` — prevents multiple instances
- `second-instance` → shows settings window
- `app.ready` → init settings → init services → create overlay → create tray → register hotkey
- `app.will-quit` → unregister hotkeys → destroy tray → destroy windows → shutdown whisper-server
- `window-all-closed` → does nothing (app stays in tray)

**Recording flow**:
- `toggleRecording()` — called by hotkey in toggle mode
- `startRecording()` — sets state to `'recording'`, shows overlay, sends direct IPC to overlay
- `stopRecording()` — sets state to `'processing'`, broadcasts `RECORDING_STOP`
- `IPC.AUDIO_DATA` handler — transcribes → parses commands → hides overlay → executes actions

**State sync** (belt-and-suspenders approach for overlay):
1. `broadcastToRenderers(RECORDING_STATE)` — broadcasts to all windows
2. Direct `overlay.webContents.send(RECORDING_STATE)` — targeted send to overlay
3. Direct `overlay.webContents.send(RECORDING_START)` — trigger audio capture
4. `RECORDING_GET_STATE` handler — renderer can pull state on mount

### `src/main/globalHotkey.ts` — Global Keyboard Hooks

**Purpose**: Registers OS-level keyboard hooks using `uiohook-napi`. Supports Win/Meta key and hold-to-record mode.

**Preset hotkeys** (in `PRESETS` map):
| Preset ID | Key Codes |
|-----------|-----------|
| `Ctrl+Win` | Ctrl + Meta |
| `Ctrl+Shift+Space` | Ctrl + Shift + Space |
| `Ctrl+Alt+Space` | Ctrl + Alt + Space |
| `Alt+Z` | Alt + Z |
| `Ctrl+Shift+Z` | Ctrl + Shift + Z |
| `F9` | F9 |

**Modes**:
- **Toggle**: `onKeyDown` fires callback when all required keys pressed simultaneously
- **Hold**: `onKeyDown` fires `onStart` when all keys held, `onKeyUp` fires `onStop` when any key released

**Exports**:
- `registerHotkey(id, callback, options)` — returns `false` if preset not found
- `unregisterHotkey()` — clears current registration
- `updateHotkey(newId)` — re-registers with same callbacks
- `updateHotkeyMode(mode)` — switch toggle/hold without re-registering
- `unregisterAll()` — stops uiohook entirely
- `getCurrentHotkey()` / `getCurrentMode()` — getters
- `getHotkeyPresets()` — returns preset IDs

### `src/main/ipc-handlers.ts` — IPC Handler Registration

**Purpose**: Centralizes all `ipcMain.handle()` registrations. Called once from `app.ready`.

**Handlers registered**:
- `TRANSCRIBE` — direct transcription (used by diagnostics)
- `SETTINGS_GET_ALL` / `SETTINGS_GET` / `SETTINGS_SET` / `SETTINGS_RESET`
- `MODEL_LIST` / `MODEL_DOWNLOAD`
- `APP_STATUS`
- `DIAGNOSTIC_RUN` / `DIAGNOSTIC_TRANSCRIBE_TEST`

**Side effects on `SETTINGS_SET`**:
- `key === 'hotkey'` → calls `updateHotkey(value)` to re-register
- `key === 'hotkeyMode'` → calls `updateHotkeyMode(value)`
- `key === 'transcription'` with mode changed → calls `shutdownWhisperServer()` to restart

**Exports**:
- `registerIpcHandlers()` — call once
- `broadcastToRenderers(channel, ...args)` — sends to all `BrowserWindow` instances

### `src/main/tray.ts` — System Tray

**Purpose**: Creates and manages the system tray icon with context menu.

**Menu items**: Start/Stop Recording, Settings, Version info, Quit.
**Tooltip** updates with recording state: Ready / Recording... / Processing...
**Fallback icon**: If no icon file found, generates a 16x16 blue dot PNG programmatically.

### `src/main/window-manager.ts` — Window Management

**Purpose**: Creates and manages two BrowserWindow instances.

**Overlay window** (420x64):
- Frameless, transparent, always-on-top, skip-taskbar, non-focusable
- `backgroundThrottling: false` — critical for receiving IPC while hidden
- Centered horizontally, 20px from top
- Loads renderer URL with `#overlay` hash

**Settings window** (720x560):
- Standard framed window with min size 600x400
- Loads renderer URL with `#settings` hash
- Created on demand (tray menu, second instance)
- Menu bar hidden

**Path resolution**:
- Dev: `http://localhost:5173#overlay` / `#settings`
- Packaged: `file://<appPath>/dist/renderer/index.html#overlay`
- Preload: `<appPath>/dist/main/preload/index.js`

### `src/main/services/transcription/TranscriptionService.ts` — Transcription Factory

**Providers**: `groq` → `GroqProvider(apiKey)`, `local` → `WhisperLocalProvider(modelName)`
**Exports**: `transcribe(audioBuffer, format)`, `isTranscriptionReady()`

### `src/main/services/transcription/GroqProvider.ts` — Groq Cloud Transcription

**API**: `POST https://api.groq.com/openai/v1/audio/transcriptions`
- Model: `whisper-large-v3-turbo`, Language: `en`, Temperature: `0`
- Raw `https.request()` with multipart form-data (no external HTTP library)
- 30s timeout, parses error JSON for user-friendly messages

### `src/main/services/transcription/WhisperLocalProvider.ts` — Local Transcription

**Server mode** (fast): Persistent `whisper-server` on port 18080. Model stays in memory. Health-checked before each use. Multipart POST to `/inference`.

**CLI mode** (fallback): Runs `whisper-cli` subprocess. Loads model each time. Writes temp WAV, reads `.txt` output.

**Model resolution**: Bundled dir first (`resources/whisper/`), then user data dir. Falls back to `ggml-small.en.bin`.

**Server lifecycle**: Started on first call, auto-restarts on model change, shut down on `app.will-quit`.

### `src/main/services/commands/CommandParser.ts` — Command Parsing

**Contextual mode**: Trie lookup → heuristic scoring → cluster boost → accept if score >= 0.5
**Prefix mode**: Only triggers commands prefixed with configurable word (default: "command")
**Output**: `ParseResult { segments: ParsedSegment[], rawText: string }`

### `src/main/services/commands/CommandRegistry.ts` — Trie-Based Lookup

`longestMatch(words, startIndex)` — returns longest matching command phrase.

### `src/main/services/commands/SmartDetection.ts` — Heuristic Scoring

Scoring factors: position weight, isolation, grammar context, category weight, cluster boost.

### `src/main/services/keyboard/ActionExecutor.ts` — Action Execution

Action types: `key` (single press), `combo` (multi-key), `text` (inject), `sequence` (multiple), `modifier` (capitalize/allCaps/noCaps for next text).

### `src/main/services/keyboard/TextInjector.ts` — Text Injection

Speed 0: clipboard paste (save → write → Ctrl+V → restore). Speed > 0: char-by-char via nut-js.

### `src/main/services/keyboard/KeyMapper.ts` — Key Name Mapping

Maps command names ("enter", "tab") to nut-js `Key` enum values.

### `src/main/services/settings/SettingsStore.ts` — Settings Persistence

electron-store wrapper. Migration on init removes stale GPU/cloud fields from old installs.

### `src/main/services/settings/SettingsSchema.ts` — JSON Schema

Validation schema for electron-store. Ensures settings conform to expected types/enums.

---

## Renderer Process

### `src/renderer/App.tsx` — Routing

`#overlay` → `<RecordingOverlay />`, `#settings` → `<SettingsPanel />`, default → `<PreviewShell />`

### `src/renderer/components/overlay/RecordingOverlay.tsx` — Recording Overlay

Main recording UI. States: idle (Ready), recording (waveform), processing (spinner + timer), error.
Audio capture: getUserMedia → AudioContext(16kHz) → ScriptProcessorNode → PCM chunks → buildWav().
State sync on mount: calls `getRecordingState()` to pull current state.

### `src/renderer/components/overlay/Waveform.tsx` — SVG bar chart (32 bars)

### `src/renderer/components/overlay/StatusIndicator.tsx` — Colored dot + label

### `src/renderer/components/settings/SettingsPanel.tsx` — Tabbed settings UI

Tabs: Diagnostic, General, Hotkeys, Commands, Whisper, Audio

### `src/renderer/components/settings/WhisperConfig.tsx` — Groq/Local selector + API key

### `src/renderer/components/settings/HotkeyConfig.tsx` — Preset selector + toggle/hold mode

### `src/renderer/hooks/useWaveform.ts` — AnalyserNode → 32 bars of frequency data

### `src/renderer/hooks/useSettings.ts` — Read/write settings via IPC

### `src/renderer/hooks/useAudioRecorder.ts` — Standalone audio recording hook (diagnostics)
