import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWaveform } from '../../hooks/useWaveform';
import Waveform from './Waveform';
import StatusIndicator from './StatusIndicator';
import type { RecordingState } from '../../../shared/types';
import '../../styles/overlay.css';

export default function RecordingOverlay() {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const { waveformData, connectStream, disconnect } = useWaveform();

  // Use refs for audio recording to avoid stale closure issues
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Connect waveform analyzer when stream is available
  useEffect(() => {
    if (audioStream) {
      connectStream(audioStream);
    } else {
      disconnect();
    }
  }, [audioStream, connectStream, disconnect]);

  // Timer for processing state
  useEffect(() => {
    if (state !== 'processing') {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const cleanupRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAudioStream(null);
    isRecordingRef.current = false;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscription('');
      pcmChunksRef.current = [];

      console.log('[Overlay] Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: { ideal: 16000 } },
      });
      streamRef.current = stream;
      setAudioStream(stream);
      console.log('[Overlay] Got audio stream');

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      console.log(`[Overlay] AudioContext created, rate: ${audioContext.sampleRate}`);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(data));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      isRecordingRef.current = true;
      console.log('[Overlay] Recording started, capturing PCM');
    } catch (err) {
      console.error('[Overlay] Recording failed:', err);
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied.'
        : `Recording failed: ${(err as Error).message}`;
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log(`[Overlay] Stopping recording, isRecording: ${isRecordingRef.current}, chunks: ${pcmChunksRef.current.length}`);

    if (!isRecordingRef.current || pcmChunksRef.current.length === 0) {
      console.warn('[Overlay] No audio data captured!');
      cleanupRecording();
      return;
    }

    // Build WAV from captured PCM
    const wavBuffer = buildWav(pcmChunksRef.current, 16000);
    console.log(`[Overlay] Built WAV: ${wavBuffer.byteLength} bytes from ${pcmChunksRef.current.length} chunks`);

    pcmChunksRef.current = [];
    cleanupRecording();

    if (wavBuffer.byteLength > 44) {
      console.log('[Overlay] Sending audio data to main process');
      window.voiceflow.sendAudioData(wavBuffer, 'wav');
    } else {
      console.warn('[Overlay] WAV too small, not sending');
    }
  }, [cleanupRecording]);

  const handleCancel = useCallback(() => {
    cleanupRecording();
    pcmChunksRef.current = [];
    window.voiceflow.cancelTranscription?.();
    setState('idle');
    setElapsed(0);
  }, [cleanupRecording]);

  // Listen for recording commands from main process
  // Use refs for handlers to avoid stale closures
  const startRef = useRef(startRecording);
  const stopRef = useRef(stopRecording);
  const cancelRef = useRef(handleCancel);
  startRef.current = startRecording;
  stopRef.current = stopRecording;
  cancelRef.current = handleCancel;

  useEffect(() => {
    // Pull current state on mount (in case we missed a broadcast)
    (window as any).voiceflow?.getRecordingState?.().then((s: string) => {
      if (s && s !== 'idle') {
        setState(s as RecordingState);
        if (s === 'recording') startRef.current();
      }
    }).catch(() => {});

    const cleanup1 = window.voiceflow.onRecordingStart(() => {
      startRef.current();
    });

    const cleanup2 = window.voiceflow.onRecordingStop(() => {
      stopRef.current();
    });

    const cleanup3 = window.voiceflow.onRecordingState((s: string) => {
      setState(s as RecordingState);
    });

    const cleanup4 = window.voiceflow.onTranscriptionResult((text: string) => {
      setTranscription(text);
      setError(null);
      setTimeout(() => setTranscription(''), 3000);
    });

    const cleanup5 = window.voiceflow.onTranscriptionError((err: string) => {
      setError(err);
      setTimeout(() => setError(null), 8000);
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
    };
  }, []);

  return (
    <div className="overlay-container">
      <div className={`overlay-bar overlay-state-${state}`}>
        <StatusIndicator state={state} />

        <div className="overlay-center">
          {state === 'recording' && <Waveform data={waveformData} width={180} height={36} />}
          {state === 'processing' && (
            <div className="processing-area">
              <div className="processing-spinner" />
              <div className="processing-text">
                Transcribing{elapsed > 0 ? ` (${elapsed}s)` : '...'}
              </div>
            </div>
          )}
          {state === 'idle' && transcription && (
            <div className="transcription-text" title={transcription}>{transcription}</div>
          )}
          {state === 'idle' && !transcription && !error && (
            <div className="idle-text">Ready</div>
          )}
          {error && <div className="error-text" title={error}>{error}</div>}
        </div>

        {state === 'processing' && (
          <button className="cancel-btn" onClick={handleCancel} title="Cancel transcription">
            &#x2715;
          </button>
        )}
        {state === 'recording' && (
          <div className="overlay-hotkey">Press hotkey to stop</div>
        )}
        {state === 'idle' && !transcription && !error && (
          <div className="overlay-hotkey">Press hotkey to record</div>
        )}
      </div>
    </div>
  );
}

/** Build a WAV file from Float32 PCM chunks */
function buildWav(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  let totalSamples = 0;
  for (const chunk of chunks) totalSamples += chunk.length;

  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
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
