import React, { useState } from 'react';

interface WhisperConfigProps {
  groqApiKey: string;
  onGroqKeyChange: (key: string) => void;
}

export default function WhisperConfig({ groqApiKey, onGroqKeyChange }: WhisperConfigProps) {
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(groqApiKey);

  const handleKeySave = () => {
    onGroqKeyChange(keyInput);
  };

  return (
    <div className="settings-section">
      <h3>Transcription Engine</h3>
      <p className="settings-description">
        VoiceFlow uses Groq's free Whisper API for fast, accurate transcription.
      </p>

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
            You need a Groq API key to use VoiceFlow. It's free — sign up at groq.com and create an API key.
          </div>
        )}
      </div>
    </div>
  );
}
