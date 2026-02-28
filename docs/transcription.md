# Transcription System

## Two Providers

| Provider | Mode | API | Model | Speed | Cost |
|----------|------|-----|-------|-------|------|
| **Groq** (default) | `'groq'` | `api.groq.com` | whisper-large-v3-turbo | ~0.5s | Free (2000 req/day) |
| **Local** | `'local'` | `127.0.0.1:18080` or CLI | small.en (466MB) | 2-5s CPU | Free, private |

## Groq Provider Details
- Uses raw `https.request()` — no external HTTP library needed
- Multipart form-data: file + model + language + temperature + response_format
- Returns `{ text: "..." }` JSON
- 30 second timeout
- Requires API key from `console.groq.com/keys`

## Local Provider Details
- **Preferred**: Persistent whisper-server on port 18080
  - Kept running between transcriptions (model stays in memory)
  - Started on first use, health-checked each time
  - Auto-restarts if model changes
  - Multipart POST to `/inference` endpoint
  - Uses half of CPU cores
- **Fallback**: whisper-cli subprocess
  - Used when whisper-server binary not found
  - Loads model from disk each time (slower)
  - Writes temp WAV, reads `.txt` output

## Audio Format
All audio is captured as **16kHz, mono, 16-bit PCM WAV**. This is the native format whisper.cpp expects — no conversion needed.
