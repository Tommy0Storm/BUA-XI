import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
  color: string;
  mode?: 'bars' | 'circle';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, volume, color, mode = 'bars' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // Animation state
    let smoothedVolume = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Smooth the volume input
      smoothedVolume += (volume - smoothedVolume) * 0.2;

      if (mode === 'circle') {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const maxRadius = Math.min(canvas.width, canvas.height) / 2;
          const baseRadius = maxRadius * 0.4;
          
          // Draw multiple concentric circles based on volume
          const currentRadius = baseRadius + (smoothedVolume * (maxRadius - baseRadius) * 2);

          // Outer Glow
          const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, currentRadius);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(centerX, centerY, baseRadius + (smoothedVolume * 10), 0, Math.PI * 2);
          ctx.fill();

      } else {
        // Bar Mode
        const bars = 5;
        const barWidth = canvas.width / bars;
        const baseHeight = canvas.height * 0.2;
        const variableHeight = canvas.height * 0.6;
        
        for (let i = 0; i < bars; i++) {
           const target = baseHeight + (smoothedVolume * variableHeight * (Math.random() * 0.5 + 0.5));
           const x = i * barWidth + (barWidth * 0.1);
           const w = barWidth * 0.8;
           const h = target; // Simplified for this loop
           const y = (canvas.height - h) / 2; 

           ctx.fillStyle = color;
           ctx.beginPath();
           ctx.roundRect(x, y, w, h, 5);
           ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, volume, color, mode]);

  return (
    <canvas 
        ref={canvasRef} 
        width={mode === 'circle' ? 200 : 100} 
        height={mode === 'circle' ? 200 : 40} 
        className={mode === 'circle' ? "w-48 h-48" : "w-24 h-10"}
    />
  );
};

export default AudioVisualizer;