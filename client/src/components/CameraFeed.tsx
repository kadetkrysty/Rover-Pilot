import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { useQuery } from '@tanstack/react-query';
import { HaloHudOverlay, CircularCameraControl, ProximityRadar } from './HaloHudOverlay';
import marsTerrainImage from '@assets/mars_terrain_1767567282694.jpg';

interface CameraFeedProps {
  showOverlay?: boolean;
  className?: string;
  showCameraControl?: boolean;
  latitude?: number;
  longitude?: number;
  showDetectedObjects?: boolean;
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

interface CameraConfig {
  camera: string;
  objectDetection: string;
  panTilt: string;
  streamUrl: string;
  snapshotUrl: string;
  capabilities: {
    resolution: string;
    wireless: boolean;
    battery: boolean;
    nightVision: boolean;
    rtsp: boolean;
  };
}

export default function CameraFeed({ 
  showOverlay = true, 
  className = '',
  showCameraControl = true,
  latitude = 0,
  longitude = 0,
  showDetectedObjects = true
}: CameraFeedProps) {
  const { isConnected } = useWebSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [recordingTime, setRecordingTime] = useState(863);
  const [streamError, setStreamError] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([
    { id: 'OBJ_001', type: 'OBSTACLE_ROCK', confidence: 94, x: 25, y: 25, width: 15, height: 15 },
    { id: 'OBJ_002', type: 'TERRAIN_HAZARD', confidence: 78, x: 60, y: 45, width: 12, height: 10 }
  ]);

  const { data: cameraConfig } = useQuery<CameraConfig>({
    queryKey: ['/api/camera/config'],
    refetchInterval: 30000,
  });

  const hasLiveStream = !!(cameraConfig?.streamUrl) && !streamError;
  const isDemoMode = !isConnected && !hasLiveStream;

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

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

  useEffect(() => {
    setStreamError(false);
  }, [cameraConfig?.streamUrl]);

  const controlSize = Math.max(80, Math.min(180, containerSize.width * 0.146));
  const leftOffset = containerSize.width * 0.163;
  const rightOffset = containerSize.width * 0.163;
  const bottomOffset = containerSize.height * 0.19;

  return (
    <div ref={containerRef} className={`relative w-full bg-black overflow-hidden border border-primary/20 shadow-2xl ${className}`}>
      <div className="aspect-video relative">
        {hasLiveStream ? (
          <LiveCameraStream 
            streamUrl={cameraConfig!.streamUrl}
            onError={() => setStreamError(true)}
          />
        ) : isDemoMode ? (
          <DemoSimulatedFeed />
        ) : streamError ? (
          <CameraOfflineFallback 
            onRetry={() => setStreamError(false)}
          />
        ) : (
          <img 
            src={marsTerrainImage} 
            alt="Rover Camera - Waiting for stream" 
            className="w-full h-full object-cover"
          />
        )}
        
        {showOverlay && (
          <HaloHudOverlay 
            recordingTime={recordingTime}
            detectedObjects={showDetectedObjects ? detectedObjects : []}
            isDemoMode={isDemoMode}
            latitude={latitude}
            longitude={longitude}
            cameraSource={hasLiveStream ? 'IMOU_CELL_GO' : 'DEMO'}
          />
        )}

        {showCameraControl && containerSize.width > 0 && (
          <div className="absolute z-20" style={{ left: `${leftOffset}px`, bottom: `${bottomOffset}px`, transform: 'translate(-50%, 50%)' }}>
            <CircularCameraControl size={controlSize} />
          </div>
        )}

        {showCameraControl && containerSize.width > 0 && (
          <div className="absolute z-20" style={{ right: `${rightOffset}px`, bottom: `${bottomOffset}px`, transform: 'translate(50%, 50%)' }}>
            <ProximityRadar size={controlSize} />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveCameraStream({ streamUrl, onError }: { streamUrl: string; onError: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true);

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <div className="text-xs font-mono text-primary/70">CONNECTING TO IMOU CELL GO...</div>
          </div>
        </div>
      )}
      <img
        ref={imgRef}
        src={streamUrl}
        alt="Imou CELL GO Live Feed"
        className="w-full h-full object-cover"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          onError();
        }}
        data-testid="img-live-camera-feed"
      />
    </div>
  );
}

function CameraOfflineFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-950 to-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-2 border-red-500/50 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-mono text-red-400">CAMERA STREAM OFFLINE</div>
          <div className="text-xs font-mono text-muted-foreground">Imou CELL GO not responding</div>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-xs font-mono bg-primary/20 border border-primary/40 rounded hover:bg-primary/30 transition-colors text-primary"
          data-testid="button-retry-camera"
        >
          RETRY CONNECTION
        </button>
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
