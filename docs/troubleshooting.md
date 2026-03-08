# Troubleshooting

This file documents the failure modes that matter in practice.

## First Rule: Open The Logs

Use:

- `Settings -> Diagnostics -> Open Logs Folder`

The app writes a persistent log file for:

- main process
- renderer events
- preload-originated log events
- uncaught exceptions
- unhandled rejections

If a bug cannot be reproduced locally in source, the log is the fastest path to the root cause.

## No Transcription Happens

Check:

1. `Settings -> Whisper` has a valid Groq API key
2. `Diagnostics -> Check System` reports `[OK] Groq API key is configured`
3. `Diagnostics -> Test Mic + Transcribe` completes

Likely causes:

- missing API key
- microphone permissions denied
- network failure reaching Groq
- Groq timeout

## It Looks Like It Is Recording Forever

The current app has explicit recovery paths for this, so if it still happens the log matters.

Ways to recover immediately:

- click the overlay `X`
- use tray `Abort Current Session`
- press the hotkey again in toggle mode
- use `Turn Off VoiceFlow` if you want to kill the process entirely

Relevant log clues:

- `capture start timeout`
- `audio delivery timeout`
- `processing watchdog timeout`
- `Discarding audio from stale session`
- `Force-resetting active session`

## The Start Menu Opens On `Ctrl+Win`

Make sure you are running the current build from the GitHub release, not an older local installer or portable ZIP.

The working build includes:

- `voiceflow-ctrl-win-helper.exe`

What to check in logs:

- `Ctrl+Win helper ready`
- `Started Ctrl+Win helper`
- `Ctrl+Win helper exited`
- fallback warnings from `globalHotkey.ts`

If the helper is missing or failing to start, `Ctrl+Win` may fall back to less reliable suppression.

## The Hotkey Types Characters Into The Target App

For hotkeys like `Alt+Z`, the intended runtime path is `globalShortcut`.

If the trigger key leaks:

1. confirm you are on the latest build
2. switch to another preset and back
3. inspect logs for accelerator registration failures

Relevant log clues:

- `Registered accelerator trigger`
- `globalShortcut registration failed`
- `globalShortcut registration threw`

## The App Window Closed But VoiceFlow Is Still Running

That is normal if you only closed the settings window.

To fully stop the app:

- use `Turn Off VoiceFlow` in the left sidebar
- use `Quit` from the tray
- use `Quit VoiceFlow` in Diagnostics

## Text Is Not Being Typed Into The Right App

VoiceFlow hides the overlay before injection and waits briefly for focus to return. If typing still lands in the wrong place:

- make sure the destination app is focused before stopping dictation
- avoid clicking inside VoiceFlow right before transcription completes
- inspect the log around action execution and overlay hide timing

## Audio Settings Do Not Seem To Change The Main Recorder

That observation is currently correct.

Today:

- the audio tab stores the settings
- the test-microphone flow uses the selected device
- the main overlay recorder still requests the default microphone directly

If someone reports this as a bug, point them here instead of pretending the setting is already wired.

## Launch At Login Does Nothing

That setting is currently stored but not connected to Electron login-item registration. It is a saved preference, not a fully implemented OS startup feature yet.

## What To Include In A Bug Report

Minimum useful report:

- exact installer version or release URL
- selected hotkey and mode
- whether the issue is on Windows only
- the relevant log excerpt
- whether `Diagnostics -> Test Mic + Transcribe` passes
