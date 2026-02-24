import { useState, useRef, useEffect, useCallback } from 'react';

interface UseWaveformReturn {
  waveformData: number[];
  connectStream: (stream: MediaStream) => void;
  disconnect: () => void;
}

export function useWaveform(fftSize = 256): UseWaveformReturn {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  const disconnect = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setWaveformData([]);
  }, []);

  const connectStream = useCallback(
    (stream: MediaStream) => {
      disconnect();

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Normalize to 0-1 and take a subset for display
        const bars = 32;
        const step = Math.floor(dataArray.length / bars);
        const normalized: number[] = [];
        for (let i = 0; i < bars; i++) {
          normalized.push(dataArray[i * step] / 255);
        }
        setWaveformData(normalized);

        rafRef.current = requestAnimationFrame(tick);
      }

      tick();
    },
    [fftSize, disconnect]
  );

  // Cleanup on unmount
  useEffect(() => {
    return disconnect;
  }, [disconnect]);

  return { waveformData, connectStream, disconnect };
}
