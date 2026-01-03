import { useEffect, useRef, useState, useMemo } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Maximize2, X } from 'lucide-react';

interface RadarScannerProps {
  ultrasonicData: [number, number, number, number, number];
  lidarDistance: number;
  className?: string;
}

interface ObstaclePoint {
  id: string;
  angle: number;
  distance: number;
  type: 'ultrasonic' | 'lidar';
  label: string;
  cardinal: string;
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
  0,    // Front center (N)
  -45,  // Front left (NW)
  45,   // Front right (NE)
  -90,  // Left (W)
  90,   // Right (E)
];

const MAX_RANGE = 600;
const FADE_DURATION = 2000;

let obstacleIdCounter = 1;

function getCardinalDirection(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'N';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'NE';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'E';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'SE';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'S';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'SW';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'W';
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'NW';
  return 'N';
}

export default function RadarScanner({ ultrasonicData, lidarDistance, className }: RadarScannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [obstacles, setObstacles] = useState<ObstaclePoint[]>([]);
  const [containerWidth, setContainerWidth] = useState(200);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isConnected } = useWebSocket();

  const [containerHeight, setContainerHeight] = useState(200);
  
  const size = useMemo(() => {
    const columnWidth = containerWidth / 2;
    const widthBased = Math.floor(columnWidth * 0.9);
    const maxHeight = Math.floor(containerHeight * 0.7);
    return Math.min(widthBased, maxHeight, 500);
  }, [containerWidth, containerHeight]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
        setContainerHeight(containerRef.current.clientHeight);
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
        const angle = ULTRASONIC_ANGLES[index];
        newObstacles.push({
          id: `U${obstacleIdCounter++}`,
          angle,
          distance,
          type: 'ultrasonic',
          label: ULTRASONIC_LABELS[index],
          cardinal: getCardinalDirection(angle),
          timestamp: now,
        });
      }
    });

    if (lidarDistance > 0 && lidarDistance < MAX_RANGE) {
      newObstacles.push({
        id: `L${obstacleIdCounter++}`,
        angle: 0,
        distance: lidarDistance,
        type: 'lidar',
        label: 'LIDAR-FWD',
        cardinal: 'N',
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
    const recentObstacles = obstacles.filter(o => now - o.timestamp < 500);
    
    recentObstacles.forEach(obstacle => {
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
      ctx.arc(pointX, pointY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const fontSize = Math.max(7, Math.floor(size / 25));
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillStyle = obstacle.type === 'ultrasonic' ? '#00ff64' : '#00c8ff';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillText(obstacle.id, pointX, pointY - 8);
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

  const { ultrasonicObstacles, lidarObstacles } = useMemo(() => {
    const now = Date.now();
    const recent = obstacles.filter(o => now - o.timestamp < 500);
    const uniqueByLabel = new Map<string, ObstaclePoint>();
    recent.forEach(o => {
      const existing = uniqueByLabel.get(o.label);
      if (!existing || o.timestamp > existing.timestamp) {
        uniqueByLabel.set(o.label, o);
      }
    });
    const all = Array.from(uniqueByLabel.values()).sort((a, b) => a.distance - b.distance);
    
    return {
      ultrasonicObstacles: all.filter(o => o.type === 'ultrasonic'),
      lidarObstacles: all.filter(o => o.type === 'lidar'),
    };
  }, [obstacles]);

  const fullscreenSize = useMemo(() => {
    if (typeof window === 'undefined') return 400;
    const maxHeight = window.innerHeight * 0.75;
    const maxWidth = (window.innerWidth * 0.9 * 2) / 3 * 0.85;
    return Math.min(maxWidth, maxHeight, 600);
  }, [isFullscreen]);

  const ObstaclesList = ({ large = false }: { large?: boolean }) => (
    <div className="flex flex-col h-full overflow-hidden">
      <h4 className={`${large ? 'text-sm' : 'text-[9px]'} font-display text-primary/80 mb-2`}>DETECTED OBSTACLES</h4>
      <ScrollArea className="flex-1">
        <h5 className={`${large ? 'text-xs' : 'text-[8px]'} font-display text-green-400/80 mb-1 flex items-center gap-1`}>
          <div className={`${large ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full bg-green-400`}></div>
          ULTRASONIC ({ultrasonicObstacles.length})
        </h5>
        {ultrasonicObstacles.length > 0 ? (
          <div className="grid grid-cols-1 gap-1 mb-4">
            {ultrasonicObstacles.map((obstacle) => (
              <div 
                key={obstacle.id}
                className={`flex items-center justify-between px-3 py-2 bg-card/50 border border-green-400/30 rounded ${large ? 'text-sm' : 'text-[9px]'} font-mono`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">{obstacle.id}</span>
                  <span className="text-foreground/70">{obstacle.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-bold">{obstacle.distance.toFixed(0)}cm</span>
                  <span className="text-primary/60">{obstacle.cardinal}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center ${large ? 'text-sm py-4' : 'text-[9px] py-2'} text-foreground/50 mb-4 border border-dashed border-green-400/20 rounded`}>
            NO OBSTACLES
          </div>
        )}

        <h5 className={`${large ? 'text-xs' : 'text-[8px]'} font-display text-cyan-400/80 mb-1 flex items-center gap-1`}>
          <div className={`${large ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full bg-cyan-400`}></div>
          LIDAR ({lidarObstacles.length})
        </h5>
        {lidarObstacles.length > 0 ? (
          <div className="grid grid-cols-1 gap-1">
            {lidarObstacles.map((obstacle) => (
              <div 
                key={obstacle.id}
                className={`flex items-center justify-between px-3 py-2 bg-card/50 border border-cyan-400/30 rounded ${large ? 'text-sm' : 'text-[9px]'} font-mono`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">{obstacle.id}</span>
                  <span className="text-foreground/70">{obstacle.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-bold">{obstacle.distance.toFixed(0)}cm</span>
                  <span className="text-primary/60">{obstacle.cardinal}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center ${large ? 'text-sm py-4' : 'text-[9px] py-2'} text-foreground/50 border border-dashed border-cyan-400/20 rounded`}>
            NO OBSTACLES
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className={`flex flex-col h-full ${className}`}>
        <div className="flex justify-between items-center pb-2">
          <h3 className="text-[10px] font-display text-primary/80">PROXIMITY RADAR</h3>
          <div className="flex items-center gap-2">
            {!isConnected && (
              <div className="bg-accent/80 px-1.5 py-0.5 rounded text-[9px] font-mono">
                DEMO
              </div>
            )}
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1 rounded hover:bg-primary/20 text-primary/60 hover:text-primary transition-colors"
              title="Fullscreen"
              data-testid="button-radar-fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Two column layout: Radar | Obstacles List */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
          {/* Left Column - Radar Display */}
          <div className="flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              style={{ width: size, height: size }}
              className="rounded-full border border-primary/30"
            />
            
            <div className="flex justify-center gap-4 mt-2 text-[9px] font-mono">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-foreground/70">ULTRASONIC</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                <span className="text-foreground/70">LIDAR</span>
              </div>
            </div>
          </div>

          {/* Right Column - Obstacles List */}
          <ObstaclesList />
        </div>
      </div>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] bg-background/95 backdrop-blur-md border-primary/30 p-0 [&>button]:hidden">
          <div className="flex flex-col h-full p-6">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-primary/20">
              <h2 className="text-lg font-display text-primary flex items-center gap-2">
                PROXIMITY RADAR
                {!isConnected && (
                  <span className="bg-accent/80 px-2 py-0.5 rounded text-xs font-mono">DEMO</span>
                )}
              </h2>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                data-testid="button-radar-close-fullscreen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two column layout: 2/3 Radar | 1/3 Obstacles */}
            <div className="flex-1 grid grid-cols-3 gap-6 mt-4 min-h-0">
              {/* Radar Column - 2/3 */}
              <div className="col-span-2 flex flex-col items-center justify-center">
                <canvas
                  ref={canvasRef}
                  style={{ width: fullscreenSize, height: fullscreenSize }}
                  className="rounded-full border-2 border-primary/30"
                />
                
                <div className="flex justify-center gap-8 mt-4 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="text-foreground/70">ULTRASONIC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                    <span className="text-foreground/70">LIDAR</span>
                  </div>
                </div>
              </div>

              {/* Obstacles Column - 1/3 */}
              <div className="col-span-1 min-h-0">
                <ObstaclesList large />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
