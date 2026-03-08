# Data Flow

This document describes the end-to-end recording pipeline as it exists today.

## Session Model

Every recording request gets a monotonically increasing `sessionId`.

That `sessionId` is carried through:

- `recording:start`
- `recording:stop`
- renderer microphone events
- `audio:data`
- abort and error paths

This prevents stale renderer events from reviving an old recording or keeping the app stuck in `processing`.

## Step 1: Hotkey Press

The hotkey subsystem calls into `startRecording()` in `src/main/index.ts`.

Main-process effects:

- allocate a new `sessionId`
- set state to `recording`
- show the overlay
- arm the microphone-start timeout
- wait for the overlay window to be ready
- send `recording:start` with the session payload

## Step 2: Renderer Arms Microphone Capture

`RecordingOverlay.tsx` receives `recording:start` and:

1. requests microphone access
2. creates an `AudioContext`
3. creates a `ScriptProcessorNode`
4. starts collecting PCM chunks
5. reports `recording:captureStarted`

If setup fails, the renderer sends:

- `recording:captureFailed`

If a stop arrives before capture is armed, the renderer reports:

- `recording:noAudio`

## Step 3: Stop Request

Stopping can come from several paths:

- hotkey release in hold mode
- hotkey press in toggle mode
- tray `Stop Recording`
- overlay cancel button

Main-process effects:

- clear the capture-start timeout
- move state to `processing`
- arm the audio-delivery timeout
- send `recording:stop` to the overlay

## Step 4: Renderer Finalizes Audio

The renderer:

1. concatenates all PCM chunks
2. writes a 44-byte WAV header
3. converts float samples to 16-bit PCM
4. sends `audio:data`

If the captured audio is empty or invalid, the renderer reports `recording:noAudio` instead of sending useless payloads.

## Step 5: Main Process Accepts Audio

The main process rejects any audio that is:

- from a stale `sessionId`
- received while the state is not `processing`

Accepted audio starts a new pipeline generation:

- any previous abort controller is cancelled
- a new abort controller is created
- stale pipeline results are ignored

## Step 6: Transcription

`TranscriptionService.ts` creates a `GroqProvider` and sends the WAV data to:

```text
https://api.groq.com/openai/v1/audio/transcriptions
```

The provider enforces:

- API-key presence
- socket timeout
- hard request deadline
- external abort support

## Step 7: Command Parsing

If transcription text is non-empty:

1. `CommandParser` tokenizes and scores candidate commands
2. it returns parsed segments
3. the main process broadcasts the raw transcript to the renderer

The overlay is then hidden before any typing starts.

## Step 8: Action Execution

`ActionExecutor.execute(parsed)` runs with its own timeout.

Segment handling:

- text segments -> `TextInjector`
- key segments -> single key press
- combo segments -> key combo
- modifier segments -> formatting state applied to the next text segment

## Step 9: Completion

On success:

- command execution results are broadcast
- `activeSessionId` is cleared
- state returns to `idle`

On failure:

- the error is broadcast through `transcription:error`
- the overlay is hidden
- the session is reset back to `idle`

## Force-Reset Paths

The pipeline can be force-reset from:

- processing watchdog timeout
- capture start timeout
- audio delivery timeout
- renderer-side cancel
- tray abort
- hotkey cancel while already processing
- app shutdown

`forceResetPipeline()`:

- aborts active work
- clears timers
- notifies the renderer with `recording:abort`
- clears `activeSessionId`
- hides the overlay
- returns to `idle`

## Timers

Current timeout values:

- microphone start timeout: `15,000 ms`
- audio delivery timeout: `8,000 ms`
- transcription timeout: `30,000 ms`
- action execution timeout: `10,000 ms`
- processing watchdog: `45,000 ms`

## Why The Session Logic Matters

Without the session and timeout layers, a dictation app tends to fail in exactly the ways users hate:

- transcribing forever
- recording forever
- double-starting
- typing stale transcripts into the wrong app
- becoming recoverable only by killing the process

The current pipeline is designed specifically to prevent those classes of failure.
