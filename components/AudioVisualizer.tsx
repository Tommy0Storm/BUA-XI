
import React, { useEffect, useRef } from 'react';

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

  // OBJECT POOLS
  // Pre-allocate arrays to prevent Garbage Collection during the render loop
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
    history: new Array(64).fill(0), // For radial graph
    lastVolume: 0
  });

  // Update color ref when prop changes
  useEffect(() => {
    rgbColor.current = hexToRgb(color);
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); // Optimize for transparency
    if (!ctx) return;

    let animationFrameId: number;
    
    // High-DPI Canvas Setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Initialize Buffers if needed
    if (inputAnalyser && !inputDataRef.current) {
        inputDataRef.current = new Uint8Array(inputAnalyser.frequencyBinCount);
    }
    if (outputAnalyser && !outputDataRef.current) {
        outputDataRef.current = new Uint8Array(outputAnalyser.frequencyBinCount);
    }

    // Helper: Spawn Particle from Pool
    const spawnParticle = (cx: number, cy: number, v: number) => {
        const pool = poolsRef.current.particles;
        // Find first inactive particle
        for (let i = 0; i < MAX_PARTICLES; i++) {
            if (!pool[i].active) {
                const angle = Math.random() * Math.PI * 2;
                const r = v * 20; // Spawn radius offset
                pool[i].active = true;
                pool[i].x = cx + Math.cos(angle) * r;
                pool[i].y = cy + Math.sin(angle) * r;
                pool[i].vx = Math.cos(angle) * (1 + Math.random());
                pool[i].vy = Math.sin(angle) * (1 + Math.random());
                pool[i].life = 1.0;
                pool[i].size = Math.random() * 2;
                break; // Spawn only one per call
            }
        }
    };

    // Helper: Spawn Shockwave from Pool
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
    
    // Animation Loop
    const render = () => {
      const state = stateRef.current;
      const pools = poolsRef.current;
      const rgb = rgbColor.current;
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2;

      // --- VOLUME CALCULATION (RMS) ---
      let maxVol = 0;
      
      if (isActive) {
          // Check Input (Mic)
          if (inputAnalyser && inputDataRef.current) {
             inputAnalyser.getByteTimeDomainData(inputDataRef.current as any);
             let sum = 0;
             const data = inputDataRef.current;
             // Optimization: Sample every 4th point to increase perf
             for (let i = 0; i < data.length; i += 4) {
                 const v = (data[i] - 128) / 128;
                 sum += v * v;
             }
             const rms = Math.sqrt(sum / (data.length / 4));
             if (rms > maxVol) maxVol = rms;
          }

          // Check Output (AI Speaker)
          if (outputAnalyser && outputDataRef.current) {
             outputAnalyser.getByteTimeDomainData(outputDataRef.current as any);
             let sum = 0;
             const data = outputDataRef.current;
             for (let i = 0; i < data.length; i += 4) {
                 const v = (data[i] - 128) / 128;
                 sum += v * v;
             }
             const rms = Math.sqrt(sum / (data.length / 4));
             if (rms > maxVol) maxVol = rms;
          }
      }

      // Safety check for NaN
      if (isNaN(maxVol) || !isFinite(maxVol)) maxVol = 0;
      
      // Artificial boost for visual impact
      maxVol = maxVol * 2.5; 

      // --- PHYSICS UPDATE ---
      
      // Smooth Volume (Attack/Release)
      const targetVolume = isActive ? Math.max(0.01, maxVol) : 0.01;
      const lerpFactor = targetVolume > state.smoothedVolume ? 0.3 : 0.05; 
      state.smoothedVolume += (targetVolume - state.smoothedVolume) * lerpFactor;
      
      const v = state.smoothedVolume;
      const vBoost = v * 2.0; 
      
      // Update History for Radial Graph
      state.history.push(v);
      state.history.shift();

      // Detect Beats for Shockwaves
      if (v > 0.35 && v - state.lastVolume > 0.1) {
          spawnShockwave(maxRadius, v);
      }
      state.lastVolume = v;

      // Global Rotation
      state.phase += 0.05 + (v * 0.1); 
      state.rotation += 0.005;

      // --- RENDER ---
      
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter'; // Additive blending

      if (mode === 'circle') {
          
          // 1. RENDER SHOCKWAVES (No Shadow)
          // Iterate pool
          for (let i = 0; i < MAX_SHOCKWAVES; i++) {
              const wave = pools.shockwaves[i];
              if (!wave.active) continue;

              wave.radius += 2 + (v * 5);
              wave.opacity -= 0.02;
              
              if (wave.opacity <= 0 || wave.radius > maxRadius) {
                  wave.active = false; // Return to pool
                  continue;
              }

              ctx.beginPath();
              ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${rgb}, ${wave.opacity * 0.5})`;
              ctx.lineWidth = wave.width;
              ctx.stroke();
          }

          // 2. RADIAL AUDIO GRAPH (Low Shadow)
          const graphRadius = maxRadius * 0.75;
          const histLen = state.history.length;
          const barWidthAngle = (Math.PI * 2) / histLen;
          
          ctx.beginPath();
          for(let i = 0; i < histLen; i++) {
              const val = state.history[i];
              const angle = i * barWidthAngle - Math.PI / 2 + state.rotation;
              const h = val * 40;
              
              const cosA = Math.cos(angle);
              const sinA = Math.sin(angle);

              const x1 = centerX + cosA * (graphRadius);
              const y1 = centerY + sinA * (graphRadius);
              const x2 = centerX + cosA * (graphRadius + h + 2);
              const y2 = centerY + sinA * (graphRadius + h + 2);
              
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
          }
          ctx.strokeStyle = `rgba(${rgb}, 0.3)`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 3. TECHNICAL RINGS (Static)
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

          // 4. THE CORE (High Glow - Expensive)
          // Group shadow calls together to minimize state changes
          const coreBaseRadius = maxRadius * 0.35;
          ctx.save();
          ctx.shadowBlur = 30 * vBoost;
          ctx.shadowColor = `rgba(${rgb}, 0.8)`;
          
          ctx.beginPath();
          // Reduce complexity: 50 points instead of 100 is visually similar but faster
          for (let i = 0; i <= 50; i++) {
              const angle = (i / 50) * Math.PI * 2;
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
          ctx.restore(); // Turn off shadow

          // 5. WIREFRAME MESH
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreBaseRadius * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();

          // 6. PARTICLES (No Shadow)
          if (v > 0.1) {
             spawnParticle(centerX, centerY, v);
          }

          // Render Active Particles
          for (let i = 0; i < MAX_PARTICLES; i++) {
              const p = pools.particles[i];
              if (!p.active) continue;

              p.x += p.vx * (1 + v);
              p.y += p.vy * (1 + v);
              p.life -= 0.03;

              if (p.life <= 0) {
                  p.active = false; // Return to pool
                  continue;
              }

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${rgb}, ${p.life})`;
              ctx.fill();
          }

      } else {
        // --- MODE: BARS (Preview) ---
        const bars = 20;
        const barWidth = width / bars;
        const spacing = 1;
        
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
            ctx.fillRect(x + spacing, y, barWidth - spacing * 2, h);
            
            ctx.fillStyle = `rgba(${rgb}, 0.2)`;
            ctx.fillRect(x + spacing, y + h + 2, barWidth - spacing * 2, h * 0.3);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, inputAnalyser, outputAnalyser, color, mode]);

  return (
    <canvas 
        ref={canvasRef} 
        className={`block ${mode === 'circle' ? "w-full h-full" : "w-24 h-12"}`}
    />
  );
};

export default AudioVisualizer;
