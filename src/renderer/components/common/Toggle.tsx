import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label className={`toggle-wrapper ${disabled ? 'disabled' : ''}`}>
      <div className={`toggle ${checked ? 'active' : ''}`} onClick={() => !disabled && onChange(!checked)}>
        <div className="toggle-knob" />
      </div>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}
