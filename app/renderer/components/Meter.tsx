import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import './Meter.css';

export default function Meter() {
  const { audioLevel } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw level bar
    const barWidth = width * Math.min(audioLevel * 10, 1); // Scale audio level
    ctx.fillStyle = audioLevel > 0.1 ? '#10b981' : '#888';
    ctx.fillRect(0, height / 2, barWidth, height / 2);

    // Draw threshold line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.7, 0);
    ctx.lineTo(width * 0.7, height);
    ctx.stroke();
  }, [audioLevel]);

  return (
    <div className="meter-container">
      <canvas ref={canvasRef} width={100} height={20} className="meter-canvas" />
    </div>
  );
}

