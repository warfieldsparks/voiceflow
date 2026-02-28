# VoiceFlow

Desktop voice dictation with verbal commands. Electron + TypeScript + React. Hold hotkey, speak, text appears in active window.

## Quick Start

```bash
npm install && npm run build     # Build
npm run dev                      # Dev mode
npm test                         # Tests (74 passing)
npx electron-builder --win       # Windows installer → release/
```

## How It Works

```
Hold Alt+Z → Record audio (16kHz WAV) → Transcribe (Groq Whisper API)
  → Parse commands ("enter","period") → Inject text (clipboard paste) + keys (nut-js)
```

## Three Processes

| Process | Role |
|---------|------|
| **Main** | Hotkeys (uiohook-napi), tray, transcription, command parsing, keyboard injection |
| **Renderer** | Audio capture (ScriptProcessorNode → WAV), overlay UI, settings UI |
| **Preload** | Secure IPC bridge (`window.voiceflow`) |

## Defaults

- **Hotkey**: Alt+Z
- **Mode**: Hold-to-talk
- **Transcription**: Groq cloud (free, ~0.5s)
- **Commands**: Contextual detection (~60 built-in commands)
- **Text injection**: Clipboard paste (instant)

## Key Files

```
src/main/index.ts                    # App lifecycle, recording state machine
src/main/globalHotkey.ts             # uiohook-napi keyboard hooks
src/main/ipc-handlers.ts             # All IPC handler registrations
src/main/window-manager.ts           # Overlay (420x64) + settings windows
src/main/tray.ts                     # System tray

src/main/services/
  transcription/TranscriptionService.ts  # Transcription entry point
  transcription/GroqProvider.ts          # Groq Whisper API
  commands/CommandParser.ts              # Trie + heuristic scoring
  commands/CommandRegistry.ts            # Trie-based phrase lookup
  commands/SmartDetection.ts             # Contextual scoring heuristics
  keyboard/ActionExecutor.ts             # Text paste + key press dispatch
  keyboard/TextInjector.ts              # Clipboard paste (save→write→Ctrl+V→restore)
  settings/SettingsStore.ts              # electron-store + migration

src/preload/index.ts                 # contextBridge API (23 methods)
src/renderer/components/overlay/RecordingOverlay.tsx  # Audio capture + WAV encoding
src/renderer/components/settings/SettingsPanel.tsx    # Tabbed settings UI

src/shared/constants.ts              # IPC channels, DEFAULT_SETTINGS
src/shared/types.ts                  # All shared types
src/shared/command-definitions.ts    # ~60 built-in commands
```

## Recording Pipeline

1. **Hotkey press** → `startRecording()` → show overlay → broadcast + direct send to overlay
2. **Audio capture** → getUserMedia → AudioContext(16kHz) → ScriptProcessorNode → PCM chunks
3. **Hotkey release** → `stopRecording()` → broadcast RECORDING_STOP
4. **WAV encoding** → renderer builds WAV from PCM → sends via IPC
5. **Transcribe** → Groq Whisper API
6. **Parse** → trie lookup + heuristic scoring → text/command segments
7. **Execute** → hide overlay → 150ms delay → paste text + press keys
8. **Done** → broadcast result → set state idle

## Transcription

Groq Cloud only — free API, whisper-large-v3-turbo, ~0.5s, 2000 req/day.

## Hotkey Presets

Alt+Z (default), Ctrl+Win, Ctrl+Shift+Space, Ctrl+Alt+Space, Ctrl+Shift+Z, F9

## IPC Pattern

All channels in `src/shared/constants.ts`. Pattern: `domain:action` (e.g. `recording:start`).
Preload exposes 23 methods on `window.voiceflow`. All `on*` methods return cleanup functions.

## Settings

`electron-store` in `%APPDATA%/voiceflow/`. Schema validated. Migration on startup removes stale GPU/cloud fields from old installs. Changes to hotkey/mode/transcription trigger reactive side effects.

## Window Management

- **Overlay**: 420x64 frameless transparent always-on-top. `backgroundThrottling: false` critical.
- **Settings**: 720x560 standard window. Created on demand.

## Common Modifications

- **New IPC channel**: constants.ts → ipc-handlers.ts → preload/index.ts → renderer
- **New command**: Add to `command-definitions.ts`
- **New hotkey preset**: `globalHotkey.ts` PRESETS + `HotkeyConfig.tsx`
- **New transcription provider**: Implement `TranscriptionProvider` → TranscriptionService.ts → schema → UI
- **New setting**: types.ts → constants.ts → SettingsSchema.ts → migration → UI

## Detailed Docs

See `docs/` folder for in-depth documentation:
- [docs/architecture.md](docs/architecture.md) — Full project structure and architecture
- [docs/data-flow.md](docs/data-flow.md) — Step-by-step recording pipeline
- [docs/ipc-channels.md](docs/ipc-channels.md) — All IPC channels + preload bridge methods
- [docs/file-reference.md](docs/file-reference.md) — Every source file documented
- [docs/transcription.md](docs/transcription.md) — Groq and local provider details
- [docs/commands.md](docs/commands.md) — Command system, scoring, built-in commands
- [docs/settings.md](docs/settings.md) — Settings, hotkeys, types, migration
- [docs/building.md](docs/building.md) — Build scripts, packaging, dependencies, recipes, known issues
