# IPC Channels

All channels are defined in `src/shared/constants.ts`.

## Active Recording Channels

| Channel | Direction | Purpose |
| --- | --- | --- |
| `recording:start` | main -> renderer | begin microphone capture for a session |
| `recording:stop` | main -> renderer | finalize WAV and send audio |
| `recording:abort` | main -> renderer | force-reset a session |
| `recording:state` | main -> renderer | sync `idle`, `recording`, `processing` |
| `recording:captureStarted` | renderer -> main | renderer confirmed microphone setup |
| `recording:captureFailed` | renderer -> main | renderer failed to start capture |
| `recording:noAudio` | renderer -> main | stop completed but there was no usable audio |
| `recording:getState` | renderer -> main (`invoke`) | pull current runtime state on mount |

## Audio And Transcription

| Channel | Direction | Purpose |
| --- | --- | --- |
| `audio:data` | renderer -> main | WAV payload for a session |
| `transcribe:run` | renderer -> main (`invoke`) | direct transcription call used by diagnostics |
| `transcription:cancel` | renderer -> main | abort active transcription/pipeline |
| `transcription:result` | main -> renderer | raw transcribed text |
| `transcription:error` | main -> renderer | user-visible transcription/pipeline error |

## Commands

| Channel | Direction | Purpose |
| --- | --- | --- |
| `command:executed` | main -> renderer | parsed segments after execution |

## Settings

| Channel | Direction | Purpose |
| --- | --- | --- |
| `settings:get` | renderer -> main (`invoke`) | read one setting |
| `settings:getAll` | renderer -> main (`invoke`) | read all settings |
| `settings:set` | renderer -> main (`invoke`) | update one setting |
| `settings:reset` | renderer -> main (`invoke`) | reset to defaults |

## App And Diagnostics

| Channel | Direction | Purpose |
| --- | --- | --- |
| `app:status` | renderer -> main (`invoke`) | diagnostic app status payload |
| `app:quit` | renderer -> main | exit the app |
| `app:showSettings` | renderer -> main | bring settings window forward |
| `app:openLogs` | renderer -> main (`invoke`) | open the logs folder |
| `diagnostic:run` | renderer -> main (`invoke`) | run system diagnostic checks |
| `diagnostic:transcribeTest` | renderer -> main (`invoke`) | transcribe a local test WAV |
| `log:event` | renderer/preload -> main | append an external log line to the unified log |

## Reserved Or Currently Unused Channels

These names still exist in `constants.ts`, but they are not part of the main active flow today:

- `audio:level`
- `recording:toggle`
- `audio:devices`
- `window:minimize`
- `window:close`

Keep that distinction clear if you extend the IPC layer. A defined constant is not automatically a live feature.

## Preload API

The renderer consumes IPC through `window.voiceflow`.

### Recording

- `onRecordingStart(callback)`
- `onRecordingStop(callback)`
- `onRecordingAbort(callback)`
- `onRecordingState(callback)`
- `getRecordingState()`
- `sendAudioData(payload)`
- `notifyRecordingCaptureStarted(payload)`
- `notifyRecordingCaptureFailed(payload)`
- `notifyRecordingNoAudio(payload)`

### Transcription

- `cancelTranscription()`
- `transcribe(audioBuffer, format?)`
- `onTranscriptionResult(callback)`
- `onTranscriptionError(callback)`

### Commands

- `onCommandExecuted(callback)`

### Settings

- `getSettings()`
- `getSetting(key)`
- `setSetting(key, value)`
- `resetSettings()`

### App

- `getAppStatus()`
- `quit()`
- `showSettings()`
- `openLogsFolder()`

### Diagnostics

- `runDiagnostic()`
- `testTranscription(wavBuffer)`

### Logging And Shell

- `logEvent(payload)`
- `openExternal(url)`

All `on*` methods return a cleanup function and should be unsubscribed in `useEffect` cleanup handlers.
