import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { HaloHudOverlay, CircularCameraControl, ProximityRadar } from './HaloHudOverlay';
import marsTerrainImage from '@assets/mars_terrain_1767567282694.jpg';

interface CameraFeedProps {
  showOverlay?: boolean;
  className?: string;
  showCameraControl?: boolean;
  latitude?: number;
  longitude?: number;
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
  showCameraControl = true,
  latitude = 34.0522,
  longitude = -118.2437
}: CameraFeedProps) {
  const { isConnected } = useWebSocket();
  const [recordingTime, setRecordingTime] = useState(863);
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

  return (
    <div className={`relative w-full bg-black overflow-hidden border border-primary/20 shadow-2xl ${className}`}>
      <div className="aspect-video relative">
        {isDemoMode ? (
          <DemoSimulatedFeed />
        ) : (
          <img 
            src={marsTerrainImage} 
            alt="Rover Live Feed - No Signal" 
            className="w-full h-full object-cover"
          />
        )}
        
        {showOverlay && (
          <HaloHudOverlay 
            recordingTime={recordingTime}
            detectedObjects={detectedObjects}
            isDemoMode={isDemoMode}
            latitude={latitude}
            longitude={longitude}
          />
        )}

        {showCameraControl && (
          <div className="absolute z-20" style={{ left: '66px', bottom: '25px' }}>
            <CircularCameraControl />
          </div>
        )}

        {showCameraControl && (
          <div className="absolute z-20" style={{ right: '66px', bottom: '25px' }}>
            <ProximityRadar />
          </div>
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
