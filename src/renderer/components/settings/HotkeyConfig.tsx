import React from 'react';
import KeybindCapture from '../common/KeybindCapture';

interface HotkeyConfigProps {
  hotkey: string;
  onChange: (hotkey: string) => void;
}

export default function HotkeyConfig({ hotkey, onChange }: HotkeyConfigProps) {
  return (
    <div className="settings-section">
      <h3>Global Hotkey</h3>
      <p className="settings-description">
        Press this key combination to toggle recording from any application.
      </p>
      <KeybindCapture value={hotkey} onChange={onChange} />
    </div>
  );
}
