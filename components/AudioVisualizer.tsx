import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
  color: string;
  mode?: 'bars' | 'circle';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, volume, color, mode = 'circle' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for animation physics
  const stateRef = useRef({
    phase: 0,
    rotation: 0,
    smoothedVolume: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; size: number }[]
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Animation Loop
    const render = () => {
      const state = stateRef.current;
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Physics Updates
      // Volume smoothing (Attack: Fast, Release: Slow)
      const targetVolume = isActive ? Math.max(0.02, volume) : 0.02; // Keep a tiny bit of life when idle
      const lerpFactor = targetVolume > state.smoothedVolume ? 0.4 : 0.08;
      state.smoothedVolume += (targetVolume - state.smoothedVolume) * lerpFactor;
      
      const v = state.smoothedVolume;
      const vBoost = v * 1.5; // Amplified for visual impact
      
      state.phase += 0.02 + (v * 0.1); // Spin core faster with volume
      state.rotation += 0.002; // Slow HUD rotation

      ctx.clearRect(0, 0, width, height);
      
      // Enable Additive Blending for Neon Glow
      ctx.globalCompositeOperation = 'lighter';

      if (mode === 'circle') {
          const maxRadius = Math.min(width, height) / 2;
          
          // --- LAYER 1: The Holographic Core (Liquid Energy) ---
          ctx.beginPath();
          const coreRadius = maxRadius * 0.4;
          const variability = maxRadius * 0.25;
          
          for (let i = 0; i <= 120; i++) {
            const angle = (i / 120) * Math.PI * 2;
            
            // Complex Sine Summation for "Ferrofluid" shape
            const distortion = 
                Math.sin(angle * 3 + state.phase) * 0.5 + 
                Math.sin(angle * 7 - state.phase * 2) * 0.3 + 
                Math.sin(angle * 13 + state.phase * 1.5) * 0.2;
                
            const r = coreRadius + (vBoost * variability * (1 + distortion));
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          
          // Core Gradient
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 1.5);
          gradient.addColorStop(0, '#ffffff'); // Hot center
          gradient.addColorStop(0.3, color);   // Primary Color
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          
          // Core Stroke (The Containment Field)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 + (v * 2);
          ctx.globalAlpha = 0.5;
          ctx.stroke();

          // --- LAYER 2: Technical HUD Rings (The Machine) ---
          
          // Ring 1: Static Data Track
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius * 0.75, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 10]); // Dots
          ctx.globalAlpha = 0.2;
          ctx.stroke();

          // Ring 2: Rotating Segmented Ring (Outer)
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(-state.rotation); // Rotate counter-clockwise
          ctx.beginPath();
          ctx.arc(0, 0, maxRadius * 0.85 + (v * 10), 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([20, 40, 5, 40]); // Tech pattern
          ctx.globalAlpha = 0.3 + (v * 0.2); // Pulse opacity
          ctx.stroke();
          ctx.restore();

          // Ring 3: Fast Inner Spinner (Reactive)
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(state.rotation * 5 + (v * 2)); // Spin fast on volume
          ctx.beginPath();
          ctx.arc(0, 0, maxRadius * 0.55, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.setLineDash([50, 150]); // Few large segments
          ctx.globalAlpha = 0.1 + (v * 0.4);
          ctx.stroke();
          ctx.restore();
          
          // Reset Dash
          ctx.setLineDash([]);

          // --- LAYER 3: Data Particles (Sparks) ---
          // Emit particles on high volume
          if (v > 0.3 && state.particles.length < 15) {
              const angle = Math.random() * Math.PI * 2;
              const dist = coreRadius;
              state.particles.push({
                  x: centerX + Math.cos(angle) * dist,
                  y: centerY + Math.sin(angle) * dist,
                  vx: Math.cos(angle) * (2 + Math.random() * 2),
                  vy: Math.sin(angle) * (2 + Math.random() * 2),
                  life: 1.0,
                  size: 1 + Math.random() * 2
              });
          }

          for (let i = state.particles.length - 1; i >= 0; i--) {
              const p = state.particles[i];
              p.x += p.vx * (1 + v); // Speed up
              p.y += p.vy * (1 + v);
              p.life -= 0.04;

              if (p.life <= 0) {
                  state.particles.splice(i, 1);
                  continue;
              }

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.globalAlpha = p.life * 0.8;
              ctx.fill();
          }

      } else {
        // --- MODE: BARS (Oscilloscope View) ---
        // A mirrored, high-frequency line wave
        
        ctx.beginPath();
        const segments = 100;
        const spacing = width / segments;
        
        // Midline
        const midY = height / 2;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * spacing;
            
            // Normalized position (-1 to 1) relative to center
            const normX = (i - segments / 2) / (segments / 2);
            
            // Window function (Hanning) to taper ends to 0
            const window = 0.5 * (1 + Math.cos(normX * Math.PI));
            
            // Wave calculation
            const noise = Math.sin(i * 0.2 + state.phase * 5) * 0.5 + Math.sin(i * 0.5 - state.phase * 3) * 0.5;
            const waveHeight = height * 0.8 * v * window * Math.abs(noise);
            
            // Draw top half
            const y = midY - (waveHeight / 2);
            
            // Just draw lines
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        // Mirror bottom half in same path? No, let's just make it a thick band
        // Actually, let's do a filled path for the "Area" look
        for (let i = segments; i >= 0; i--) {
            const x = i * spacing;
            const normX = (i - segments / 2) / (segments / 2);
            const window = 0.5 * (1 + Math.cos(normX * Math.PI));
            const noise = Math.sin(i * 0.2 + state.phase * 5) * 0.5 + Math.sin(i * 0.5 - state.phase * 3) * 0.5;
            const waveHeight = height * 0.8 * v * window * Math.abs(noise);
            const y = midY + (waveHeight / 2);
            ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        
        // Fill
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.2, color);
        gradient.addColorStop(0.8, color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        
        // Top Line (Tech stroke)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, volume, color, mode]);

  return (
    <canvas 
        ref={canvasRef} 
        className={`block ${mode === 'circle' ? "w-full h-full" : "w-24 h-12"}`}
    />
  );
};

export default AudioVisualizer;
