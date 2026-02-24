import React, { useState, useCallback, useRef } from 'react';

interface KeybindCaptureProps {
  value: string;
  onChange: (keybind: string) => void;
}

export default function KeybindCapture({ value, onChange }: KeybindCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!capturing) return;
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');

      // Don't count modifier-only presses
      const key = e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        const combo = parts.join('+');
        onChange(combo);
        setCapturing(false);
      }
    },
    [capturing, onChange]
  );

  return (
    <div className="keybind-capture">
      <div
        ref={inputRef}
        className={`keybind-display ${capturing ? 'capturing' : ''}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
      >
        {capturing ? 'Press a key combination...' : value || 'Click to set'}
      </div>
    </div>
  );
}
