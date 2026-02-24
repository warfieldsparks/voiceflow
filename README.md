# VoiceFlow — Desktop Voice Dictation with Verbal Commands

## Quick Start

```bash
tar xzf voiceflow.tar.gz
cd voiceflow
npm install
cp .env.example .env
# Edit .env — add your OpenAI API key
npm run dev
```

## Requirements

- Node.js 18+
- A desktop OS (macOS, Windows, or Linux with X11/Wayland)
- OpenAI API key (for cloud transcription)

## Usage

1. App starts in the system tray
2. Focus any app (terminal, editor, browser, etc.)
3. Press **Ctrl+Shift+Space** to start recording
4. Speak naturally — say commands like "enter", "period", "select all"
5. Press **Ctrl+Shift+Space** again to stop
6. Text and keystrokes appear in the focused app

## Example

Say: "hello world period new paragraph how are you question mark"

Output:
```
hello world.

how are you?
```

## Scripts

- `npm run dev` — Launch in development mode with hot reload
- `npm test` — Run unit tests (74 tests)
- `npm run build` — Build for production
- `npm run package` — Package as installable binary

## Settings

Press the tray icon → Settings, or the app opens settings on first run.

- **General** — start minimized, sound feedback, typing speed
- **Hotkeys** — change the global hotkey
- **Commands** — contextual vs prefix mode, add custom commands
- **Whisper** — cloud (OpenAI API) or local (whisper.cpp)
- **Audio** — microphone selection, silence threshold
