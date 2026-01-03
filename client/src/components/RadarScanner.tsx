import { useEffect, useRef, useState, useMemo } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RadarScannerProps {
  ultrasonicData: [number, number, number, number, number];
  lidarDistance: number;
  className?: string;
}

interface ObstaclePoint {
  angle: number;
  distance: number;
  type: 'ultrasonic' | 'lidar';
  label: string;
  timestamp: number;
}

const ULTRASONIC_LABELS = [
  'FRONT',
  'FRONT-L',
  'FRONT-R',
  'LEFT',
  'RIGHT',
];

const ULTRASONIC_ANGLES = [
  0,    // Front center
  -45,  // Front left
  45,   // Front right
  -90,  // Left
  90,   // Right
];

const MAX_RANGE = 600;
const FADE_DURATION = 2000;

export default function RadarScanner({ ultrasonicData, lidarDistance, className }: RadarScannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [obstacles, setObstacles] = useState<ObstaclePoint[]>([]);
  const [containerWidth, setContainerWidth] = useState(200);
  const { isConnected } = useWebSocket();

  const size = useMemo(() => Math.floor(containerWidth * 0.8), [containerWidth]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const newObstacles: ObstaclePoint[] = [];

    ultrasonicData.forEach((distance, index) => {
      if (distance > 0 && distance < MAX_RANGE) {
        newObstacles.push({
          angle: ULTRASONIC_ANGLES[index],
          distance,
          type: 'ultrasonic',
          label: ULTRASONIC_LABELS[index],
          timestamp: now,
        });
      }
    });

    if (lidarDistance > 0 && lidarDistance < MAX_RANGE) {
      newObstacles.push({
        angle: 0,
        distance: lidarDistance,
        type: 'lidar',
        label: 'LIDAR',
        timestamp: now,
      });
    }

    setObstacles(prev => {
      const filtered = prev.filter(p => now - p.timestamp < FADE_DURATION);
      return [...filtered, ...newObstacles];
    });
  }, [ultrasonicData, lidarDistance]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 50) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2 - 15;

    ctx.fillStyle = 'rgba(0, 20, 30, 0.95)';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)';
    ctx.lineWidth = 1;
    const rings = [0.25, 0.5, 0.75, 1];
    rings.forEach(ratio => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(0, 255, 200, 0.1)';
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle - 90) * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(rad) * maxRadius,
        centerY + Math.sin(rad) * maxRadius
      );
      ctx.stroke();
    }

    const sweepRad = (sweepAngle - 90) * (Math.PI / 180);
    const gradient = ctx.createConicGradient(sweepRad, centerX, centerY);
    gradient.addColorStop(0, 'rgba(0, 255, 200, 0.4)');
    gradient.addColorStop(0.1, 'rgba(0, 255, 200, 0.1)');
    gradient.addColorStop(0.2, 'rgba(0, 255, 200, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 200, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, maxRadius, sweepRad - 0.5, sweepRad);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 200, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(sweepRad) * maxRadius,
      centerY + Math.sin(sweepRad) * maxRadius
    );
    ctx.stroke();

    const now = Date.now();
    obstacles.forEach(obstacle => {
      const age = now - obstacle.timestamp;
      const opacity = Math.max(0, 1 - age / FADE_DURATION);
      
      const angleRad = (obstacle.angle - 90) * (Math.PI / 180);
      const distRatio = Math.min(obstacle.distance / MAX_RANGE, 1);
      const pointX = centerX + Math.cos(angleRad) * (distRatio * maxRadius);
      const pointY = centerY + Math.sin(angleRad) * (distRatio * maxRadius);

      if (obstacle.type === 'ultrasonic') {
        ctx.fillStyle = `rgba(0, 255, 100, ${opacity})`;
        ctx.shadowColor = 'rgba(0, 255, 100, 0.8)';
      } else {
        ctx.fillStyle = `rgba(0, 200, 255, ${opacity})`;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
      }
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(pointX, pointY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.fillStyle = 'rgba(0, 255, 200, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    const fontSize = Math.max(8, Math.floor(size / 20));
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = 'rgba(0, 255, 200, 0.6)';
    ctx.textAlign = 'center';
    
    ctx.fillText('N', centerX, fontSize + 2);
    ctx.fillText('S', centerX, size - 4);
    ctx.fillText('W', fontSize - 2, centerY + 3);
    ctx.fillText('E', size - fontSize + 2, centerY + 3);

  }, [size, sweepAngle, obstacles]);

  const latestObstacles = useMemo(() => {
    const now = Date.now();
    const recent = obstacles.filter(o => now - o.timestamp < 500);
    const uniqueByLabel = new Map<string, ObstaclePoint>();
    recent.forEach(o => {
      const existing = uniqueByLabel.get(o.label);
      if (!existing || o.timestamp > existing.timestamp) {
        uniqueByLabel.set(o.label, o);
      }
    });
    return Array.from(uniqueByLabel.values()).sort((a, b) => a.distance - b.distance);
  }, [obstacles]);

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className}`}>
      <div className="flex justify-between items-center" style={{ paddingBottom: '12px' }}>
        <h3 className="text-xs font-display text-primary/50">PROXIMITY RADAR</h3>
        {!isConnected && (
          <div className="bg-accent/80 px-1.5 py-0.5 rounded text-[8px] font-mono">
            DEMO
          </div>
        )}
      </div>
      
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-full border border-primary/30"
        />
      </div>

      <div className="flex justify-center gap-4 mt-2 text-[9px] font-mono">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-muted-foreground">ULTRASONIC</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          <span className="text-muted-foreground">LIDAR</span>
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0">
        <h4 className="text-[10px] font-display text-primary/40 mb-2">DETECTED OBSTACLES</h4>
        <ScrollArea className="h-full max-h-[120px]">
          {latestObstacles.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {latestObstacles.map((obstacle, i) => (
                <div 
                  key={`${obstacle.label}-${i}`}
                  className="flex items-center justify-between px-2 py-1 bg-card/50 border border-border rounded text-[10px] font-mono"
                >
                  <div className="flex items-center gap-1.5">
                    <div 
                      className={`w-1.5 h-1.5 rounded-full ${
                        obstacle.type === 'ultrasonic' ? 'bg-green-400' : 'bg-cyan-400'
                      }`}
                    />
                    <span className="text-muted-foreground">{obstacle.label}</span>
                  </div>
                  <span className="text-foreground">
                    {obstacle.distance.toFixed(0)}cm {obstacle.angle >= 0 ? '+' : ''}{obstacle.angle}°
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-[10px] text-muted-foreground py-2">
              NO OBSTACLES DETECTED
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
