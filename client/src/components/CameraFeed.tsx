import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import generatedImage from '@assets/generated_images/fpv_rover_camera_view_of_a_mars-like_rocky_terrain_with_hud_overlay_elements.png';

interface CameraFeedProps {
  showOverlay?: boolean;
  className?: string;
}

export default function CameraFeed({ showOverlay = true, className = '' }: CameraFeedProps) {
  const { isConnected } = useWebSocket();
  const [recordingTime, setRecordingTime] = useState(863);
  const isDemoMode = !isConnected;

  useEffect(() => {
    const timer = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
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
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
              <div className="w-[150px] h-[150px] border border-primary/40 rounded-full flex items-center justify-center relative">
                <div className="w-1 h-3 bg-primary absolute top-0 -translate-y-1/2"></div>
                <div className="w-1 h-3 bg-primary absolute bottom-0 translate-y-1/2"></div>
                <div className="w-3 h-1 bg-primary absolute left-0 -translate-x-1/2"></div>
                <div className="w-3 h-1 bg-primary absolute right-0 translate-x-1/2"></div>
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
            </div>

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

            <motion.div 
              animate={{ 
                x: [80, 100, 80], 
                y: [40, 50, 40],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-1/4 left-1/4 w-24 h-24 border-2 border-accent/70 rounded-sm pointer-events-none"
            >
              <div className="absolute -top-4 left-0 text-[10px] bg-accent text-accent-foreground px-1 font-mono font-bold">OBSTACLE_ROCK</div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white"></div>
            </motion.div>
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
