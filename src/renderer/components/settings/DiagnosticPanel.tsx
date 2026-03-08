import React, { useEffect, useState, useRef } from 'react';
import Button from '../common/Button';
import type { AppStatus } from '../../../shared/types';

export default function DiagnosticPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [openingLogs, setOpeningLogs] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmRef = useRef<Float32Array[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    window.voiceflow.getAppStatus()
      .then((nextStatus: AppStatus) => setStatus(nextStatus))
      .catch(() => {});
  }, []);

  const runDiagnostic = async () => {
    setRunning(true);
    clearLogs();
    addLog('Running system diagnostic...');

    try {
      const results = await (window as any).voiceflow.runDiagnostic();
      for (const line of results) {
        addLog(line);
      }
    } catch (err: any) {
      addLog(`[ERROR] Diagnostic call failed: ${err.message}`);
    }

    try {
      const nextStatus = await window.voiceflow.getAppStatus();
      setStatus(nextStatus);
    } catch {
      // Ignore status refresh failures in diagnostics UI.
    }

    setRunning(false);
  };

  const openLogsFolder = async () => {
    setOpeningLogs(true);

    try {
      const logPath = await window.voiceflow.openLogsFolder();
      addLog(`[INFO] Opened logs folder for: ${logPath}`);
    } catch (err: any) {
      addLog(`[ERROR] Failed to open logs folder: ${err.message}`);
    } finally {
      setOpeningLogs(false);
    }
  };

  const quitApp = () => {
    setQuitting(true);
    addLog('[INFO] Quit requested from diagnostics panel');
    window.voiceflow.quit();
  };

  const testMicrophone = async () => {
    addLog('Testing microphone...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('[OK] Microphone access granted');

      const tracks = stream.getAudioTracks();
      addLog(`[INFO] Audio track: ${tracks[0]?.label || 'unknown'}`);
      addLog(`[INFO] Track settings: ${JSON.stringify(tracks[0]?.getSettings())}`);

      // Record 3 seconds
      addLog('[INFO] Recording 3 seconds of audio...');
      setRecording(true);

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      addLog(`[INFO] AudioContext sample rate: ${audioContext.sampleRate}Hz`);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      pcmRef.current = [];

      let maxLevel = 0;
      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        pcmRef.current.push(new Float32Array(data));
        for (let i = 0; i < data.length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > maxLevel) maxLevel = abs;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Stop
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);

      const totalSamples = pcmRef.current.reduce((sum, c) => sum + c.length, 0);
      addLog(`[INFO] Captured ${totalSamples} samples (${(totalSamples / 16000).toFixed(1)}s)`);
      addLog(`[INFO] Max audio level: ${maxLevel.toFixed(4)} (${maxLevel > 0.01 ? 'GOOD - audio detected' : 'WARNING - very quiet or silent'})`);

      if (totalSamples < 1000) {
        addLog('[ERROR] Too few samples captured. Microphone may not be working.');
        return;
      }

      // Build WAV
      addLog('[INFO] Building WAV file...');
      const wavBuffer = buildWav(pcmRef.current, 16000);
      addLog(`[INFO] WAV size: ${wavBuffer.byteLength} bytes`);

      // Test transcription
      addLog('[INFO] Sending to whisper for transcription...');
      const results = await (window as any).voiceflow.testTranscription(wavBuffer);
      for (const line of results) {
        addLog(line);
      }

    } catch (err: any) {
      addLog(`[ERROR] Microphone test failed: ${err.message}`);
      setRecording(false);
    }
  };

  return (
    <div className="settings-section">
      <h3>Diagnostics</h3>
      <p className="settings-description">
        Test each component of the voice pipeline to find what's not working.
      </p>

      <div style={{ marginBottom: 16 }}>
        <div className="form-hint">
          Persistent log file: {status?.logFilePath || 'Not initialized yet'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant="primary" size="md" onClick={runDiagnostic} disabled={running}>
          {running ? 'Running...' : 'Check System'}
        </Button>
        <Button variant="primary" size="md" onClick={testMicrophone} disabled={recording}>
          {recording ? 'Recording (3s)...' : 'Test Mic + Transcribe'}
        </Button>
        <Button variant="secondary" size="sm" onClick={clearLogs}>
          Clear
        </Button>
        <Button variant="secondary" size="sm" onClick={openLogsFolder} disabled={openingLogs}>
          {openingLogs ? 'Opening...' : 'Open Logs Folder'}
        </Button>
        <Button variant="danger" size="sm" onClick={quitApp} disabled={quitting}>
          {quitting ? 'Quitting...' : 'Quit VoiceFlow'}
        </Button>
      </div>

      <div className="diagnostic-log">
        {logs.length === 0 ? (
          <div className="diagnostic-empty">
            Click "Check System" to verify API key and hotkey.
            <br />
            Click "Test Mic + Transcribe" to record 3 seconds and test the full pipeline.
          </div>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={`diagnostic-line ${
                line.includes('[ERROR]') ? 'diagnostic-error' :
                line.includes('[WARN]') ? 'diagnostic-warn' :
                line.includes('[OK]') ? 'diagnostic-ok' : ''
              }`}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function buildWav(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  let totalSamples = 0;
  for (const chunk of chunks) totalSamples += chunk.length;

  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return buffer;
}
