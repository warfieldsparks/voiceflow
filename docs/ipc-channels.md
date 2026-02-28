# IPC Channel Reference

All channels defined in `src/shared/constants.ts` as the `IPC` object.

## Audio
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `audio:data` | Renderer → Main | `ipcMain.on` | Raw WAV ArrayBuffer + format string |
| `audio:level` | Main → Renderer | broadcast | Audio level updates (unused currently) |

## Recording Control
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `recording:start` | Main → Renderer | broadcast | Tells renderer to start capturing audio |
| `recording:stop` | Main → Renderer | broadcast | Tells renderer to stop + send WAV |
| `recording:toggle` | — | — | Defined but unused (toggle is main-process-only) |
| `recording:state` | Main → Renderer | broadcast | State change: `'idle'`/`'recording'`/`'processing'` |
| `recording:getState` | Renderer → Main | `ipcMain.handle` | Pull current state (belt-and-suspenders sync) |

## Transcription
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `transcribe:run` | Renderer → Main | `ipcMain.handle` | Direct transcription call (used by diagnostics) |
| `transcription:cancel` | Renderer → Main | `ipcMain.on` | Cancel in-progress transcription |
| `transcription:result` | Main → Renderer | broadcast | Transcription text result |
| `transcription:error` | Main → Renderer | broadcast | Transcription error message |

## Commands
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `command:executed` | Main → Renderer | broadcast | Parsed segments after execution |

## Settings
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `settings:get` | Renderer → Main | `ipcMain.handle` | Get single setting by key |
| `settings:set` | Renderer → Main | `ipcMain.handle` | Set single setting (triggers side effects) |
| `settings:getAll` | Renderer → Main | `ipcMain.handle` | Get all settings |
| `settings:reset` | Renderer → Main | `ipcMain.handle` | Reset all to defaults |

## Models
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `model:list` | Renderer → Main | `ipcMain.handle` | List available whisper models |
| `model:download` | Renderer → Main | `ipcMain.handle` | Download a model by name |
| `model:downloadProgress` | Main → Renderer | broadcast | Download progress `{ modelName, percent }` |

## App
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `app:status` | Renderer → Main | `ipcMain.handle` | Get app status (transcription ready?) |
| `app:quit` | Renderer → Main | `ipcMain.send` | Quit the app |
| `app:showSettings` | Renderer → Main | `ipcMain.send` | Show settings window |

## Window
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `window:minimize` | Renderer → Main | — | Minimize window |
| `window:close` | Renderer → Main | — | Close window |

## Diagnostics
| Channel | Direction | Type | Description |
|---------|-----------|------|-------------|
| `diagnostic:run` | Renderer → Main | `ipcMain.handle` | Run system diagnostics, returns string[] |
| `diagnostic:transcribeTest` | Renderer → Main | `ipcMain.handle` | Test transcription with WAV buffer |

## Preload Bridge Methods

All exposed via `contextBridge.exposeInMainWorld('voiceflow', api)` in `src/preload/index.ts`.

| Method | IPC Pattern | Description |
|--------|-------------|-------------|
| `onRecordingStart(cb)` | `ipcRenderer.on` → cleanup fn | Listen for recording start |
| `onRecordingStop(cb)` | `ipcRenderer.on` → cleanup fn | Listen for recording stop |
| `onRecordingState(cb)` | `ipcRenderer.on` → cleanup fn | Listen for state changes |
| `sendAudioData(buffer, format)` | `ipcRenderer.send` | Send WAV data to main |
| `cancelTranscription()` | `ipcRenderer.send` | Cancel in-progress transcription |
| `transcribe(buffer, format?)` | `ipcRenderer.invoke` | Direct transcription call |
| `onTranscriptionResult(cb)` | `ipcRenderer.on` → cleanup fn | Listen for transcription results |
| `onTranscriptionError(cb)` | `ipcRenderer.on` → cleanup fn | Listen for transcription errors |
| `onCommandExecuted(cb)` | `ipcRenderer.on` → cleanup fn | Listen for command execution |
| `getSettings()` | `ipcRenderer.invoke` | Get all settings |
| `getSetting(key)` | `ipcRenderer.invoke` | Get single setting |
| `setSetting(key, value)` | `ipcRenderer.invoke` | Set single setting |
| `resetSettings()` | `ipcRenderer.invoke` | Reset all settings |
| `listModels()` | `ipcRenderer.invoke` | List whisper models |
| `downloadModel(name)` | `ipcRenderer.invoke` | Download a model |
| `onModelProgress(cb)` | `ipcRenderer.on` → cleanup fn | Model download progress |
| `getRecordingState()` | `ipcRenderer.invoke` | Pull current recording state |
| `getAppStatus()` | `ipcRenderer.invoke` | Get app status |
| `quit()` | `ipcRenderer.send` | Quit app |
| `showSettings()` | `ipcRenderer.send` | Show settings window |
| `runDiagnostic()` | `ipcRenderer.invoke` | Run diagnostics |
| `testTranscription(wav)` | `ipcRenderer.invoke` | Test transcription |
| `openExternal(url)` | `shell.openExternal` | Open URL in browser |

All `on*` methods return a cleanup function. Renderer components call cleanup in `useEffect` return.
