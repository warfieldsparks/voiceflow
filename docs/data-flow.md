# Data Flow: Recording Pipeline

## 1. Hotkey Press (Main Process)

`globalHotkey.ts` → `uiohook-napi` detects key combo → calls `startRecording()` in `index.ts`

```
startRecording() {
  setRecordingState('recording')          // Updates tray + broadcasts IPC.RECORDING_STATE
  showOverlay()                           // Shows overlay window
  overlay.webContents.send(RECORDING_STATE, 'recording')   // Direct send to overlay
  overlay.webContents.send(RECORDING_START)                 // Trigger audio capture
}
```

## 2. Audio Capture (Renderer — RecordingOverlay.tsx)

On `RECORDING_START` IPC message:
1. `navigator.mediaDevices.getUserMedia({ audio: { sampleRate: { ideal: 16000 } } })`
2. Create `AudioContext({ sampleRate: 16000 })`
3. Create `ScriptProcessorNode(4096, 1, 1)` — captures raw PCM Float32 samples
4. Each `onaudioprocess` event: push `new Float32Array(data)` to `pcmChunksRef`
5. Connect to `AnalyserNode` for waveform visualization

## 3. Hotkey Release / Stop (Main Process)

`globalHotkey.ts` detects key release → calls `stopRecording()` in `index.ts`

```
stopRecording() {
  setRecordingState('processing')         // Updates tray + broadcasts
  broadcastToRenderers(RECORDING_STOP)    // Tell renderer to finalize audio
}
```

## 4. WAV Encoding (Renderer — RecordingOverlay.tsx)

On `RECORDING_STOP` IPC message:
1. Concatenate all `pcmChunksRef` Float32Array chunks
2. `buildWav()` — writes 44-byte WAV header + converts Float32 → Int16 PCM
3. `window.voiceflow.sendAudioData(wavBuffer, 'wav')` → IPC to main process
4. Cleanup: disconnect processor, close AudioContext, stop MediaStream tracks

## 5. Transcription (Main Process — index.ts → TranscriptionService.ts)

On `IPC.AUDIO_DATA`:
1. `transcribe(audioBuffer, 'wav')` — factory creates provider based on settings
2. **Groq**: HTTP POST multipart form to `api.groq.com` (whisper-large-v3-turbo)
3. **Local**: POST to `http://127.0.0.1:18080/inference` (persistent whisper-server)
4. Returns `{ text: string, duration: number }`

## 6. Command Parsing (Main Process — CommandParser.ts)

`commandParser.parse(result.text)` returns `ParseResult`:
- Tokenizes text into words
- **Contextual mode**: Finds command phrases via trie, scores each with heuristics (position, isolation, grammar context), applies cluster boosting, accepts if score >= 0.5
- **Prefix mode**: Only triggers commands prefixed with "command" keyword
- Output: array of `{ type: 'text' | 'command', value, command? }` segments

## 7. Execution (Main Process — ActionExecutor.ts)

1. `hideOverlay()` — so keystrokes go to the right window
2. 150ms delay — let focus return to previous window
3. For each segment:
   - **Text**: `TextInjector.type()` → clipboard paste (save → write → Ctrl+V → restore) via nut-js
   - **Command key**: `keyboard.pressKey()` / `keyboard.releaseKey()` via nut-js
   - **Command combo**: Press all keys, release in reverse order
   - **Modifier**: Store pending modifier (capitalize/allCaps/noCaps), apply to next text segment

## 8. Completion (Main Process)

```
broadcastToRenderers(TRANSCRIPTION_RESULT, text)    // Show in overlay
broadcastToRenderers(COMMAND_EXECUTED, segments)     // Notify UI
setRecordingState('idle')                            // Back to ready
```
