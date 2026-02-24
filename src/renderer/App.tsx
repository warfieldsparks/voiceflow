import React, { useState, useEffect } from 'react';
import RecordingOverlay from './components/overlay/RecordingOverlay';
import SettingsPanel from './components/settings/SettingsPanel';

function getView(): string {
  const hash = window.location.hash.replace('#', '');
  return hash || 'preview';
}

function PreviewShell() {
  const [view, setView] = useState<'overlay' | 'settings'>('overlay');
  const [demoState, setDemoState] = useState<'idle' | 'recording' | 'processing'>('idle');

  // Simulate recording cycle for demo
  const simulateRecording = () => {
    setDemoState('recording');
    // Trigger the overlay's recording start
    (window as any).__demoCallbacks?.onStart?.();

    setTimeout(() => {
      setDemoState('processing');
      (window as any).__demoCallbacks?.onStop?.();
    }, 3000);

    setTimeout(() => {
      setDemoState('idle');
    }, 5000);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f23' }}>
      {/* Nav bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: '#16162b',
        borderBottom: '1px solid #2d2d44',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #4285f4, #7b68ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: 'white', fontWeight: 700,
          }}>V</div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>VoiceFlow</span>
          <span style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>Preview</span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setView('overlay')}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: view === 'overlay' ? '#4285f4' : '#2d2d44',
            color: view === 'overlay' ? '#fff' : '#999',
            fontSize: 13, fontWeight: 500,
          }}
        >Overlay</button>
        <button
          onClick={() => setView('settings')}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: view === 'settings' ? '#4285f4' : '#2d2d44',
            color: view === 'settings' ? '#fff' : '#999',
            fontSize: 13, fontWeight: 500,
          }}
        >Settings</button>

        {view === 'overlay' && (
          <button
            onClick={simulateRecording}
            disabled={demoState !== 'idle'}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: demoState === 'idle' ? '#34a853' : demoState === 'recording' ? '#ea4335' : '#fbbc04',
              color: '#fff', fontSize: 13, fontWeight: 500,
              opacity: demoState !== 'idle' ? 0.8 : 1,
            }}
          >
            {demoState === 'idle' ? 'Simulate Recording' : demoState === 'recording' ? 'Recording...' : 'Processing...'}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'overlay' ? (
          <OverlayPreview demoState={demoState} />
        ) : (
          <SettingsPanel />
        )}
      </div>
    </div>
  );
}

function OverlayPreview({ demoState }: { demoState: 'idle' | 'recording' | 'processing' }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Desktop mockup area */}
      <div style={{
        flex: 1, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'linear-gradient(180deg, #1a1a35 0%, #0f0f23 100%)',
        padding: '24px 20px',
        gap: 24,
      }}>
        {/* Overlay widget */}
        <div style={{ width: 420 }}>
          <RecordingOverlay />
        </div>

        {/* Info panel */}
        <div style={{
          maxWidth: 600, width: '100%',
          background: 'rgba(22, 22, 43, 0.8)',
          border: '1px solid #2d2d44',
          borderRadius: 12, padding: 24,
        }}>
          <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: 16 }}>How It Works</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <InfoCard
              title="1. Activate"
              description="Press Ctrl+Shift+Space to start recording. The overlay appears at the top of your screen."
            />
            <InfoCard
              title="2. Speak"
              description="Dictate text naturally. Say 'period', 'comma', 'enter' for punctuation and keys."
            />
            <InfoCard
              title="3. Commands"
              description="60+ built-in verbal commands: 'select all', 'new paragraph', 'open paren', etc."
            />
            <InfoCard
              title="4. Output"
              description="Text and keystrokes are injected into whatever window is focused — any app."
            />
          </div>

          <h3 style={{ color: '#fff', margin: '24px 0 12px', fontSize: 16 }}>Example</h3>
          <div style={{
            background: '#0f0f23', borderRadius: 8, padding: 16,
            fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8,
          }}>
            <div style={{ color: '#888' }}>You say:</div>
            <div style={{ color: '#7b68ee' }}>
              "hello world period new paragraph how are you question mark"
            </div>
            <div style={{ color: '#888', marginTop: 12 }}>Output:</div>
            <div style={{ color: '#4285f4' }}>
              hello world.<br />
              <br />
              how are you?
            </div>
          </div>

          <h3 style={{ color: '#fff', margin: '24px 0 12px', fontSize: 16 }}>Command Categories</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Keyboard', count: 6, color: '#4285f4' },
              { label: 'Navigation', count: 8, color: '#34a853' },
              { label: 'Editing', count: 6, color: '#fbbc04' },
              { label: 'Punctuation', count: 34, color: '#ea4335' },
              { label: 'Formatting', count: 5, color: '#7b68ee' },
            ].map(cat => (
              <span key={cat.label} style={{
                padding: '4px 12px', borderRadius: 20,
                background: `${cat.color}22`, color: cat.color,
                fontSize: 12, fontWeight: 500,
              }}>
                {cat.label} ({cat.count})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: '#0f0f23', borderRadius: 8, padding: 14,
    }}>
      <div style={{ color: '#4285f4', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#999', fontSize: 12, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

export default function App() {
  const view = getView();

  // Direct Electron views
  if (view === 'overlay') return <RecordingOverlay />;
  if (view === 'settings') return <SettingsPanel />;

  // Browser preview mode (default)
  return <PreviewShell />;
}
