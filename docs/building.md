# Build & Package

## Scripts
```bash
npm install                      # Install dependencies
npm run build                    # Build renderer (Vite) + main/preload (tsc)
npm run dev                      # Dev mode with hot reload
npm test                         # Run unit tests (vitest)
npm run package                  # Build + package with electron-builder
npx electron-builder --win       # Package Windows installer only
```

## Build Steps
`npm run build` runs three steps in sequence:
1. `build:renderer` — Vite builds the React UI → `dist/renderer/`
2. `build:main` — TypeScript compiles main process → `dist/main/main/`
3. `build:preload` — TypeScript compiles preload script → `dist/main/preload/`

**All three are required.** The preload script exposes `window.voiceflow` to the renderer via `contextBridge`. Without it, the overlay cannot communicate with the main process.

## Build Output
```
dist/
├── main/                        # Compiled main process (CommonJS)
│   ├── main/index.js
│   └── preload/index.js
└── renderer/                    # Vite-built renderer (ES modules)
    ├── index.html
    └── assets/
```

## Package Output
`release/VoiceFlow Setup 1.0.0.exe` (~870 MB)
- NSIS installer (one-click, per-user)
- Includes whisper.cpp binaries and small.en model (466MB) in extraResources
- `uiohook-napi` native binaries unpacked from asar

## electron-builder.yml Key Settings
- `asar: true` — pack app into asar archive
- `asarUnpack`: `resources/whisper/**/*` and `node_modules/uiohook-napi/**/*`
- `extraResources`: copies `resources/whisper/` to `<app>/resources/whisper/`
- `win.target: nsis` — Windows NSIS installer
- `nsis.oneClick: true`, `nsis.perMachine: false`

## Dependencies
| Package | Purpose |
|---------|---------|
| `@nut-tree-fork/nut-js` | Cross-platform keyboard simulation |
| `electron-store` | Persistent settings storage |
| `uiohook-napi` | OS-level keyboard hooks |
| `electron` | Desktop app framework |
| `react` / `react-dom` | UI framework |
| `vite` | Renderer bundler |
| `vitest` | Unit test runner |
| `typescript` | Type safety |
| `electron-builder` | Packaging |

## Common Tasks

### Adding a new IPC channel
1. Add channel name to `src/shared/constants.ts` → `IPC` object
2. Add handler in `src/main/ipc-handlers.ts`
3. Expose in `src/preload/index.ts`
4. Call from renderer via `window.voiceflow.methodName()`

### Adding a new transcription provider
1. Create `src/main/services/transcription/NewProvider.ts` implementing `TranscriptionProvider`
2. Add mode to `TranscriptionMode` in `src/shared/types.ts`
3. Add branch to factory in `TranscriptionService.ts`
4. Add to schema (`SettingsSchema.ts`) and defaults (`constants.ts`)
5. Update `WhisperConfig.tsx` UI

### Adding a new verbal command
Add to `src/shared/command-definitions.ts`:
```typescript
{ phrase: 'my phrase', action: { type: 'key', key: 'Enter' }, category: 'keyboard', description: 'Presses Enter' }
```

### Adding a hotkey preset
1. Add to `PRESETS` map in `src/main/globalHotkey.ts` with uiohook key codes
2. Add to `HOTKEY_PRESETS` array in `HotkeyConfig.tsx`

### Adding a settings field
1. Add to `VoiceFlowSettings` in `src/shared/types.ts`
2. Add to `DEFAULT_SETTINGS` in `constants.ts`
3. Add to schema in `SettingsSchema.ts`
4. Add migration in `SettingsStore.ts` if needed
5. Add UI in the appropriate settings tab

## Known Issues

### Overlay shows "Ready" instead of "Recording"
Chromium throttles IPC to hidden windows. Mitigations: `backgroundThrottling: false`, direct `webContents.send()`, pull-on-mount via `RECORDING_GET_STATE`.

### ScriptProcessorNode deprecation
Deprecated in favor of AudioWorkletNode but works reliably in Electron. Future improvement.

### Large package size (~870MB)
Bundled whisper model is 466MB. Options: use tiny.en (75MB), download on first launch, or offer selection during install.

## Changelog (v1.0.0)
- Removed GPU acceleration (Vulkan) and OpenAI cloud provider
- Default hotkey: `Alt+Z`, default mode: `hold` (hold-to-talk)
- Settings migration for old installs
- Belt-and-suspenders overlay state sync
- Removed `openai`, `adm-zip` dependencies
