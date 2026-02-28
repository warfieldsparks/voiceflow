# Architecture Overview

```
User speaks → Global Hotkey (uiohook-napi) → Record Audio (Web Audio API, 16kHz mono WAV)
  → Transcribe (Groq API / local whisper-server) → Parse Commands (trie + heuristic scoring)
  → Execute: paste text (clipboard) + press keys (nut-js) → Active Window
```

Three Electron processes work together:

| Process | Role | Key Files |
|---------|------|-----------|
| **Main** | Hotkeys, tray, transcription, command parsing, keyboard injection, settings, window management | `src/main/` |
| **Renderer** | Audio recording (ScriptProcessorNode → WAV), waveform overlay, settings UI | `src/renderer/` |
| **Preload** | Secure IPC bridge via `contextBridge` (`window.voiceflow`) | `src/preload/index.ts` |

The main process owns the recording state machine (`idle` → `recording` → `processing` → `idle`). Renderer captures audio. Communication happens via IPC channels defined in `src/shared/constants.ts`.

## Project Structure

```
voiceflow/
├── src/
│   ├── main/                              # Electron main process
│   │   ├── index.ts                       # App lifecycle, recording state machine, single-instance lock
│   │   ├── globalHotkey.ts                # uiohook-napi keyboard hooks (Win key, hold-to-record)
│   │   ├── ipc-handlers.ts               # All ipcMain.handle() registrations
│   │   ├── tray.ts                        # System tray icon + context menu
│   │   ├── window-manager.ts             # Overlay (420x64 frameless) + settings windows
│   │   ├── utils/
│   │   │   └── logger.ts                  # Console logger with [tag] prefix
│   │   └── services/
│   │       ├── transcription/
│   │       │   ├── TranscriptionService.ts    # Factory: groq vs local
│   │       │   ├── GroqProvider.ts            # Groq Whisper large-v3-turbo (free cloud API)
│   │       │   ├── WhisperLocalProvider.ts    # whisper-server persistent process (port 18080)
│   │       │   └── ModelManager.ts            # Model download/listing
│   │       ├── commands/
│   │       │   ├── CommandParser.ts           # Tokenize + classify text vs commands
│   │       │   ├── CommandRegistry.ts         # Trie-based phrase lookup (longest match)
│   │       │   ├── CommandTypes.ts            # Type definitions
│   │       │   └── SmartDetection.ts          # Heuristic scoring (position, isolation, grammar)
│   │       ├── keyboard/
│   │       │   ├── ActionExecutor.ts          # Dispatch: text → clipboard paste, command → key press
│   │       │   ├── KeyMapper.ts               # Command name → nut-js Key enum
│   │       │   └── TextInjector.ts            # Clipboard paste (save → write → Ctrl+V → restore)
│   │       └── settings/
│   │           ├── SettingsStore.ts            # electron-store wrapper + migration
│   │           └── SettingsSchema.ts           # JSON Schema for validation
│   ├── preload/
│   │   └── index.ts                       # contextBridge → window.voiceflow API
│   ├── renderer/
│   │   ├── App.tsx                        # Route: overlay vs settings based on URL hash
│   │   ├── main.tsx                       # React entry point
│   │   ├── mock-api.ts                    # Mock API for browser preview mode
│   │   ├── components/
│   │   │   ├── overlay/
│   │   │   │   ├── RecordingOverlay.tsx    # Recording UI + audio capture + WAV encoding
│   │   │   │   ├── Waveform.tsx           # SVG waveform visualization (32 bars)
│   │   │   │   └── StatusIndicator.tsx    # Colored dot + state label
│   │   │   ├── settings/
│   │   │   │   ├── SettingsPanel.tsx       # Main settings container with tabbed navigation
│   │   │   │   ├── WhisperConfig.tsx       # Transcription mode selector (groq/local)
│   │   │   │   ├── HotkeyConfig.tsx        # Hotkey preset selector + mode (toggle/hold)
│   │   │   │   ├── CommandEditor.tsx        # Custom command CRUD
│   │   │   │   ├── AudioConfig.tsx          # Input device, silence threshold
│   │   │   │   └── DiagnosticPanel.tsx      # System diagnostics + test transcription
│   │   │   └── common/
│   │   │       ├── Button.tsx              # Styled button component
│   │   │       └── Toggle.tsx              # Toggle switch component
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts        # ScriptProcessorNode → 16kHz mono PCM → WAV
│   │   │   ├── useSettings.ts             # Read/write settings via IPC
│   │   │   └── useWaveform.ts             # AnalyserNode → frequency data for visualization
│   │   └── styles/
│   │       ├── global.css                  # Settings panel styles
│   │       └── overlay.css                 # Overlay bar styles
│   └── shared/
│       ├── types.ts                        # All shared TypeScript types
│       ├── constants.ts                    # IPC channel names, DEFAULT_SETTINGS
│       └── command-definitions.ts          # ~60 built-in verbal commands
├── resources/
│   ├── whisper/                            # Bundled whisper.cpp binaries + small.en model (466MB)
│   ├── icons/                              # Tray + app icons
│   └── sounds/                             # Audio feedback
├── tests/unit/                             # CommandParser, CommandRegistry, SmartDetection tests
├── package.json                            # Dependencies & scripts
├── electron-builder.yml                    # Packaging config
├── tsconfig.main.json                      # Main process TypeScript config
├── tsconfig.renderer.json                  # Renderer TypeScript config (rootDir=src for shared types)
├── tsconfig.preload.json                   # Preload script TypeScript config
└── src/renderer/vite.config.ts             # Vite config for renderer build
```
