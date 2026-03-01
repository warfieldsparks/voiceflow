# VoiceFlow — Desktop Voice Dictation with Verbal Commands

A Wispr Flow-inspired desktop app that transcribes speech and injects text + keyboard commands into any active window. Built with Electron, TypeScript, and React.

## Quick Start

```bash
npm install
npm run build
npx electron-builder --win    # Build Windows installer
```

Or run in dev mode:
```bash
npm run dev
```

## Requirements

- Node.js 18+
- Windows (primary target, macOS/Linux possible with changes)
- For cloud transcription: free Groq API key from [console.groq.com](https://console.groq.com/keys)

## Usage

1. App starts in the system tray
2. Focus any app (terminal, editor, browser, etc.)
3. Hold **Alt+Z** to record (default hotkey, hold-to-talk mode)
4. Speak naturally — say commands like "enter", "period", "select all"
5. Release **Alt+Z** — text and commands are transcribed and injected
6. Text and keystrokes appear in the focused app

## Example

Say: "hello world period new paragraph how are you question mark"

Output:
```
hello world.

how are you?
```

## Transcription

Uses **Groq Cloud** (free API) with Whisper large-v3-turbo. Near-instant (~0.5s), 2000 requests/day free tier. Get a key at [console.groq.com/keys](https://console.groq.com/keys).

## Hotkey Presets

| Hotkey | Description |
|--------|-------------|
| **Alt+Z** | Default — quick two-key |
| Ctrl+Win | Same as Wispr Flow |
| Ctrl+Shift+Space | Classic |
| Ctrl+Alt+Space | WhisperWriter style |
| F9 | Single key |

Two recording modes: **Hold** (default — hold to record, release to stop) and **Toggle** (press to start, press to stop).

## Verbal Commands (~60 built-in)

- **Keys:** enter, tab, backspace, delete, escape, space bar
- **Navigation:** arrow up/down/left/right, home, end, page up/down
- **Editing:** select all, copy, paste, cut, undo, redo
- **Punctuation:** period, comma, question mark, exclamation point, colon, semicolon, open/close quote/paren/bracket, hyphen, dash, ellipsis, at sign, hashtag, dollar sign, percent, asterisk, slash, backslash, pipe, tilde, underscore, equals, plus sign
- **Formatting:** new paragraph, capitalize, all caps, no caps
- **Custom:** define your own trigger phrases in Settings > Commands

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev mode with hot reload |
| `npm run build` | Build renderer (Vite) + main (tsc) |
| `npm run package` | Build + package as Windows installer |
| `npm test` | Run unit tests |

## Settings

Tray icon → Settings, or auto-opens on first launch.

- **Diagnostic** — system info, API key check, test transcription
- **General** — startup behavior, overlay position, typing speed
- **Hotkeys** — 5 presets (including Ctrl+Win), toggle vs hold mode
- **Commands** — contextual vs prefix detection, custom commands
- **Whisper** — Groq API key config
- **Audio** — microphone selection, silence threshold, auto-stop timer

## Tech Stack

- **Electron 33** — desktop framework
- **TypeScript** — all source code
- **React 18 + Vite 6** — renderer UI
- **uiohook-napi** — global hotkeys (Win key support, hold-to-record)
- **@nut-tree-fork/nut-js** — keyboard simulation
- **Groq API** — speech-to-text (Whisper large-v3-turbo)
- **electron-store** — settings persistence
- **electron-builder** — Windows installer packaging
