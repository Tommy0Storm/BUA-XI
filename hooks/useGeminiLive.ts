import React, { useEffect, useRef, useMemo } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  color: string;
  mode?: 'bars' | 'circle';
}

// Pooling Constants
const MAX_PARTICLES = 60;
const MAX_SHOCKWAVES = 10;
const HIST_LEN = 64; // Fixed history length for radial graph

// Reusable Object Types
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; active: boolean };
type Shockwave = { radius: number; opacity: number; width: number; active: boolean };

// Helper to handle color manipulation
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
};

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, inputAnalyser, outputAnalyser, color, mode = 'circle' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbColor = useRef(hexToRgb(color));
  
  // Reusable data buffers for the analysers
  const inputDataRef = useRef<Uint8Array | null>(null);
  const outputDataRef = useRef<Uint8Array | null>(null);

  // Pre-calculate Trigonometry Tables to avoid Math.cos/sin in the hot loop
  // Angles are relative to the ring's local rotation (0 to 2PI)
  const trigTable = useMemo(() => {
    const cosTable = new Float32Array(HIST_LEN);
    const sinTable = new Float32Array(HIST_LEN);
    const angleStep = (Math.PI * 2) / HIST_LEN;
    for(let i=0; i<HIST_LEN; i++) {
        // Offset by -Math.PI/2 so index 0 starts at top
        const angle = i * angleStep - Math.PI / 2;
        cosTable[i] = Math.cos(angle);
        sinTable[i] = Math.sin(angle);
    }
    return { cos: cosTable, sin: sinTable };
  }, []);

  // OBJECT POOLS
  const poolsRef = useRef({
      particles: Array.from({ length: MAX_PARTICLES }, (): Particle => ({ 
          x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0, active: false 
      })),
      shockwaves: Array.from({ length: MAX_SHOCKWAVES }, (): Shockwave => ({ 
          radius: 0, opacity: 0, width: 0, active: false 
      }))
  });

  // State for complex animation physics
  const stateRef = useRef({
    phase: 0,
    rotation: 0,
    smoothedVolume: 0,
    history: new Array(HIST_LEN).fill(0), 
    lastVolume: 0
  });

  useEffect(() => {
    rgbColor.current = hexToRgb(color);
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    
    // High-DPI Canvas Setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    if (inputAnalyser && !inputDataRef.current) {
        inputDataRef.current = new Uint8Array(inputAnalyser.frequencyBinCount);
    }
    if (outputAnalyser && !outputDataRef.current) {
        outputDataRef.current = new Uint8Array(outputAnalyser.frequencyBinCount);
    }

    const spawnParticle = (cx: number, cy: number, v: number) => {
        const pool = poolsRef.current.particles;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            if (!pool[i].active) {
                const angle = Math.random() * Math.PI * 2;
                const r = v * 20; 
                pool[i].active = true;
                pool[i].x = cx + Math.cos(angle) * r;
                pool[i].y = cy + Math.sin(angle) * r;
                pool[i].vx = Math.cos(angle) * (1 + Math.random());
                pool[i].vy = Math.sin(angle) * (1 + Math.random());
                pool[i].life = 1.0;
                pool[i].size = Math.random() * 2;
                break;
            }
        }
    };

    const spawnShockwave = (baseRadius: number, v: number) => {
        const pool = poolsRef.current.shockwaves;
        for (let i = 0; i < MAX_SHOCKWAVES; i++) {
            if (!pool[i].active) {
                pool[i].active = true;
                pool[i].radius = baseRadius * 0.3;
                pool[i].opacity = 1;
                pool[i].width = 2 + v * 10;
                break;
            }
        }
    };
    
    const render = () => {
      const state = stateRef.current;
      const pools = poolsRef.current;
      const rgb = rgbColor.current;
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2;

      // --- VOLUME CALCULATION ---
      let maxVol = 0;
      
      if (isActive) {
          if (inputAnalyser && inputDataRef.current) {
             inputAnalyser.getByteTimeDomainData(inputDataRef.current as any);
             const data = inputDataRef.current;
             let sum = 0;
             // Opt: Sample every 8th point
             for (let i = 0; i < data.length; i += 8) {
                 const v = (data[i] - 128) / 128;
                 sum += v * v;
             }
             // Correct for sparse sampling in average
             const rms = Math.sqrt(sum / (data.length / 8));
             if (rms > maxVol) maxVol = rms;
          }

          if (outputAnalyser && outputDataRef.current) {
             outputAnalyser.getByteTimeDomainData(outputDataRef.current as any);
             const data = outputDataRef.current;
             let sum = 0;
             for (let i = 0; i < data.length; i += 8) {
                 const v = (data[i] - 128) / 128;
                 sum += v * v;
             }
             const rms = Math.sqrt(sum / (data.length / 8));
             if (rms > maxVol) maxVol = rms;
          }
      }

      if (isNaN(maxVol) || !isFinite(maxVol)) maxVol = 0;
      // Increased sensitivity by 30% (2.5 -> 3.25)
      maxVol = maxVol * 3.25; 

      const targetVolume = isActive ? Math.max(0.01, maxVol) : 0.01;
      const lerpFactor = targetVolume > state.smoothedVolume ? 0.3 : 0.05; 
      state.smoothedVolume += (targetVolume - state.smoothedVolume) * lerpFactor;
      
      const v = state.smoothedVolume;
      const vBoost = v * 2.0; 
      
      state.history.push(v);
      state.history.shift();

      if (v > 0.35 && v - state.lastVolume > 0.1) {
          spawnShockwave(maxRadius, v);
      }
      state.lastVolume = v;

      state.phase += 0.05 + (v * 0.1); 
      state.rotation += 0.005;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter'; 

      if (mode === 'circle') {
          
          // 1. RENDER SHOCKWAVES
          for (let i = 0; i < MAX_SHOCKWAVES; i++) {
              const wave = pools.shockwaves[i];
              if (!wave.active) continue;

              wave.radius += 2 + (v * 5);
              wave.opacity -= 0.02;
              
              if (wave.opacity <= 0 || wave.radius > maxRadius) {
                  wave.active = false; 
                  continue;
              }

              ctx.beginPath();
              ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${rgb}, ${wave.opacity * 0.5})`;
              ctx.lineWidth = wave.width;
              ctx.stroke();
          }

          // 2. RADIAL AUDIO GRAPH (Optimized with Context Rotation)
          const graphRadius = maxRadius * 0.75;
          
          // Save context, translate to center, rotate ONLY the context
          // This avoids calculating sin/cos for every point relative to rotation
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(state.rotation);
          
          ctx.beginPath();
          // Skip every 2nd point for performance
          for(let i = 0; i < HIST_LEN; i += 2) {
              const val = state.history[i];
              if (val < 0.01) continue;
              
              const h = val * 40;
              // Use pre-calculated trig values from Float32Array
              const cos = trigTable.cos[i];
              const sin = trigTable.sin[i];
              
              // Draw relative to center (0,0)
              const x1 = cos * graphRadius;
              const y1 = sin * graphRadius;
              const x2 = cos * (graphRadius + h + 2);
              const y2 = sin * (graphRadius + h + 2);
              
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
          }
          
          ctx.strokeStyle = `rgba(${rgb}, 0.3)`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore(); // Restore context to standard grid

          // 3. TECHNICAL RINGS
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius * 0.9, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb}, 0.1)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.stroke();
          
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

          // 4. THE CORE
          const coreBaseRadius = maxRadius * 0.35;
          ctx.save();
          ctx.shadowBlur = 30 * vBoost;
          ctx.shadowColor = `rgba(${rgb}, 0.8)`;
          
          ctx.beginPath();
          // Reduced resolution circle for core (40 steps is enough for visual smoothing)
          for (let i = 0; i <= 40; i++) {
              const angle = (i / 40) * Math.PI * 2;
              const r = coreBaseRadius + 
                        Math.sin(angle * 5 + state.phase) * (10 * vBoost) + 
                        Math.cos(angle * 3 - state.phase) * (5 * vBoost);
              
              const x = centerX + Math.cos(angle) * r;
              const y = centerY + Math.sin(angle) * r;
              
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
          
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreBaseRadius * 1.5);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.4, `rgba(${rgb}, 0.8)`);
          gradient.addColorStop(1, `rgba(${rgb}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.restore();

          // 5. WIREFRAME MESH
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreBaseRadius * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();

          // 6. PARTICLES
          if (v > 0.1) spawnParticle(centerX, centerY, v);

          for (let i = 0; i < MAX_PARTICLES; i++) {
              const p = pools.particles[i];
              if (!p.active) continue;

              p.x += p.vx * (1 + v);
              p.y += p.vy * (1 + v);
              p.life -= 0.03;

              if (p.life <= 0) {
                  p.active = false;
                  continue;
              }

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${rgb}, ${p.life})`;
              ctx.fill();
          }

      } else {
        // PREVIEW MODE (BARS)
        const bars = 20;
        const barWidth = width / bars;
        
        ctx.beginPath();
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
        ctx.stroke();

        for (let i = 0; i < bars; i++) {
            const noise = Math.abs(Math.sin(i * 0.5 + state.phase * 2));
            const h = height * 0.8 * v * noise;
            const x = i * barWidth;
            const y = (height - h) / 2;
            
            ctx.fillStyle = `rgba(${rgb}, 0.8)`;
            ctx.fillRect(x + 1, y, barWidth - 2, h);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, inputAnalyser, outputAnalyser, color, mode, trigTable]);

  return (
    <canvas 
        ref={canvasRef} 
        className={`block ${mode === 'circle' ? "w-full h-full" : "w-24 h-12"}`}
    />
  );
};

export default AudioVisualizer;
