import React, { useState } from 'react';
import type { TranscriptionMode } from '../../../shared/types';

interface WhisperConfigProps {
  mode: TranscriptionMode;
  groqApiKey: string;
  onModeChange: (mode: TranscriptionMode) => void;
  onGroqKeyChange: (key: string) => void;
}

export default function WhisperConfig({ mode, groqApiKey, onModeChange, onGroqKeyChange }: WhisperConfigProps) {
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(groqApiKey);

  const handleKeySave = () => {
    onGroqKeyChange(keyInput);
  };

  return (
    <div className="settings-section">
      <h3>Transcription Engine</h3>
      <p className="settings-description">
        Choose how VoiceFlow transcribes your speech.
      </p>

      <div className="settings-group">
        <h4>Engine</h4>
        <div className="mode-selector">
          <button
            className={`mode-btn ${mode === 'groq' ? 'active' : ''}`}
            onClick={() => onModeChange('groq')}
          >
            <span className="mode-title">Groq Cloud</span>
            <span className="mode-desc">Fastest + most accurate (free API key)</span>
          </button>
          <button
            className={`mode-btn ${mode === 'local' ? 'active' : ''}`}
            onClick={() => onModeChange('local')}
          >
            <span className="mode-title">Local</span>
            <span className="mode-desc">Private, no internet needed</span>
          </button>
        </div>
      </div>

      {mode === 'groq' && (
        <div className="settings-group">
          <h4>Groq API Key</h4>
          <p className="settings-description" style={{ marginBottom: '12px' }}>
            Get a free API key at{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                (window as any).voiceflow?.openExternal?.('https://console.groq.com/keys');
              }}
              style={{ color: '#4fc3f7' }}
            >
              console.groq.com/keys
            </a>
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="gsk_..."
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#1e1e2e',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#e0e0e0',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
              onBlur={handleKeySave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleKeySave(); }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                padding: '8px 12px',
                background: '#2a2a3e',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {keyInput && (
            <div className="info-box" style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
                  <span style={{ color: '#aaa' }}>Model</span>
                  <span style={{ color: '#e0e0e0', fontWeight: 500 }}>Whisper large-v3-turbo</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
                  <span style={{ color: '#aaa' }}>Speed</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 500 }}>Near-instant (~0.5s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
                  <span style={{ color: '#aaa' }}>Free tier</span>
                  <span style={{ color: '#e0e0e0' }}>2,000 requests/day</span>
                </div>
              </div>
            </div>
          )}
          {!keyInput && (
            <div className="info-box" style={{ marginTop: '12px', borderColor: '#f4a236' }}>
              You need a Groq API key to use cloud transcription. It's free — sign up at groq.com and create an API key.
            </div>
          )}
        </div>
      )}

      {mode === 'local' && (
        <div className="settings-group">
          <h4>Local Engine</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
              <span style={{ color: '#aaa' }}>Model</span>
              <span style={{ color: '#e0e0e0', fontWeight: 500 }}>Whisper small.en</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
              <span style={{ color: '#aaa' }}>Size</span>
              <span style={{ color: '#e0e0e0' }}>466 MB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '360px' }}>
              <span style={{ color: '#aaa' }}>Processing</span>
              <span style={{ color: '#34a853', fontWeight: 500 }}>100% Local / Private</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
