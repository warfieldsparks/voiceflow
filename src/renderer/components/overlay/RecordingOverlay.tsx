import React, { useState, useEffect, useCallback } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useWaveform } from '../../hooks/useWaveform';
import Waveform from './Waveform';
import StatusIndicator from './StatusIndicator';
import type { RecordingState } from '../../../shared/types';
import '../../styles/overlay.css';

export default function RecordingOverlay() {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { isRecording, startRecording, stopRecording, audioStream, error: recorderError } =
    useAudioRecorder();
  const { waveformData, connectStream, disconnect } = useWaveform();

  // Connect waveform analyzer when stream is available
  useEffect(() => {
    if (audioStream) {
      connectStream(audioStream);
    } else {
      disconnect();
    }
  }, [audioStream, connectStream, disconnect]);

  // Listen for recording commands from main process
  useEffect(() => {
    const cleanup1 = window.voiceflow.onRecordingStart(() => {
      handleStartRecording();
    });

    const cleanup2 = window.voiceflow.onRecordingStop(() => {
      handleStopRecording();
    });

    const cleanup3 = window.voiceflow.onRecordingState((s: string) => {
      setState(s as RecordingState);
    });

    const cleanup4 = window.voiceflow.onTranscriptionResult((text: string) => {
      setTranscription(text);
      // Clear after a few seconds
      setTimeout(() => setTranscription(''), 3000);
    });

    const cleanup5 = window.voiceflow.onTranscriptionError((err: string) => {
      setError(err);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    setError(null);
    setTranscription('');
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    const buffer = await stopRecording();
    if (buffer) {
      window.voiceflow.sendAudioData(buffer, 'webm');
    }
  }, [stopRecording]);

  // Show error from recorder
  useEffect(() => {
    if (recorderError) setError(recorderError);
  }, [recorderError]);

  return (
    <div className="overlay-container">
      <div className="overlay-bar">
        <StatusIndicator state={state} />

        <div className="overlay-center">
          {state === 'recording' && <Waveform data={waveformData} width={180} height={36} />}
          {state === 'processing' && (
            <div className="processing-text">Transcribing...</div>
          )}
          {state === 'idle' && transcription && (
            <div className="transcription-text">{transcription}</div>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>

        <div className="overlay-hotkey">Ctrl+Shift+Space</div>
      </div>
    </div>
  );
}
