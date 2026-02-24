import React, { useState, useEffect } from 'react';
import Button from '../common/Button';

interface AudioConfigProps {
  inputDeviceId: string;
  silenceThreshold: number;
  autoStopAfterSilence: number;
  onChange: (key: string, value: any) => void;
}

export default function AudioConfig({
  inputDeviceId,
  silenceThreshold,
  autoStopAfterSilence,
  onChange,
}: AudioConfigProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testLevel, setTestLevel] = useState(0);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices.filter((d) => d.kind === 'audioinput'));
    } catch {
      // Permission not granted yet
    }
  };

  const testMicrophone = async () => {
    setTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: inputDeviceId !== 'default' ? { deviceId: { exact: inputDeviceId } } : true,
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let frameCount = 0;

      const tick = () => {
        if (frameCount >= 100) {
          // ~3 seconds at 30fps
          stream.getTracks().forEach((t) => t.stop());
          audioContext.close();
          setTesting(false);
          setTestLevel(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        setTestLevel(avg);
        frameCount++;
        requestAnimationFrame(tick);
      };

      tick();
      // Also refresh device list (user may have just granted permission)
      loadDevices();
    } catch {
      setTesting(false);
    }
  };

  return (
    <div className="settings-section">
      <h3>Audio Input</h3>

      <div className="form-group">
        <label>Microphone</label>
        <select
          value={inputDeviceId}
          onChange={(e) => onChange('inputDeviceId', e.target.value)}
        >
          <option value="default">Default</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <Button
          size="sm"
          variant="secondary"
          onClick={testMicrophone}
          disabled={testing}
        >
          {testing ? 'Listening...' : 'Test Microphone'}
        </Button>
        {testing && (
          <div className="mic-level-bar">
            <div
              className="mic-level-fill"
              style={{ width: `${Math.min(100, testLevel * 300)}%` }}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Silence Threshold</label>
        <input
          type="range"
          min="0"
          max="0.1"
          step="0.005"
          value={silenceThreshold}
          onChange={(e) => onChange('silenceThreshold', parseFloat(e.target.value))}
        />
        <span className="form-hint">{silenceThreshold.toFixed(3)}</span>
      </div>

      <div className="form-group">
        <label>Auto-stop after silence (ms)</label>
        <input
          type="number"
          min="500"
          max="10000"
          step="500"
          value={autoStopAfterSilence}
          onChange={(e) => onChange('autoStopAfterSilence', parseInt(e.target.value))}
        />
      </div>
    </div>
  );
}
