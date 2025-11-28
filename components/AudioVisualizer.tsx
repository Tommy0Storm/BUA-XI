import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
  color: string;
  mode?: 'bars' | 'circle';
}

// Helper to handle color manipulation
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
};

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, volume, color, mode = 'circle' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbColor = useRef(hexToRgb(color));
  
  // State for complex animation physics
  const stateRef = useRef({
    phase: 0,
    rotation: 0,
    smoothedVolume: 0,
    history: new Array(64).fill(0), // For radial graph
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; size: number }[],
    shockwaves: [] as { radius: number; opacity: number; width: number }[],
    lastVolume: 0
  });

  // Update color ref when prop changes without re-triggering effect loop logic directly
  useEffect(() => {
    rgbColor.current = hexToRgb(color);
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // High-DPI Canvas Setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Animation Loop
    const render = () => {
      const state = stateRef.current;
      const rgb = rgbColor.current;
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2;

      // --- PHYSICS UPDATE ---
      
      // Smooth Volume (Attack/Release)
      const targetVolume = isActive ? Math.max(0.01, volume) : 0.01;
      // Faster attack for punchy visuals, slower release for smoothness
      const lerpFactor = targetVolume > state.smoothedVolume ? 0.3 : 0.05; 
      state.smoothedVolume += (targetVolume - state.smoothedVolume) * lerpFactor;
      
      const v = state.smoothedVolume;
      const vBoost = v * 2.0; // Amplified for visual impact
      
      // Update History for Radial Graph
      if (isActive) {
        state.history.push(v);
        state.history.shift();
      }

      // Detect Beats for Shockwaves
      if (v > 0.35 && v - state.lastVolume > 0.1) {
          state.shockwaves.push({ radius: maxRadius * 0.3, opacity: 1, width: 2 + v * 10 });
      }
      state.lastVolume = v;

      // Global Rotation
      state.phase += 0.05 + (v * 0.1); 
      state.rotation += 0.005;

      // --- RENDER ---
      
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter'; // Additive blending for neon look

      if (mode === 'circle') {
          // 1. SHOCKWAVES (Background ripples)
          for (let i = state.shockwaves.length - 1; i >= 0; i--) {
              const wave = state.shockwaves[i];
              wave.radius += 2 + (v * 5);
              wave.opacity -= 0.02;
              
              if (wave.opacity <= 0 || wave.radius > maxRadius) {
                  state.shockwaves.splice(i, 1);
                  continue;
              }

              ctx.beginPath();
              ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${rgb}, ${wave.opacity * 0.5})`;
              ctx.lineWidth = wave.width;
              ctx.stroke();
          }

          // 2. RADIAL AUDIO GRAPH (The "Data" Ring)
          const graphRadius = maxRadius * 0.75;
          const barWidth = (Math.PI * 2) / state.history.length;
          
          ctx.beginPath();
          state.history.forEach((val, i) => {
              const angle = i * barWidth - Math.PI / 2 + state.rotation; // Rotate with HUD
              const h = val * 40; // Bar height
              
              // Inner point
              const x1 = centerX + Math.cos(angle) * (graphRadius);
              const y1 = centerY + Math.sin(angle) * (graphRadius);
              // Outer point
              const x2 = centerX + Math.cos(angle) * (graphRadius + h + 2);
              const y2 = centerY + Math.sin(angle) * (graphRadius + h + 2);
              
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
          });
          ctx.strokeStyle = `rgba(${rgb}, 0.3)`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 3. TECHNICAL RINGS (HUD)
          // Outer static ring
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius * 0.9, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb}, 0.1)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.stroke();
          
          // Rotating segmented ring
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(-state.rotation * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, maxRadius * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([40, 20, 10, 80]); 
          ctx.stroke();
          ctx.restore();

          // 4. THE CORE (Liquid Energy)
          // We draw multiple sine waves stacked to create a "fluid" orb
          const coreBaseRadius = maxRadius * 0.35;
          
          ctx.save();
          // Glow Effect
          ctx.shadowBlur = 30 * vBoost;
          ctx.shadowColor = `rgba(${rgb}, 0.8)`;
          
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
              const angle = (i / 100) * Math.PI * 2;
              // Superimposing sine waves for organic shape
              const r = coreBaseRadius + 
                        Math.sin(angle * 5 + state.phase) * (10 * vBoost) + 
                        Math.cos(angle * 3 - state.phase) * (5 * vBoost);
              
              const x = centerX + Math.cos(angle) * r;
              const y = centerY + Math.sin(angle) * r;
              
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
          
          // Gradient Fill
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreBaseRadius * 1.5);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.4, `rgba(${rgb}, 0.8)`);
          gradient.addColorStop(1, `rgba(${rgb}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.restore();

          // 5. INNER CORE MESH (Wireframe on top)
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreBaseRadius * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();

          // 6. PARTICLES
          if (v > 0.1) {
             const angle = Math.random() * Math.PI * 2;
             // Spawn at core edge
             const r = coreBaseRadius; 
             state.particles.push({
                 x: centerX + Math.cos(angle) * r,
                 y: centerY + Math.sin(angle) * r,
                 vx: Math.cos(angle) * (1 + Math.random()),
                 vy: Math.sin(angle) * (1 + Math.random()),
                 life: 1.0,
                 size: Math.random() * 2
             });
          }

          for (let i = state.particles.length - 1; i >= 0; i--) {
              const p = state.particles[i];
              p.x += p.vx * (1 + v);
              p.y += p.vy * (1 + v);
              p.life -= 0.03;

              if (p.life <= 0) {
                  state.particles.splice(i, 1);
                  continue;
              }

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${rgb}, ${p.life})`;
              ctx.fill();
          }

      } else {
        // --- MODE: BARS (Mini-Equalizer) ---
        // Clean, sharp, technical look for the preview list
        const bars = 20;
        const barWidth = width / bars;
        const spacing = 1;
        
        // Background line
        ctx.beginPath();
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
        ctx.stroke();

        for (let i = 0; i < bars; i++) {
            // Pseudo-frequency data based on volume and index
            const noise = Math.abs(Math.sin(i * 0.5 + state.phase * 2));
            const h = height * 0.8 * v * noise;
            
            const x = i * barWidth;
            const y = (height - h) / 2;
            
            // Draw Bar
            ctx.fillStyle = `rgba(${rgb}, 0.8)`;
            ctx.fillRect(x + spacing, y, barWidth - spacing * 2, h);
            
            // Draw Reflection (faint)
            ctx.fillStyle = `rgba(${rgb}, 0.2)`;
            ctx.fillRect(x + spacing, y + h + 2, barWidth - spacing * 2, h * 0.3);
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
        className={`block ${mode === 'circle' ? "w-full h-full" : "w-24 h-12"}`}
    />
  );
};

export default AudioVisualizer;
