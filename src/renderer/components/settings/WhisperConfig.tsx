import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import type { WhisperModel, TranscriptionMode } from '../../../shared/types';

interface WhisperConfigProps {
  mode: TranscriptionMode;
  apiKey: string;
  localModel: string;
  onModeChange: (mode: TranscriptionMode) => void;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}

export default function WhisperConfig({
  mode,
  apiKey,
  localModel,
  onModeChange,
  onApiKeyChange,
  onModelChange,
}: WhisperConfigProps) {
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    loadModels();
    const cleanup = window.voiceflow.onModelProgress(
      (data: { modelName: string; percent: number }) => {
        if (data.modelName === downloading) {
          setDownloadProgress(data.percent);
        }
      }
    );
    return cleanup;
  }, [downloading]);

  const loadModels = async () => {
    try {
      const list = await window.voiceflow.listModels();
      setModels(list);
    } catch {
      // Models list unavailable
    }
  };

  const handleDownload = async (name: string) => {
    setDownloading(name);
    setDownloadProgress(0);
    try {
      await window.voiceflow.downloadModel(name);
      await loadModels();
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="settings-section">
      <h3>Transcription Engine</h3>

      <div className="form-group">
        <label>Mode</label>
        <select value={mode} onChange={(e) => onModeChange(e.target.value as TranscriptionMode)}>
          <option value="cloud">Cloud (OpenAI Whisper API)</option>
          <option value="local">Local (whisper.cpp)</option>
        </select>
      </div>

      {mode === 'cloud' && (
        <div className="form-group">
          <label>OpenAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-..."
          />
          <span className="form-hint">
            Get your key at platform.openai.com. Audio is sent to OpenAI for transcription.
          </span>
        </div>
      )}

      {mode === 'local' && (
        <>
          <div className="form-group">
            <label>Model</label>
            <select value={localModel} onChange={(e) => onModelChange(e.target.value)}>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.size}) {m.downloaded ? '(downloaded)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="model-list">
            {models.map((m) => (
              <div key={m.name} className="model-item">
                <span>
                  {m.name} — {m.size}
                </span>
                {m.downloaded ? (
                  <span className="model-ready">Ready</span>
                ) : downloading === m.name ? (
                  <div className="model-progress">
                    <div
                      className="model-progress-bar"
                      style={{ width: `${downloadProgress}%` }}
                    />
                    <span>{downloadProgress}%</span>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => handleDownload(m.name)}>
                    Download
                  </Button>
                )}
              </div>
            ))}
          </div>

          <span className="form-hint">
            All processing happens locally on your machine. No data is sent to external servers.
          </span>
        </>
      )}
    </div>
  );
}
