# File Reference

This is a practical map of the files you will actually touch when debugging or extending VoiceFlow.

## Core Runtime

### `src/main/index.ts`

Main entry point.

Owns:

- app startup
- single-instance lock
- session allocation
- state transitions
- timeout orchestration
- transcription and execution pipeline

If recording gets stuck, start here.

### `src/main/globalHotkey.ts`

Hotkey coordinator.

Owns:

- preset definitions
- `globalShortcut` registration
- `uiohook` fallback and hold-release behavior
- native `Ctrl+Win` helper integration

If a hotkey leaks characters or fires incorrectly, start here.

### `src/main/services/hotkeys/WindowsCtrlWinHelper.ts`

Spawn wrapper for the native Windows helper.

Owns:

- helper path resolution
- helper lifecycle
- `DOWN` / `UP` event handling
- fallback when the helper exits unexpectedly

### `native/windows/ctrl_win_hotkey_helper.c`

Low-level Windows keyboard hook.

Owns:

- intercepting `Ctrl+Win`
- swallowing the shell-triggering key path
- emitting simple stdout events to Electron

### `scripts/build-ctrl-win-helper.mjs`

Build script for the helper binary.

Use this when the native helper source changes.

## IPC And Logging

### `src/preload/index.ts`

The only renderer-safe bridge into main-process behavior.

If you add a new IPC entry point, update this file.

### `src/main/ipc-handlers.ts`

Centralized IPC registration.

Owns:

- settings get/set/reset
- diagnostics
- direct transcription test path
- quit and open-logs actions
- renderer log ingestion

### `src/main/utils/logger.ts`

Persistent logging implementation.

Owns:

- daily log files
- boot buffering
- rotation
- crash logging
- external log event ingestion

## Windows And Tray

### `src/main/tray.ts`

Tray icon and menu construction.

If the tray labels, tooltip, or abort/quit actions are wrong, update this file.

### `src/main/window-manager.ts`

BrowserWindow creation.

Owns:

- overlay window configuration
- settings window configuration
- overlay-ready synchronization

## Transcription

### `src/main/services/transcription/TranscriptionService.ts`

Current transcription entry point.

This repo is Groq-only today.

### `src/main/services/transcription/GroqProvider.ts`

Low-level Groq multipart upload implementation with timeouts and abort handling.

If Groq failures are unclear or the request format changes, update this file.

## Commands And Typing

### `src/shared/command-definitions.ts`

The built-in spoken command catalog.

### `src/main/services/commands/CommandParser.ts`

Parser entry point.

### `src/main/services/commands/CommandRegistry.ts`

Phrase lookup structure.

### `src/main/services/commands/SmartDetection.ts`

Contextual scoring rules.

### `src/main/services/keyboard/ActionExecutor.ts`

High-level action runner for text, keys, combos, sequences, and modifiers.

### `src/main/services/keyboard/TextInjector.ts`

Text insertion implementation, including clipboard-preserving paste mode.

## Settings

### `src/shared/constants.ts`

Source of truth for:

- IPC channel names
- default settings

### `src/shared/types.ts`

Shared runtime types used by main, preload, and renderer.

### `src/main/services/settings/SettingsStore.ts`

Settings persistence and migration logic.

### `src/main/services/settings/SettingsSchema.ts`

Current structured schema reference for settings shape and defaults.

## Renderer UI

### `src/renderer/components/overlay/RecordingOverlay.tsx`

Most important renderer file.

Owns:

- microphone capture
- WAV encoding
- transcription result display
- cancel/abort behavior
- session tracking inside the renderer

### `src/renderer/components/settings/SettingsPanel.tsx`

Top-level settings screen and left sidebar, including `Turn Off VoiceFlow`.

### `src/renderer/components/settings/HotkeyConfig.tsx`

Visible hotkey preset list and mode selector.

### `src/renderer/components/settings/DiagnosticPanel.tsx`

Operational tools:

- `Check System`
- `Test Mic + Transcribe`
- `Open Logs Folder`
- `Quit VoiceFlow`

### `src/renderer/components/settings/CommandEditor.tsx`

Custom commands UI.

### `src/renderer/components/settings/WhisperConfig.tsx`

Groq API key screen.

### `src/renderer/components/settings/AudioConfig.tsx`

Audio device listing and test-microphone panel.

## Packaging

### `electron-builder.yml`

Packaging rules, exclusions, unpack rules, and extra resources.

### `resources/bin/win32/voiceflow-ctrl-win-helper.exe`

Compiled native helper that must ship with packaged Windows builds.
