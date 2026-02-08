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
  const [ekf] = useState(() => new ExtendedKalmanFilter());
  const [occupancyMap] = useState(() => new OccupancyGridMap(200, 200, 0.1));
  const [fusionState, setFusionState] = useState<SensorFusionState | null>(null);
  const [zoom, setZoom] = useState(2);
  const [simulationTime, setSimulationTime] = useState(0);
  const [isRunning, setIsRunning] = useState(isSimulating);
  const lastUpdateRef = useRef(Date.now());
  const gpsOriginRef = useRef<{ lat: number; lng: number } | null>(null);

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
        const angularVel = (imuData && dt > 0) ? ((imuData.heading * Math.PI / 180 - ekf.getState().theta + Math.PI) % (2 * Math.PI) - Math.PI) / dt * 0.1 : 0;
        ekf.predict(dt, angularVel, 0);

        if (gpsData && gpsData.lat !== 0 && gpsData.lng !== 0) {
          const accuracy = gpsData.accuracy || 5;
          if (!gpsOriginRef.current) {
            gpsOriginRef.current = { lat: gpsData.lat, lng: gpsData.lng };
          }
          const x = (gpsData.lng - gpsOriginRef.current.lng) * 111000 * Math.cos(gpsData.lat * Math.PI / 180);
          const y = (gpsData.lat - gpsOriginRef.current.lat) * 111000;
          ekf.updateWithGPS(x, y, accuracy);
        }

        if (imuData) {
          ekf.updateWithIMU(imuData.heading * Math.PI / 180);
        }

        if (lidarScans.length > 0) {
          const state = ekf.getState();
          const scansInMeters = lidarScans.map(s => ({
            ...s,
            distance: s.distance / 1000
          }));
          occupancyMap.updateWithLidarScan(
            state.x,
            state.y,
            state.theta,
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const mapDims = occupancyMap.getDimensions();
    const gridData = occupancyMap.getGrid();
    
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = zoom * 10;

    for (let y = 0; y < mapDims.height; y++) {
      for (let x = 0; x < mapDims.width; x++) {
        const prob = gridData[y][x];
        const worldX = mapDims.originX + x * mapDims.resolution;
        const worldY = mapDims.originY + y * mapDims.resolution;
        
        const screenX = centerX + worldX * scale;
        const screenY = centerY - worldY * scale;
        
        if (screenX < -5 || screenX > width + 5 || screenY < -5 || screenY > height + 5) continue;
        
        if (prob > 0.65) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(screenX - 1, screenY - 1, 3, 3);
        } else if (prob < 0.35) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
          ctx.fillRect(screenX - 1, screenY - 1, 2, 2);
        }
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSpacing = scale;
    
    for (let x = centerX % gridSpacing; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = centerY % gridSpacing; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (fusionState) {
      const roverX = centerX + fusionState.x * scale;
      const roverY = centerY - fusionState.y * scale;
      
      ctx.save();
      ctx.translate(roverX, roverY);
      ctx.rotate(-fusionState.theta);
      
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.lineWidth = 2;
      const uncertaintyRadius = Math.sqrt(fusionState.covariance[0][0] + fusionState.covariance[1][1]) * scale;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(uncertaintyRadius, 50), 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
      
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(roverX, roverY, 20, -fusionState.theta - 0.3, -fusionState.theta + 0.3);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px monospace';
    ctx.fillText(`Scale: ${(1/zoom).toFixed(1)}m/div`, 10, height - 30);
    ctx.fillText(`Time: ${(simulationTime * 0.05).toFixed(1)}s`, 10, height - 15);

  }, [fusionState, occupancyMap, zoom, simulationTime]);

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

      <div className="relative border border-primary/30 rounded-lg overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full"
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
