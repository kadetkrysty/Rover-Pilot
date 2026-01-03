import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import generatedImage from '@assets/generated_images/fpv_rover_camera_view_of_a_mars-like_rocky_terrain_with_hud_overlay_elements.png';

interface CameraFeedProps {
  showOverlay?: boolean;
  className?: string;
  showTrajectory?: boolean;
  showAiTimer?: boolean;
}

interface DetectedObject {
  id: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function CameraFeed({ 
  showOverlay = true, 
  className = '',
  showTrajectory = true,
  showAiTimer = true
}: CameraFeedProps) {
  const { isConnected } = useWebSocket();
  const [recordingTime, setRecordingTime] = useState(863);
  const [aiProcessingTime, setAiProcessingTime] = useState(0);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([
    { id: 'OBJ_001', type: 'OBSTACLE_ROCK', confidence: 94, x: 25, y: 25, width: 15, height: 15 },
    { id: 'OBJ_002', type: 'TERRAIN_HAZARD', confidence: 78, x: 60, y: 45, width: 12, height: 10 }
  ]);
  const isDemoMode = !isConnected;

  useEffect(() => {
    const timer = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const aiTimer = setInterval(() => {
      setAiProcessingTime(t => t + 1);
      if (Math.random() > 0.7) {
        setDetectedObjects(prev => prev.map(obj => ({
          ...obj,
          x: obj.x + (Math.random() - 0.5) * 2,
          y: obj.y + (Math.random() - 0.5) * 1,
          confidence: Math.max(70, Math.min(99, obj.confidence + (Math.random() - 0.5) * 3))
        })));
      }
    }, 100);
    return () => clearInterval(aiTimer);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative w-full bg-black overflow-hidden border border-primary/20 shadow-2xl ${className}`}>
      <div className="aspect-video relative">
        {isDemoMode ? (
          <DemoSimulatedFeed />
        ) : (
          <img 
            src={generatedImage} 
            alt="Rover Live Feed" 
            className="w-full h-full object-cover opacity-80"
          />
        )}
        
        {showOverlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
            
            {showAiTimer && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-gradient-to-b from-cyan-500/20 to-transparent px-6 py-2 rounded-b-lg border-x border-b border-cyan-500/30">
                  <div className="text-center">
                    <div className="text-[10px] font-mono text-cyan-400/80 tracking-widest">AI TIMER</div>
                    <div className="text-lg font-mono font-bold text-cyan-400 tabular-nums">
                      {(aiProcessingTime / 10).toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
              <div className="w-[150px] h-[150px] border border-primary/40 rounded-full flex items-center justify-center relative">
                <div className="w-1 h-3 bg-primary absolute top-0 -translate-y-1/2"></div>
                <div className="w-1 h-3 bg-primary absolute bottom-0 translate-y-1/2"></div>
                <div className="w-3 h-1 bg-primary absolute left-0 -translate-x-1/2"></div>
                <div className="w-3 h-1 bg-primary absolute right-0 translate-x-1/2"></div>
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
            </div>

            {showTrajectory && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trajectoryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.1)" />
                    <stop offset="50%" stopColor="rgba(239, 68, 68, 0.6)" />
                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0.9)" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M 50 95 Q 45 70 48 55 Q 52 40 50 30 Q 47 20 52 10"
                  fill="none"
                  stroke="url(#trajectoryGradient)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: [0, 1, 1],
                    opacity: [0, 0.8, 0.4]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.circle
                  r="1"
                  fill="#ef4444"
                  animate={{
                    cx: [50, 48, 52, 50],
                    cy: [95, 55, 30, 10],
                    opacity: [1, 0.8, 0.6, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </svg>
            )}

            <div className="absolute top-3 left-3 font-mono text-xs text-primary/80 bg-black/60 p-2 rounded backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                REC {formatTime(recordingTime)}
              </div>
              <div>CAM: HUSKY_LENS_AI_01</div>
              <div>RES: 1080p 60FPS</div>
            </div>

            {isDemoMode && (
              <div className="absolute top-3 right-3 bg-accent/80 px-2 py-1 rounded text-xs font-mono">
                DEMO MODE
              </div>
            )}

            {detectedObjects.map((obj, idx) => (
              <motion.div
                key={obj.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  width: `${obj.width}%`,
                  height: `${obj.height}%`
                }}
                animate={{
                  opacity: [0.6, 0.9, 0.6],
                  scale: [1, 1.02, 1]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.5 }}
              >
                <div className={`w-full h-full border-2 rounded-sm ${
                  obj.type.includes('HAZARD') ? 'border-red-500/80' : 'border-accent/70'
                }`}>
                  <div className={`absolute -top-5 left-0 text-[9px] px-1.5 py-0.5 font-mono font-bold flex items-center gap-1 ${
                    obj.type.includes('HAZARD') ? 'bg-red-500 text-white' : 'bg-accent text-accent-foreground'
                  }`}>
                    <span>{obj.type}</span>
                    <span className="opacity-70">{Math.round(obj.confidence)}%</span>
                  </div>
                  <div className="absolute -bottom-3 left-0 text-[8px] bg-black/70 text-white/70 px-1 font-mono">
                    {obj.id}
                  </div>
                  <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white/80"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white/80"></div>
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white/80"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white/80"></div>
                </div>
              </motion.div>
            ))}

            <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-cyan-400/80 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                AI: {detectedObjects.length} OBJECTS
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DemoSimulatedFeed() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.fillStyle = 'hsl(30, 60%, 15%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizonY = canvas.height * 0.45;
      
      ctx.fillStyle = 'hsl(25, 50%, 25%)';
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, 'hsl(220, 30%, 10%)');
      skyGrad.addColorStop(1, 'hsl(30, 40%, 20%)');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, horizonY);

      for (let i = 0; i < 12; i++) {
        const rockX = ((canvas.width / 2 + i * 100 + t * 8) % (canvas.width + 150)) - 75;
        const rockY = horizonY + 15 + Math.sin(i * 2.1) * 40 + (i % 3) * 25;
        const rockSize = 15 + Math.sin(i * 1.5) * 10;
        
        ctx.fillStyle = `hsl(25, ${25 + i * 2}%, ${12 + Math.sin(t + i) * 2}%)`;
        ctx.beginPath();
        ctx.ellipse(rockX, rockY, rockSize, rockSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < 6; i++) {
        const boulderX = ((canvas.width / 2 + i * 150 + 40) % canvas.width);
        const boulderY = horizonY + 60 + i * 18;
        const size = 25 + i * 4;
        
        ctx.fillStyle = `hsl(20, 22%, ${10 + Math.sin(t * 0.5 + i) * 2}%)`;
        ctx.beginPath();
        ctx.moveTo(boulderX, boulderY - size);
        ctx.lineTo(boulderX + size * 0.8, boulderY + size * 0.4);
        ctx.lineTo(boulderX - size * 0.8, boulderY + size * 0.4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      for (let y = 0; y < canvas.height; y += 2) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      className="w-full h-full object-cover"
    />
  );
}
