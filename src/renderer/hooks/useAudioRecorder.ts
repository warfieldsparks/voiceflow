import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<ArrayBuffer | null>;
  audioStream: MediaStream | null;
  error: string | null;
}

export function useAudioRecorder(deviceId?: string): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((buffer: ArrayBuffer | null) => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioStream]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setAudioStream(stream);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const buffer = await blob.arrayBuffer();

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        setAudioStream(null);

        if (resolveStopRef.current) {
          resolveStopRef.current(buffer);
          resolveStopRef.current = null;
        }
      };

      recorder.start(100); // collect data every 100ms for waveform
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please grant permission in system settings.'
        : `Failed to start recording: ${(err as Error).message}`;
      setError(message);
      setIsRecording(false);
    }
  }, [deviceId]);

  const stopRecording = useCallback(async (): Promise<ArrayBuffer | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        resolve(null);
        return;
      }

      resolveStopRef.current = resolve;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  }, []);

  return { isRecording, startRecording, stopRecording, audioStream, error };
}
