# VoiceFlow

VoiceFlow is a Windows-first desktop dictation app built with Electron, TypeScript, and React. It records speech, sends audio to Groq Whisper, parses spoken commands, and injects text and keyboard actions into the currently focused app.

The repository is public at:
`https://github.com/warfieldsparks/voiceflow`

The current Windows installer is published at:
`https://github.com/warfieldsparks/voiceflow/releases/tag/v1.0.0`

## What It Does

- Global hotkeys that work while the app is in the background
- Hold-to-record or toggle-to-record modes
- Groq Whisper transcription with abort and timeout handling
- Built-in spoken punctuation, editing, navigation, and formatting commands
- Persistent logs for main, renderer, preload, and crash paths
- System tray control plus an in-app `Turn Off VoiceFlow` button
- Windows-native `Ctrl+Win` helper to suppress the Start menu reliably

## Install

1. Download the latest installer from the GitHub Releases page.
2. Run `VoiceFlow.Setup.1.0.0.exe`.
3. Open Settings.
4. Add your Groq API key in `Whisper`.
5. Choose a hotkey and recording mode in `Hotkeys`.
6. Focus another app and start dictating.

Because the release artifact is an NSIS installer, VoiceFlow registers like a normal installed Windows app and appears in Apps/Control Panel.

## First Run

VoiceFlow creates:

- A tray icon
- A settings window
- A hidden overlay window used during recording
- A persistent log file in the app's Electron `userData/logs` directory

If `Start minimized to tray` is enabled, the settings window will not open automatically on startup.

## Basic Usage

1. Leave VoiceFlow running in the tray.
2. Focus the target app where text should be typed.
3. Trigger your configured hotkey.
4. Speak naturally.
5. Release the hotkey in hold mode, or press it again in toggle mode.
6. VoiceFlow transcribes, parses commands, and types into the active app.

Example:

Say:

```text
hello world period new paragraph how are you question mark
```

Output:

```text
hello world.

how are you?
```

## Hotkeys

Available presets:

- `Ctrl+Win`
- `Ctrl+Shift+Space`
- `Ctrl+Alt+Space`
- `Alt+Z`
- `F9`

Hotkey routing is split deliberately:

- `Alt+Z`, `Ctrl+Shift+Space`, `Ctrl+Alt+Space`, and `F9` use Electron `globalShortcut` where possible so the trigger key does not leak into the target app.
- `Ctrl+Win` uses a bundled native Windows helper to intercept the combo and stop the Start menu from opening.
- `uiohook-napi` remains the fallback and the release detector for hold mode.

## Recording Modes

- `Hold to Record`: hold the combo to record, release any key in the combo to stop.
- `Toggle`: press once to start, press again to stop.

## Built-In Commands

VoiceFlow ships with 61 built-in commands:

- `keyboard`: 6
- `navigation`: 8
- `editing`: 6
- `punctuation`: 36
- `formatting`: 5

Examples:

- `enter`
- `select all`
- `copy`
- `undo`
- `period`
- `question mark`
- `open paren`
- `new paragraph`
- `capitalize`

Custom commands can be added in Settings. The current UI supports custom commands that either type text or press a single key.

## Diagnostics And Logging

The `Diagnostics` tab can:

- Check whether the Groq API key is configured
- Report the active hotkey and mode
- Record a 3-second microphone sample
- Send that sample through the full transcription path
- Open the persistent logs folder
- Quit the app from inside the UI

Logging details:

- Logs are written to `userData/logs/voiceflow-YYYY-MM-DD.log`
- Early boot logs are buffered until the app path is ready
- Main-process uncaught exceptions and unhandled rejections are logged
- Renderer console errors and preload-originated events are forwarded into the same log stream
- Log rotation starts at 5 MB

## Exit Behavior

There are multiple ways to stop VoiceFlow:

- `Turn Off VoiceFlow` in the left settings sidebar
- `Quit` from the tray menu
- `Quit VoiceFlow` inside `Diagnostics`

Closing the settings window does not shut down the tray process by itself. Use one of the explicit quit actions above when you want the process to exit completely.

## Development

Prerequisites:

- Node.js 18+
- npm
- Windows for normal runtime testing
- Wine if you package Windows installers from Linux
- `x86_64-w64-mingw32-gcc` if you need to rebuild the bundled `Ctrl+Win` helper on Linux

Commands:

```bash
npm install
npm run dev
npm test
npm run build
```

Windows packaging:

```bash
npm run package
```

Linux cross-build recipe used in this repo:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis -c.win.signAndEditExecutable=false
```

## Repo Guide

Detailed documentation lives in [`docs/`](./docs):

- [`architecture.md`](./docs/architecture.md)
- [`building.md`](./docs/building.md)
- [`commands.md`](./docs/commands.md)
- [`data-flow.md`](./docs/data-flow.md)
- [`file-reference.md`](./docs/file-reference.md)
- [`ipc-channels.md`](./docs/ipc-channels.md)
- [`settings.md`](./docs/settings.md)
- [`transcription.md`](./docs/transcription.md)
- [`troubleshooting.md`](./docs/troubleshooting.md)
- [`releasing.md`](./docs/releasing.md)
