import React from 'react';
import type { HotkeyMode } from '../../../shared/types';

const HOTKEY_PRESETS = [
  { value: 'Ctrl+Win', label: 'Ctrl + Win', desc: 'Same as Wispr Flow' },
  { value: 'Ctrl+Shift+Space', label: 'Ctrl + Shift + Space', desc: 'Classic default' },
  { value: 'Ctrl+Alt+Space', label: 'Ctrl + Alt + Space', desc: 'WhisperWriter style' },
  { value: 'Alt+Z', label: 'Alt + Z', desc: 'Quick two-key' },
  { value: 'F9', label: 'F9', desc: 'Single key' },
];

interface HotkeyConfigProps {
  hotkey: string;
  hotkeyMode: HotkeyMode;
  onChange: (hotkey: string) => void;
  onModeChange: (mode: HotkeyMode) => void;
}

export default function HotkeyConfig({ hotkey, hotkeyMode, onChange, onModeChange }: HotkeyConfigProps) {
  return (
    <div className="settings-section">
      <h3>Global Hotkey</h3>
      <p className="settings-description">
        Works everywhere — even when VoiceFlow is in the background.
      </p>

      <div className="settings-group">
        <h4>Key Combination</h4>
        <div className="hotkey-presets">
          {HOTKEY_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`hotkey-preset-btn ${hotkey === preset.value ? 'active' : ''}`}
              onClick={() => onChange(preset.value)}
            >
              <span className="hotkey-preset-keys">{preset.label}</span>
              <span className="hotkey-preset-desc">{preset.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h4>Recording Mode</h4>
        <div className="mode-selector">
          <button
            className={`mode-btn ${hotkeyMode === 'toggle' ? 'active' : ''}`}
            onClick={() => onModeChange('toggle')}
          >
            <span className="mode-title">Toggle</span>
            <span className="mode-desc">Press to start, press again to stop</span>
          </button>
          <button
            className={`mode-btn ${hotkeyMode === 'hold' ? 'active' : ''}`}
            onClick={() => onModeChange('hold')}
          >
            <span className="mode-title">Hold to Record</span>
            <span className="mode-desc">Hold keys to record, release to stop</span>
          </button>
        </div>
        {hotkeyMode === 'hold' && (
          <div className="info-box">
            Hold your hotkey to record. Release any key in the combo to stop and transcribe.
          </div>
        )}
        {hotkeyMode === 'toggle' && (
          <div className="info-box">
            Press your hotkey once to start recording. Press it again to stop and transcribe.
          </div>
        )}
      </div>
    </div>
  );
}
