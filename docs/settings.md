# Settings

VoiceFlow stores user settings with `electron-store`.

## Storage

Settings are persisted in the app's Electron `userData` directory as:

```text
voiceflow-settings.json
```

The log file is separate and lives under:

```text
userData/logs/
```

## Default Settings

```ts
{
  hotkey: 'Alt+Z',
  hotkeyMode: 'hold',
  transcription: {
    mode: 'groq',
    groqApiKey: '',
  },
  commands: {
    detectionMode: 'contextual',
    prefixWord: 'command',
    literalEscape: 'literal',
    customCommands: [],
  },
  audio: {
    inputDeviceId: 'default',
    silenceThreshold: 0.02,
    autoStopAfterSilence: 5000,
  },
  ui: {
    overlayPosition: 'top',
    showWaveform: true,
    soundFeedback: true,
    startMinimized: false,
    launchAtLogin: false,
  },
  typing: {
    speed: 0,
  },
}
```

## Settings Areas

### General

- start minimized to tray
- launch at login
- sound feedback
- waveform visibility
- overlay position
- typing speed

### Hotkeys

- preset selection
- hold vs toggle mode

### Commands

- contextual vs prefix detection
- prefix word
- literal escape word
- custom commands

### Whisper

- Groq API key only

### Audio

- input device selection
- microphone test UI
- silence threshold
- auto-stop-after-silence

### Diagnostics

- app status
- test transcription
- logs shortcut
- quit actions

## Runtime Side Effects

Some setting writes trigger immediate runtime changes.

### `hotkey`

Changing the hotkey calls `updateHotkey()` and re-registers the runtime shortcut.

### `hotkeyMode`

Changing the mode calls `updateHotkeyMode()` and updates hold/toggle behavior without restarting the app.

## Migration Rules

The settings store performs a small manual migration pass to clean up old installs.

Fields removed from older versions:

- `transcription.apiKey`
- `transcription.useGpu`
- `transcription.localModel`

Old modes remapped:

- `cloud` -> `groq`
- `local` -> `groq`

## Important Implementation Detail

`SettingsSchema.ts` exists as a structured description of the current setting shapes, but the runtime store currently relies on:

- defaults
- explicit writes
- targeted migration

It does not use strict config auto-clearing. That is deliberate because aggressive validation previously caused destructive resets.

## Current Limitations

These settings are persisted, but not all of them are fully wired into the main runtime yet.

### `launchAtLogin`

The toggle is stored and shown in the UI, but the current codebase does not yet call Electron login-item APIs to register startup with the OS.

### Audio Capture Preferences

The `Audio` tab stores:

- selected input device
- silence threshold
- auto-stop timing

Today:

- the `Test Microphone` tool uses the selected device
- the main overlay recorder still requests the default microphone directly
- silence threshold and auto-stop values are stored but not yet enforced by the main recording pipeline

Documenting that honestly is better than implying the runtime already honors those settings end to end.
