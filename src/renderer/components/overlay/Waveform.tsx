import React from 'react';

interface WaveformProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Waveform({
  data,
  width = 200,
  height = 40,
  color = '#4285f4',
}: WaveformProps) {
  if (data.length === 0) return null;

  const barWidth = Math.max(2, (width / data.length) * 0.7);
  const gap = (width - barWidth * data.length) / (data.length - 1 || 1);

  return (
    <svg width={width} height={height} className="waveform">
      {data.map((value, i) => {
        const barHeight = Math.max(2, value * height * 0.9);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={barWidth / 2}
            fill={color}
            opacity={0.6 + value * 0.4}
          />
        );
      })}
    </svg>
  );
}
