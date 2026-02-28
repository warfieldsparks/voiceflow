import React, { useState, useCallback, useRef } from 'react';

// Map browser KeyboardEvent.key → Electron Accelerator name
const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  'Enter': 'Return',
  'Escape': 'Escape',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
  'Insert': 'Insert',
  'Home': 'Home',
  'End': 'End',
  'PageUp': 'PageUp',
  'PageDown': 'PageDown',
  'Tab': 'Tab',
  'CapsLock': 'CapsLock',
  'PrintScreen': 'PrintScreen',
  'ScrollLock': 'ScrollLock',
  'Pause': 'Pause',
  'NumLock': 'NumLock',
};

function toAccelerator(key: string): string | null {
  if (KEY_MAP[key]) return KEY_MAP[key];
  if (/^F\d{1,2}$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return null;
}

interface KeybindCaptureProps {
  value: string;
  onChange: (keybind: string) => void;
}

export default function KeybindCapture({ value, onChange }: KeybindCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const [heldModifiers, setHeldModifiers] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!capturing) return;
      e.preventDefault();
      e.stopPropagation();

      // Build modifier list
      const mods: string[] = [];
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.shiftKey) mods.push('Shift');
      if (e.altKey) mods.push('Alt');
      if (e.metaKey) mods.push('Super');

      const key = e.key;

      // If it's a modifier-only press, show live preview of held modifiers
      if (['Control', 'Shift', 'Alt', 'Meta', 'OS'].includes(key)) {
        setHeldModifiers(mods.length > 0 ? mods.join('+') + ' + ...' : '');
        setError('');
        return;
      }

      // Translate key to Electron accelerator name
      const mapped = toAccelerator(key);
      if (!mapped) {
        setError(`Key "${key}" is not supported. Try a letter, number, F-key, or Space.`);
        return;
      }

      // Require at least one modifier (except for F-keys)
      if (mods.length === 0 && !/^F\d{1,2}$/.test(mapped)) {
        setError('Hold a modifier (Ctrl, Shift, Alt, or Win) then press a key.');
        return;
      }

      mods.push(mapped);
      const combo = mods.join('+');
      setError('');
      setHeldModifiers('');
      onChange(combo);
      setCapturing(false);
    },
    [capturing, onChange]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!capturing) return;
      // Update modifier preview on key release
      const mods: string[] = [];
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.shiftKey) mods.push('Shift');
      if (e.altKey) mods.push('Alt');
      if (e.metaKey) mods.push('Super');
      setHeldModifiers(mods.length > 0 ? mods.join('+') + ' + ...' : '');
    },
    [capturing]
  );

  const startCapture = () => {
    setCapturing(true);
    setError('');
    setHeldModifiers('');
  };

  const displayText = capturing
    ? (heldModifiers || 'Press a key combination...')
    : (value || 'Click to set');

  return (
    <div className="keybind-capture">
      <div
        ref={inputRef}
        className={`keybind-display ${capturing ? 'capturing' : ''}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={startCapture}
        onBlur={() => { setCapturing(false); setHeldModifiers(''); }}
      >
        {displayText}
      </div>
      {capturing && !error && (
        <div style={{ color: '#888', fontSize: '12px', marginTop: '6px' }}>
          Hold modifier keys (Ctrl, Shift, Alt, Win) then press a regular key (Space, letter, F-key)
        </div>
      )}
      {error && (
        <div style={{ color: '#ea4335', fontSize: '12px', marginTop: '6px' }}>{error}</div>
      )}
    </div>
  );
}
