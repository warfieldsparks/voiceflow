# Transcription

VoiceFlow is currently a Groq-only transcription app.

There is no active local Whisper runtime in the current codebase.

## Provider

Provider implementation:

- `src/main/services/transcription/TranscriptionService.ts`
- `src/main/services/transcription/GroqProvider.ts`

Type:

```ts
type TranscriptionMode = 'groq'
```

## Request Flow

The main process sends recorded audio to:

```text
https://api.groq.com/openai/v1/audio/transcriptions
```

Request characteristics:

- multipart form-data
- file field with WAV payload
- model: `whisper-large-v3-turbo`
- language: `en`
- temperature: `0`
- response format: `json`

## Audio Format

The overlay records:

- mono
- 16 kHz
- 16-bit PCM WAV

That keeps the path simple and makes diagnostics easy to reason about.

## Readiness Rules

Transcription is considered ready when a Groq API key is present in settings.

If the key is missing:

- diagnostics report it
- transcription calls fail fast with a clear error

## Timeouts And Aborts

There are several relevant timeout layers.

### Provider-level request timeout

The raw HTTPS request has:

- socket timeout
- hard deadline of `30s`
- external abort support through `AbortSignal`

### Pipeline-level timeout

The main process also wraps transcription in its own timeout guard before command execution continues.

## Error Handling

Groq errors are normalized into readable messages where possible.

Examples:

- missing API key
- HTTP error from Groq
- request timeout
- aborted request
- malformed response

The provider logs both the request lifecycle and API failures to the persistent log file.

## Diagnostics Support

The diagnostics screen has two relevant paths:

- `Check System`: verifies the API key is configured
- `Test Mic + Transcribe`: records a short local sample, builds a WAV, and runs the same transcription path used by the real app

That second path is especially useful because it validates:

- microphone permissions
- audio capture
- WAV construction
- IPC transport
- Groq transcription

## Why This Is Groq-Only

The repo previously had more transcription complexity, but the current runtime intentionally stays narrow:

- simpler configuration
- fewer bundled binaries
- fewer moving parts during startup
- lower maintenance burden

If local transcription returns in the future, the docs in this file should be updated only after the runtime path exists again.
