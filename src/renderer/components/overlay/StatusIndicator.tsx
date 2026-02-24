import React from 'react';
import type { RecordingState } from '../../../shared/types';

interface StatusIndicatorProps {
  state: RecordingState;
}

const STATE_CONFIG: Record<RecordingState, { color: string; label: string; pulse: boolean }> = {
  idle: { color: '#666', label: 'Ready', pulse: false },
  recording: { color: '#ea4335', label: 'Recording', pulse: true },
  processing: { color: '#fbbc04', label: 'Processing', pulse: true },
};

export default function StatusIndicator({ state }: StatusIndicatorProps) {
  const config = STATE_CONFIG[state];

  return (
    <div className="status-indicator">
      <div
        className={`status-dot ${config.pulse ? 'pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      />
      <span className="status-label">{config.label}</span>
    </div>
  );
}
