# Architecture

VoiceFlow is an Electron app with a strict split between:

- `main`: hotkeys, state machine, tray, transcription, command execution, logging
- `renderer`: microphone capture, overlay UI, settings UI
- `preload`: typed IPC bridge exposed as `window.voiceflow`

At a high level:

```text
Global hotkey
  -> start recording session
  -> renderer captures WAV audio
  -> main transcribes with Groq Whisper
  -> command parser splits text vs spoken commands
  -> action executor injects text and key presses
  -> session returns to idle
```

## Process Responsibilities

### Main Process

Owns the application runtime:

- Single-instance lock
- Tray lifecycle
- Hidden overlay window lifecycle
- Settings window lifecycle
- Recording session IDs and state transitions
- Transcription and command parsing
- Keyboard injection
- Persistent logging

Primary files:

- `src/main/index.ts`
- `src/main/globalHotkey.ts`
- `src/main/ipc-handlers.ts`
- `src/main/tray.ts`
- `src/main/window-manager.ts`

### Renderer Process

Owns the UI and microphone capture:

- Overlay bar states: `idle`, `recording`, `processing`
- Microphone acquisition through `getUserMedia`
- PCM chunk capture and WAV encoding
- Settings panels
- Diagnostics UI

Primary files:

- `src/renderer/components/overlay/RecordingOverlay.tsx`
- `src/renderer/components/settings/SettingsPanel.tsx`
- `src/renderer/components/settings/DiagnosticPanel.tsx`

### Preload

Owns the safe bridge between renderer and main:

- Exposes `window.voiceflow`
- Wraps `ipcRenderer.on`, `send`, and `invoke`
- Keeps renderer code away from direct Electron imports

Primary file:

- `src/preload/index.ts`

## Recording State Machine

The runtime state machine lives in `src/main/index.ts`.

States:

- `idle`
- `recording`
- `processing`

Important properties:

- Recording is session-based, not fire-and-forget.
- Every recording request gets a `sessionId`.
- Stale renderer events and stale audio payloads are rejected.
- Multiple timeout layers force recovery instead of letting the app hang forever.

Timers:

- microphone start timeout: `15s`
- audio delivery timeout after stop: `8s`
- transcription timeout: `30s`
- action execution timeout: `10s`
- overall processing watchdog: `45s`

## Hotkey Architecture

The hotkey system is intentionally layered.

### Path 1: Electron `globalShortcut`

Used for hotkeys with a real accelerator key:

- `Alt+Z`
- `Ctrl+Shift+Space`
- `Ctrl+Alt+Space`
- `Ctrl+Shift+Z`
- `F9`

This is the preferred path because it keeps the trigger key from leaking into the target app.

### Path 2: Native Windows `Ctrl+Win` helper

`Ctrl+Win` is special:

- Electron accelerators do not handle modifier-only combos well enough
- Synthetic suppression alone was not reliable
- Windows can open the Start menu if the combo is not intercepted at the right level

VoiceFlow now ships a native low-level keyboard hook helper:

- source: `native/windows/ctrl_win_hotkey_helper.c`
- runtime wrapper: `src/main/services/hotkeys/WindowsCtrlWinHelper.ts`
- packaged location: `resources/bin/win32/voiceflow-ctrl-win-helper.exe`

The helper emits:

- `READY`
- `DOWN`
- `UP`

The main process converts those into the normal VoiceFlow hold/toggle callbacks.

### Path 3: `uiohook-napi`

Still used for:

- general low-level key observation
- hold-mode release handling
- fallback behavior when another path is unavailable

## Logging Architecture

The logger is centralized in `src/main/utils/logger.ts`.

Key behaviors:

- writes to one file per day
- buffers early startup logs
- rotates after 5 MB
- logs uncaught exceptions and unhandled rejections
- accepts external events from renderer and preload

Sources recorded in each line:

- `main`
- `renderer`
- `preload`

## Command Execution Architecture

Pipeline after transcription:

1. `CommandParser` splits the transcript into text and command segments.
2. `ActionExecutor` walks the parsed segments.
3. `TextInjector` either pastes whole text or types it character by character.
4. Key and combo commands are executed with `@nut-tree-fork/nut-js`.

Important detail:

- The overlay is hidden before text injection so the target app regains focus before keys are emitted.

## Persistence

Two different persistence layers exist:

- settings: `electron-store` via `SettingsStore.ts`
- logs: raw append-only log files via `logger.ts`

The settings store uses defaults plus a manual migration path. It does not currently use strict `clearInvalidConfig` behavior, because that previously caused user data loss.

## Project Layout

Key runtime areas:

```text
src/main/
  index.ts
  globalHotkey.ts
  ipc-handlers.ts
  tray.ts
  window-manager.ts
  services/
    commands/
    hotkeys/
    keyboard/
    settings/
    transcription/
  utils/

src/preload/
  index.ts

src/renderer/
  App.tsx
  main.tsx
  components/
    overlay/
    settings/
  hooks/
  styles/

src/shared/
  constants.ts
  types.ts
  command-definitions.ts

native/windows/
  ctrl_win_hotkey_helper.c

scripts/
  build-ctrl-win-helper.mjs
```
