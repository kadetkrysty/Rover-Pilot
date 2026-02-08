import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExtendedKalmanFilter, OccupancyGridMap } from '@/lib/sensorFusion';
import type { SensorFusionState, LidarScan, OccupancyGridCell } from '@shared/schema';
import { RotateCcw, ZoomIn, ZoomOut, Compass, Activity, Radio } from 'lucide-react';

interface SlamMapViewerProps {
  lidarScans?: LidarScan[];
  gpsData?: { lat: number; lng: number; accuracy?: number };
  imuData?: { heading: number; pitch: number; roll: number };
  ultrasonicData?: number[];
  isSimulating?: boolean;
}

export function SlamMapViewer({
  lidarScans = [],
  gpsData,
  imuData,
  ultrasonicData = [],
  isSimulating = true
}: SlamMapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ekf] = useState(() => new ExtendedKalmanFilter());
  const [occupancyMap] = useState(() => new OccupancyGridMap(200, 200, 0.1));
  const [fusionState, setFusionState] = useState<SensorFusionState | null>(null);
  const [zoom, setZoom] = useState(2);
  const [simulationTime, setSimulationTime] = useState(0);
  const [isRunning, setIsRunning] = useState(isSimulating);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });
  const lastUpdateRef = useRef(Date.now());
  const gpsOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lidarHeadingRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const height = Math.round(width * 2 / 3);
          setCanvasSize({ width: Math.round(width), height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const simulateLidarSweep = useCallback((angle: number): LidarScan[] => {
    const scans: LidarScan[] = [];
    const sweepWidth = 30;
    
    for (let i = -sweepWidth / 2; i <= sweepWidth / 2; i += 5) {
      const scanAngle = angle + i;
      let distance = 5 + Math.random() * 3;
      
      const state = ekf.getState();
      const worldAngle = state.theta + (scanAngle * Math.PI / 180);
      const testX = state.x + 3 * Math.cos(worldAngle);
      const testY = state.y + 3 * Math.sin(worldAngle);
      
      if (Math.abs(testX) > 8 || Math.abs(testY) > 8) {
        distance = Math.sqrt(64 - state.x * state.x) / Math.abs(Math.cos(worldAngle));
        distance = Math.min(distance, 10);
      }
      
      const obstacleX = 3 + Math.sin(simulationTime * 0.01) * 2;
      const obstacleY = 2 + Math.cos(simulationTime * 0.015) * 2;
      const dx = obstacleX - state.x;
      const dy = obstacleY - state.y;
      const obstacleAngle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(worldAngle - obstacleAngle);
      
      if (angleDiff < 0.3) {
        const obstacleDist = Math.sqrt(dx * dx + dy * dy);
        if (obstacleDist < distance) {
          distance = obstacleDist;
        }
      }
      
      scans.push({
        angle: scanAngle,
        distance: Math.max(0.1, distance + (Math.random() - 0.5) * 0.2),
        timestamp: Date.now()
      });
    }
    
    return scans;
  }, [ekf, simulationTime]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      if (isSimulating) {
        const circularMotion = {
          angularVelocity: 0.1 + Math.sin(simulationTime * 0.002) * 0.05,
          acceleration: 0.02 * Math.cos(simulationTime * 0.003)
        };
        ekf.predict(dt, circularMotion.angularVelocity, circularMotion.acceleration);

        if (simulationTime % 100 < 10) {
          const state = ekf.getState();
          const noisyGps = {
            x: state.x + (Math.random() - 0.5) * 2,
            y: state.y + (Math.random() - 0.5) * 2
          };
          ekf.updateWithGPS(noisyGps.x, noisyGps.y, 2);
        }

        if (simulationTime % 20 < 10) {
          const state = ekf.getState();
          const noisyHeading = state.theta + (Math.random() - 0.5) * 0.1;
          ekf.updateWithIMU(noisyHeading);
        }

        const state = ekf.getState();
        const lidarAngle = (simulationTime * 2) % 360;
        const scans = simulateLidarSweep(lidarAngle);
        
        occupancyMap.updateWithLidarScan(
          state.x,
          state.y,
          state.theta,
          scans
        );
      } else {
        const hasImu = imuData && (imuData.heading !== 0 || imuData.pitch !== 0 || imuData.roll !== 0);
        
        if (hasImu) {
          const angularVel = dt > 0 ? ((imuData!.heading * Math.PI / 180 - ekf.getState().theta + Math.PI) % (2 * Math.PI) - Math.PI) / dt * 0.1 : 0;
          ekf.predict(dt, angularVel, 0);
          ekf.updateWithIMU(imuData!.heading * Math.PI / 180);
        }

        if (gpsData && gpsData.lat !== 0 && gpsData.lng !== 0) {
          const accuracy = gpsData.accuracy || 5;
          if (!gpsOriginRef.current) {
            gpsOriginRef.current = { lat: gpsData.lat, lng: gpsData.lng };
          }
          const x = (gpsData.lng - gpsOriginRef.current.lng) * 111000 * Math.cos(gpsData.lat * Math.PI / 180);
          const y = (gpsData.lat - gpsOriginRef.current.lat) * 111000;
          if (hasImu) {
            ekf.updateWithGPS(x, y, accuracy);
          }
        }

        if (lidarScans.length > 0) {
          let roverX = 0;
          let roverY = 0;
          let roverTheta = 0;
          
          if (hasImu) {
            const state = ekf.getState();
            roverX = state.x;
            roverY = state.y;
            roverTheta = state.theta;
          } else {
            if (gpsData && gpsData.lat !== 0 && gpsData.lng !== 0) {
              if (!gpsOriginRef.current) {
                gpsOriginRef.current = { lat: gpsData.lat, lng: gpsData.lng };
              }
              roverX = (gpsData.lng - gpsOriginRef.current.lng) * 111000 * Math.cos(gpsData.lat * Math.PI / 180);
              roverY = (gpsData.lat - gpsOriginRef.current.lat) * 111000;
            }
          }
          
          const scansInMeters = lidarScans.map(s => ({
            ...s,
            distance: s.distance / 1000
          }));
          occupancyMap.updateWithLidarScan(
            roverX,
            roverY,
            roverTheta,
            scansInMeters
          );
        }
      }

      setFusionState(ekf.getState());
      setSimulationTime(t => t + 1);
    }, 50);

    return () => clearInterval(interval);
  }, [isRunning, isSimulating, ekf, occupancyMap, simulateLidarSweep, simulationTime, gpsData, imuData, lidarScans]);

  useEffect(() => {
    if (imuData) {
      lidarHeadingRef.current = imuData.heading * Math.PI / 180;
    }
  }, [imuData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvasSize.width;
    const displayHeight = canvasSize.height;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const mapDims = occupancyMap.getDimensions();
    const gridData = occupancyMap.getGrid();
    
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const scale = zoom * 10;
    const cellScreenSize = Math.max(mapDims.resolution * scale, 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;
    const gridSpacing = scale;
    
    for (let x = centerX % gridSpacing; x < displayWidth; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
      ctx.stroke();
    }
    for (let y = centerY % gridSpacing; y < displayHeight; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
      ctx.stroke();
    }

    for (let y = 0; y < mapDims.height; y++) {
      for (let x = 0; x < mapDims.width; x++) {
        const prob = gridData[y][x];
        const worldX = mapDims.originX + x * mapDims.resolution;
        const worldY = mapDims.originY + y * mapDims.resolution;
        
        const screenX = centerX + worldX * scale;
        const screenY = centerY - worldY * scale;
        
        if (screenX < -cellScreenSize || screenX > displayWidth + cellScreenSize || 
            screenY < -cellScreenSize || screenY > displayHeight + cellScreenSize) continue;
        
        if (prob > 0.65) {
          const intensity = Math.min((prob - 0.5) * 4, 1);
          ctx.fillStyle = `rgba(239, 68, 68, ${0.7 + intensity * 0.3})`;
          ctx.fillRect(
            Math.floor(screenX - cellScreenSize / 2), 
            Math.floor(screenY - cellScreenSize / 2), 
            Math.ceil(cellScreenSize), 
            Math.ceil(cellScreenSize)
          );
        } else if (prob < 0.35) {
          const clarity = Math.min((0.5 - prob) * 3, 1);
          ctx.fillStyle = `rgba(34, 197, 94, ${0.15 + clarity * 0.25})`;
          ctx.fillRect(
            Math.floor(screenX - cellScreenSize / 2), 
            Math.floor(screenY - cellScreenSize / 2), 
            Math.ceil(cellScreenSize), 
            Math.ceil(cellScreenSize)
          );
        }
      }
    }

    if (fusionState) {
      const roverX = centerX + fusionState.x * scale;
      const roverY = centerY - fusionState.y * scale;
      
      const heading = isSimulating ? -fusionState.theta : -lidarHeadingRef.current;
      
      ctx.save();
      ctx.translate(roverX, roverY);
      ctx.rotate(heading);
      
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-7, -9);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.lineWidth = 1.5;
      const uncertaintyRadius = Math.sqrt(fusionState.covariance[0][0] + fusionState.covariance[1][1]) * scale;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(uncertaintyRadius, 60), 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 30, -0.5, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 50, -0.3, 0.3);
      ctx.stroke();
      
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px monospace';
    ctx.fillText(`Scale: ${(1/zoom).toFixed(1)}m/div`, 10, displayHeight - 30);
    ctx.fillText(`Time: ${(simulationTime * 0.05).toFixed(1)}s`, 10, displayHeight - 15);
    
    if (imuData) {
      ctx.fillText(`HDG: ${imuData.heading.toFixed(1)}°`, 10, displayHeight - 45);
    }

  }, [fusionState, occupancyMap, zoom, simulationTime, canvasSize, imuData, isSimulating]);

  const handleReset = () => {
    ekf.reset();
    occupancyMap.reset();
    setSimulationTime(0);
    setFusionState(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isRunning ? "default" : "secondary"} className="font-mono">
            <Activity className="w-3 h-3 mr-1" />
            {isRunning ? 'MAPPING' : 'PAUSED'}
          </Badge>
          {fusionState && (
            <Badge variant="outline" className="font-mono">
              <Radio className="w-3 h-3 mr-1" />
              CONFIDENCE: {(fusionState.confidence * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(z * 1.5, 10))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(z / 1.5, 0.5))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsRunning(!isRunning)}>
            {isRunning ? 'Pause' : 'Resume'}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative border border-primary/30 rounded-lg overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: 'pixelated' }}
          data-testid="slam-map-canvas"
        />
        
        <div className="absolute bottom-2 right-2 bg-background/80 rounded p-2 text-xs font-mono space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Rover</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500"></div>
            <span>Obstacle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/30"></div>
            <span>Clear</span>
          </div>
        </div>
      </div>

      {fusionState && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3 bg-card/50">
            <div className="text-xs text-muted-foreground font-mono">POSITION X</div>
            <div className="text-lg font-bold font-mono">{fusionState.x.toFixed(2)}m</div>
          </Card>
          <Card className="p-3 bg-card/50">
            <div className="text-xs text-muted-foreground font-mono">POSITION Y</div>
            <div className="text-lg font-bold font-mono">{fusionState.y.toFixed(2)}m</div>
          </Card>
          <Card className="p-3 bg-card/50">
            <div className="text-xs text-muted-foreground font-mono">HEADING</div>
            <div className="text-lg font-bold font-mono flex items-center gap-1">
              <Compass className="w-4 h-4 text-primary" />
              {((fusionState.theta * 180 / Math.PI) % 360).toFixed(1)}°
            </div>
          </Card>
          <Card className="p-3 bg-card/50">
            <div className="text-xs text-muted-foreground font-mono">VELOCITY</div>
            <div className="text-lg font-bold font-mono">{fusionState.velocity.toFixed(2)}m/s</div>
          </Card>
        </div>
      )}
    </div>
  );
}
