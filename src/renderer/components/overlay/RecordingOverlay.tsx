import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWaveform } from '../../hooks/useWaveform';
import Waveform from './Waveform';
import StatusIndicator from './StatusIndicator';
import type { RecordingControlPayload, RecordingState, RecordingStatus } from '../../../shared/types';
import '../../styles/overlay.css';

const SAMPLE_RATE = 16000;

export default function RecordingOverlay() {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const { waveformData, connectStream, disconnect } = useWaveform();

  const stateRef = useRef<RecordingState>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const currentSessionIdRef = useRef<number | null>(null);
  const activeSessionIdRef = useRef<number | null>(null);
  const pendingStartSessionIdRef = useRef<number | null>(null);
  const stoppedSessionsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (audioStream) {
      connectStream(audioStream);
    } else {
      disconnect();
    }
  }, [audioStream, connectStream, disconnect]);

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

  const cleanupRecording = useCallback((reason: string) => {
    console.log(`[Overlay] Cleaning up recorder (${reason})`, {
      activeSessionId: activeSessionIdRef.current,
      currentSessionId: currentSessionIdRef.current,
      pendingSessionId: pendingStartSessionIdRef.current,
      chunkCount: pcmChunksRef.current.length,
    });

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    isRecordingRef.current = false;
    setAudioStream(null);
  }, []);

  const clearRecorderTracking = useCallback((sessionId: number | null) => {
    if (sessionId === null) return;

    if (activeSessionIdRef.current === sessionId) {
      activeSessionIdRef.current = null;
    }
    if (pendingStartSessionIdRef.current === sessionId) {
      pendingStartSessionIdRef.current = null;
    }

    stoppedSessionsRef.current.delete(sessionId);
  }, []);

  const clearSessionTracking = useCallback((sessionId: number | null) => {
    if (sessionId === null) return;
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null;
    }
    clearRecorderTracking(sessionId);
  }, [clearRecorderTracking]);

  const abortSession = useCallback((reason: string, sessionId?: number | null) => {
    const targetSessionId =
      sessionId ??
      currentSessionIdRef.current ??
      activeSessionIdRef.current ??
      pendingStartSessionIdRef.current;

    console.warn(`[Overlay] Aborting session ${targetSessionId ?? 'unknown'}: ${reason}`);
    cleanupRecording(reason);
    pcmChunksRef.current = [];
    clearSessionTracking(targetSessionId ?? null);
    setElapsed(0);
  }, [cleanupRecording, clearSessionTracking]);

  const startRecording = useCallback(async (payload: RecordingControlPayload) => {
    const sessionId = payload?.sessionId;
    if (!sessionId) {
      console.warn('[Overlay] Ignoring start request without a session id');
      return;
    }

    if (activeSessionIdRef.current === sessionId && isRecordingRef.current) {
      console.log(`[Overlay] Duplicate start ignored for session ${sessionId}`);
      return;
    }

    if (pendingStartSessionIdRef.current === sessionId) {
      console.log(`[Overlay] Start already pending for session ${sessionId}`);
      return;
    }

    if (
      activeSessionIdRef.current !== null ||
      pendingStartSessionIdRef.current !== null ||
      isRecordingRef.current
    ) {
      abortSession('superseded by a newer start request');
    }

    setError(null);
    setTranscription('');
    setElapsed(0);
    pcmChunksRef.current = [];
    currentSessionIdRef.current = sessionId;
    stoppedSessionsRef.current.delete(sessionId);
    pendingStartSessionIdRef.current = sessionId;

    console.log(`[Overlay] Starting recording for session ${sessionId}`);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: { ideal: SAMPLE_RATE } },
      });

      if (
        pendingStartSessionIdRef.current !== sessionId ||
        stoppedSessionsRef.current.has(sessionId)
      ) {
        console.warn(`[Overlay] Session ${sessionId} was cancelled before microphone became ready`);
        stream.getTracks().forEach((track) => track.stop());
        clearRecorderTracking(sessionId);
        return;
      }

      streamRef.current = stream;
      setAudioStream(stream);

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(data));
      };

      if (
        pendingStartSessionIdRef.current !== sessionId ||
        stoppedSessionsRef.current.has(sessionId)
      ) {
        console.warn(`[Overlay] Session ${sessionId} was cancelled during recorder setup`);
        cleanupRecording('cancelled during setup');
        clearRecorderTracking(sessionId);
        return;
      }

      source.connect(processor);
      processor.connect(audioContext.destination);

      activeSessionIdRef.current = sessionId;
      pendingStartSessionIdRef.current = null;
      isRecordingRef.current = true;

      const track = stream.getAudioTracks()[0];
      window.voiceflow.notifyRecordingCaptureStarted({
        sessionId,
        sampleRate: audioContext.sampleRate,
        trackLabel: track?.label || 'unknown',
        channelCount: track?.getSettings().channelCount,
      });

      console.log(`[Overlay] Recording armed for session ${sessionId}`);
    } catch (err) {
      console.error(`[Overlay] Recording failed for session ${sessionId}`, err);

      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied.'
        : `Recording failed: ${(err as Error).message}`;

      cleanupRecording('start failed');
      clearSessionTracking(sessionId);
      setError(message);
      setState('idle');

      window.voiceflow.notifyRecordingCaptureFailed({
        sessionId,
        message,
        errorName: err instanceof DOMException ? err.name : undefined,
      });
    }
  }, [abortSession, cleanupRecording, clearSessionTracking]);

  const stopRecording = useCallback((payload?: RecordingControlPayload) => {
    const requestedSessionId = payload?.sessionId;
    const sessionId =
      requestedSessionId ?? activeSessionIdRef.current ?? pendingStartSessionIdRef.current;

    if (!sessionId) {
      console.warn('[Overlay] Ignoring stop request without an active session');
      return;
    }

    if (
      requestedSessionId &&
      requestedSessionId !== activeSessionIdRef.current &&
      requestedSessionId !== pendingStartSessionIdRef.current
    ) {
      console.warn(`[Overlay] Ignoring stale stop for session ${requestedSessionId}`);
      return;
    }

    stoppedSessionsRef.current.add(sessionId);

    console.log(`[Overlay] Stop requested for session ${sessionId}`, {
      activeSessionId: activeSessionIdRef.current,
      pendingSessionId: pendingStartSessionIdRef.current,
      chunkCount: pcmChunksRef.current.length,
      isRecording: isRecordingRef.current,
    });

    if (pendingStartSessionIdRef.current === sessionId && !isRecordingRef.current) {
      pendingStartSessionIdRef.current = null;
      window.voiceflow.notifyRecordingNoAudio({
        sessionId,
        chunkCount: 0,
        sampleCount: 0,
        reason: 'Stop arrived before the microphone became ready.',
      });
      return;
    }

    const sampleCount = pcmChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
    const chunkCount = pcmChunksRef.current.length;

    if (!isRecordingRef.current || sampleCount === 0) {
      cleanupRecording('stop without audio');
      pcmChunksRef.current = [];
      clearRecorderTracking(sessionId);

      window.voiceflow.notifyRecordingNoAudio({
        sessionId,
        chunkCount,
        sampleCount,
        reason: !isRecordingRef.current
          ? 'Recorder was not active when stop arrived.'
          : 'No audio samples were captured.',
      });
      return;
    }

    const wavBuffer = buildWav(pcmChunksRef.current, SAMPLE_RATE);
    cleanupRecording('normal stop');
    pcmChunksRef.current = [];
    clearRecorderTracking(sessionId);

    if (wavBuffer.byteLength <= 44) {
      window.voiceflow.notifyRecordingNoAudio({
        sessionId,
        chunkCount,
        sampleCount,
        reason: 'Encoded audio buffer was empty.',
      });
      return;
    }

    const duration = sampleCount / SAMPLE_RATE;
    console.log(`[Overlay] Sending audio for session ${sessionId}`, {
      bytes: wavBuffer.byteLength,
      durationSec: duration,
      chunkCount,
      sampleCount,
    });

    window.voiceflow.sendAudioData({
      sessionId,
      buffer: wavBuffer,
      format: 'wav',
      duration,
    });
  }, [cleanupRecording, clearRecorderTracking]);

  const handleCancel = useCallback(() => {
    const sessionId =
      currentSessionIdRef.current ?? activeSessionIdRef.current ?? pendingStartSessionIdRef.current;
    console.warn(`[Overlay] User cancelled from state ${stateRef.current}`, { sessionId });

    abortSession('user cancelled locally', sessionId);
    window.voiceflow.cancelTranscription?.();
    setState('idle');
    setElapsed(0);
  }, [abortSession]);

  const handleAbort = useCallback((payload: RecordingControlPayload) => {
    if (
      payload?.sessionId &&
      payload.sessionId !== currentSessionIdRef.current &&
      payload.sessionId !== activeSessionIdRef.current &&
      payload.sessionId !== pendingStartSessionIdRef.current
    ) {
      console.log(`[Overlay] Ignoring abort for stale session ${payload.sessionId}`);
      return;
    }

    abortSession(payload?.reason || 'main requested abort', payload?.sessionId);
    setState('idle');
  }, [abortSession]);

  const startRef = useRef(startRecording);
  const stopRef = useRef(stopRecording);
  const abortRef = useRef(handleAbort);
  startRef.current = startRecording;
  stopRef.current = stopRecording;
  abortRef.current = handleAbort;

  useEffect(() => {
    window.voiceflow.getRecordingState()
      .then((status: RecordingStatus) => {
        if (!status || status.state === 'idle') return;

        setState(status.state);

        if (status.state === 'recording' && status.sessionId) {
          currentSessionIdRef.current = status.sessionId;
          startRef.current({ sessionId: status.sessionId });
        }

        if (status.state === 'processing' && status.sessionId) {
          currentSessionIdRef.current = status.sessionId;
        }
      })
      .catch(() => {});

    const cleanup1 = window.voiceflow.onRecordingStart((payload: RecordingControlPayload) => {
      startRef.current(payload);
    });

    const cleanup2 = window.voiceflow.onRecordingStop((payload: RecordingControlPayload) => {
      stopRef.current(payload);
    });

    const cleanup3 = window.voiceflow.onRecordingAbort((payload: RecordingControlPayload) => {
      abortRef.current(payload);
    });

    const cleanup4 = window.voiceflow.onRecordingState((nextState: string) => {
      if (nextState === 'idle') {
        currentSessionIdRef.current = null;
      }
      setState(nextState as RecordingState);
    });

    const cleanup5 = window.voiceflow.onTranscriptionResult((text: string) => {
      setTranscription(text);
      setError(null);
      setTimeout(() => setTranscription(''), 3000);
    });

    const cleanup6 = window.voiceflow.onTranscriptionError((err: string) => {
      setError(err);
      setTimeout(() => setError(null), 8000);
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
      cleanup6();
      abortSession('overlay unmounted');
    };
  }, [abortSession]);

  useEffect(() => {
    if (state === 'idle' && (isRecordingRef.current || pendingStartSessionIdRef.current !== null)) {
      abortSession('state synchronized back to idle');
    }
  }, [state, abortSession]);

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

        {(state === 'recording' || state === 'processing') && (
          <button
            className="cancel-btn"
            onClick={handleCancel}
            title={state === 'recording' ? 'Abort recording' : 'Cancel transcription'}
          >
            &#x2715;
          </button>
        )}
        {state === 'recording' && (
          <div className="overlay-hotkey">Release hotkey or click X to stop</div>
        )}
        {state === 'idle' && !transcription && !error && (
          <div className="overlay-hotkey">Press hotkey to record</div>
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
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return buffer;
}
