import React, { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import HotkeyConfig from './HotkeyConfig';
import CommandEditor from './CommandEditor';
import WhisperConfig from './WhisperConfig';
import AudioConfig from './AudioConfig';
import Toggle from '../common/Toggle';
import Button from '../common/Button';
import '../../styles/global.css';

type Tab = 'general' | 'hotkeys' | 'commands' | 'whisper' | 'audio';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const { settings, loading, updateSetting, resetAll } = useSettings();

  if (loading || !settings) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'hotkeys', label: 'Hotkeys' },
    { id: 'commands', label: 'Commands' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'audio', label: 'Audio' },
  ];

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <h2>Settings</h2>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="settings-footer">
          <Button variant="danger" size="sm" onClick={resetAll}>
            Reset All
          </Button>
        </div>
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-section">
            <h3>General</h3>
            <Toggle
              label="Start minimized to tray"
              checked={settings.ui.startMinimized}
              onChange={(v) => updateSetting('ui', { ...settings.ui, startMinimized: v })}
            />
            <Toggle
              label="Launch at login"
              checked={settings.ui.launchAtLogin}
              onChange={(v) => updateSetting('ui', { ...settings.ui, launchAtLogin: v })}
            />
            <Toggle
              label="Sound feedback"
              checked={settings.ui.soundFeedback}
              onChange={(v) => updateSetting('ui', { ...settings.ui, soundFeedback: v })}
            />
            <Toggle
              label="Show waveform"
              checked={settings.ui.showWaveform}
              onChange={(v) => updateSetting('ui', { ...settings.ui, showWaveform: v })}
            />
            <div className="form-group">
              <label>Overlay Position</label>
              <select
                value={settings.ui.overlayPosition}
                onChange={(e) =>
                  updateSetting('ui', {
                    ...settings.ui,
                    overlayPosition: e.target.value as 'top' | 'bottom',
                  })
                }
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div className="form-group">
              <label>Typing Speed</label>
              <select
                value={settings.typing.speed}
                onChange={(e) =>
                  updateSetting('typing', { speed: parseInt(e.target.value) })
                }
              >
                <option value="0">Instant</option>
                <option value="50">Slow (50 cps)</option>
                <option value="100">Medium (100 cps)</option>
                <option value="200">Fast (200 cps)</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'hotkeys' && (
          <HotkeyConfig
            hotkey={settings.hotkey}
            onChange={(h) => updateSetting('hotkey', h)}
          />
        )}

        {activeTab === 'commands' && (
          <CommandEditor
            commands={settings.commands.customCommands}
            detectionMode={settings.commands.detectionMode}
            prefixWord={settings.commands.prefixWord}
            literalEscape={settings.commands.literalEscape}
            onChange={(cmds) =>
              updateSetting('commands', { ...settings.commands, customCommands: cmds })
            }
            onModeChange={(mode) =>
              updateSetting('commands', { ...settings.commands, detectionMode: mode })
            }
            onPrefixChange={(word) =>
              updateSetting('commands', { ...settings.commands, prefixWord: word })
            }
            onEscapeChange={(word) =>
              updateSetting('commands', { ...settings.commands, literalEscape: word })
            }
          />
        )}

        {activeTab === 'whisper' && (
          <WhisperConfig
            mode={settings.transcription.mode}
            apiKey={settings.transcription.apiKey}
            localModel={settings.transcription.localModel}
            onModeChange={(mode) =>
              updateSetting('transcription', { ...settings.transcription, mode })
            }
            onApiKeyChange={(key) =>
              updateSetting('transcription', { ...settings.transcription, apiKey: key })
            }
            onModelChange={(model) =>
              updateSetting('transcription', { ...settings.transcription, localModel: model })
            }
          />
        )}

        {activeTab === 'audio' && (
          <AudioConfig
            inputDeviceId={settings.audio.inputDeviceId}
            silenceThreshold={settings.audio.silenceThreshold}
            autoStopAfterSilence={settings.audio.autoStopAfterSilence}
            onChange={(key, value) =>
              updateSetting('audio', { ...settings.audio, [key]: value })
            }
          />
        )}
      </div>
    </div>
  );
}
