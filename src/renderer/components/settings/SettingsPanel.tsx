import React, { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import HotkeyConfig from './HotkeyConfig';
import CommandEditor from './CommandEditor';
import WhisperConfig from './WhisperConfig';
import AudioConfig from './AudioConfig';
import DiagnosticPanel from './DiagnosticPanel';
import Toggle from '../common/Toggle';
import Button from '../common/Button';
import '../../styles/global.css';

type Tab = 'general' | 'hotkeys' | 'commands' | 'whisper' | 'audio' | 'diagnostic';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('diagnostic');
  const { settings, loading, updateSetting, resetAll } = useSettings();
  const [saved, setSaved] = useState(false);

  if (loading || !settings) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'diagnostic', label: 'Diagnostic', icon: '🔍' },
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'hotkeys', label: 'Hotkeys', icon: '⌨' },
    { id: 'commands', label: 'Commands', icon: '▶' },
    { id: 'whisper', label: 'Whisper', icon: '🎙' },
    { id: 'audio', label: 'Audio', icon: '🔊' },
  ];

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    await updateSetting(key as any, value);
    showSaved();
  };

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <div className="settings-brand">
          <h2>VoiceFlow</h2>
          <span className="settings-version">v1.0.0</span>
        </div>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="settings-footer">
          <Button variant="danger" size="sm" onClick={resetAll}>
            Reset All Settings
          </Button>
        </div>
      </div>

      <div className="settings-content">
        {saved && (
          <div className="save-toast">Settings saved</div>
        )}

        {activeTab === 'diagnostic' && <DiagnosticPanel />}

        {activeTab === 'general' && (
          <div className="settings-section">
            <h3>General</h3>
            <p className="settings-description">
              Configure app behavior and appearance.
            </p>

            <div className="settings-group">
              <h4>Startup</h4>
              <Toggle
                label="Start minimized to tray"
                checked={settings.ui.startMinimized}
                onChange={(v) => handleUpdateSetting('ui', { ...settings.ui, startMinimized: v })}
              />
              <Toggle
                label="Launch at login"
                checked={settings.ui.launchAtLogin}
                onChange={(v) => handleUpdateSetting('ui', { ...settings.ui, launchAtLogin: v })}
              />
            </div>

            <div className="settings-group">
              <h4>Interface</h4>
              <Toggle
                label="Sound feedback on record start/stop"
                checked={settings.ui.soundFeedback}
                onChange={(v) => handleUpdateSetting('ui', { ...settings.ui, soundFeedback: v })}
              />
              <Toggle
                label="Show waveform during recording"
                checked={settings.ui.showWaveform}
                onChange={(v) => handleUpdateSetting('ui', { ...settings.ui, showWaveform: v })}
              />
              <div className="form-group">
                <label>Overlay Position</label>
                <select
                  value={settings.ui.overlayPosition}
                  onChange={(e) =>
                    handleUpdateSetting('ui', {
                      ...settings.ui,
                      overlayPosition: e.target.value as 'top' | 'bottom',
                    })
                  }
                >
                  <option value="top">Top of screen</option>
                  <option value="bottom">Bottom of screen</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <h4>Typing</h4>
              <div className="form-group">
                <label>Text output speed</label>
                <select
                  value={settings.typing.speed}
                  onChange={(e) =>
                    handleUpdateSetting('typing', { speed: parseInt(e.target.value) })
                  }
                >
                  <option value="0">Instant (paste all at once)</option>
                  <option value="50">Slow (50 chars/sec)</option>
                  <option value="100">Medium (100 chars/sec)</option>
                  <option value="200">Fast (200 chars/sec)</option>
                </select>
                <span className="form-hint">
                  Instant is fastest. Character-by-character is more compatible with some apps.
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hotkeys' && (
          <HotkeyConfig
            hotkey={settings.hotkey}
            hotkeyMode={settings.hotkeyMode || 'toggle'}
            onChange={(h) => handleUpdateSetting('hotkey', h)}
            onModeChange={(mode) => handleUpdateSetting('hotkeyMode', mode)}
          />
        )}

        {activeTab === 'commands' && (
          <CommandEditor
            commands={settings.commands.customCommands}
            detectionMode={settings.commands.detectionMode}
            prefixWord={settings.commands.prefixWord}
            literalEscape={settings.commands.literalEscape}
            onChange={(cmds) =>
              handleUpdateSetting('commands', { ...settings.commands, customCommands: cmds })
            }
            onModeChange={(mode) =>
              handleUpdateSetting('commands', { ...settings.commands, detectionMode: mode })
            }
            onPrefixChange={(word) =>
              handleUpdateSetting('commands', { ...settings.commands, prefixWord: word })
            }
            onEscapeChange={(word) =>
              handleUpdateSetting('commands', { ...settings.commands, literalEscape: word })
            }
          />
        )}

        {activeTab === 'whisper' && (
          <WhisperConfig
            groqApiKey={settings.transcription.groqApiKey || ''}
            onGroqKeyChange={(key) =>
              handleUpdateSetting('transcription', { ...settings.transcription, groqApiKey: key })
            }
          />
        )}

        {activeTab === 'audio' && (
          <AudioConfig
            inputDeviceId={settings.audio.inputDeviceId}
            silenceThreshold={settings.audio.silenceThreshold}
            autoStopAfterSilence={settings.audio.autoStopAfterSilence}
            onChange={(key, value) =>
              handleUpdateSetting('audio', { ...settings.audio, [key]: value })
            }
          />
        )}
      </div>
    </div>
  );
}
