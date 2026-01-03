import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, RotateCcw, Lock, Unlock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

interface CameraPanTiltProps {
  compact?: boolean;
}

export default function CameraPanTilt({ compact = false }: CameraPanTiltProps) {
  const { sendCommand } = useWebSocket();
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const dragStartRef = useRef({ pan: 0, tilt: 0 });

  const handlePanChange = (newPan: number) => {
    if (isLocked) return;
    const clampedPan = Math.max(-180, Math.min(180, newPan));
    setPan(clampedPan);
    sendCommand({ 
      type: 'command', 
      action: 'CAMERA_PAN', 
      value: clampedPan,
      timestamp: Date.now() 
    });
  };

  const handleTiltChange = (newTilt: number) => {
    if (isLocked) return;
    const clampedTilt = Math.max(-90, Math.min(90, newTilt));
    setTilt(clampedTilt);
    sendCommand({ 
      type: 'command', 
      action: 'CAMERA_TILT', 
      value: clampedTilt,
      timestamp: Date.now() 
    });
  };

  const handleCenter = () => {
    setPan(0);
    setTilt(0);
    sendCommand({ type: 'command', action: 'CAMERA_CENTER', timestamp: Date.now() });
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
    sendCommand({ 
      type: 'command', 
      action: isTracking ? 'STOP_TRACKING' : 'START_TRACKING',
      timestamp: Date.now() 
    });
  };

  const adjustPan = (delta: number) => handlePanChange(pan + delta);
  const adjustTilt = (delta: number) => handleTiltChange(tilt + delta);

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-xs">
            <Camera className="w-3 h-3" /> Camera
          </div>
          <button
            onClick={handleCenter}
            className="p-0.5 rounded bg-card/50 hover:bg-primary/20 text-muted-foreground transition-colors"
            title="Center"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          <div className="bg-black/30 rounded px-1.5 py-1 flex justify-between">
            <span className="text-muted-foreground">PAN</span>
            <span className="text-foreground">{pan}°</span>
          </div>
          <div className="bg-black/30 rounded px-1.5 py-1 flex justify-between">
            <span className="text-muted-foreground">TILT</span>
            <span className="text-foreground">{tilt}°</span>
          </div>
        </div>
        <div className="relative w-full aspect-square max-w-[90px] mx-auto">
          <div className="absolute inset-0 border border-primary/30 rounded flex items-center justify-center">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20"></div>
            <motion.div
              className="absolute w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_var(--primary)]"
              style={{
                left: `calc(50% + ${(pan / 180) * 35}px - 5px)`,
                top: `calc(50% - ${(tilt / 90) * 35}px - 5px)`
              }}
            />
            <button
              onClick={() => adjustTilt(15)}
              className="absolute top-0.5 left-1/2 -translate-x-1/2 p-0.5 rounded bg-black/40 hover:bg-primary/30 text-primary/60 hover:text-primary transition-colors"
              data-testid="button-tilt-up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => adjustTilt(-15)}
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 p-0.5 rounded bg-black/40 hover:bg-primary/30 text-primary/60 hover:text-primary transition-colors"
              data-testid="button-tilt-down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => adjustPan(-30)}
              className="absolute left-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded bg-black/40 hover:bg-primary/30 text-primary/60 hover:text-primary transition-colors"
              data-testid="button-pan-left"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => adjustPan(30)}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded bg-black/40 hover:bg-primary/30 text-primary/60 hover:text-primary transition-colors"
              data-testid="button-pan-right"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1.5 text-primary/80">
          <Camera className="w-4 h-4" />
          <span className="text-xs font-display uppercase tracking-wider">Camera Gimbal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLock}
            className={`p-1 rounded transition-colors ${isLocked ? 'bg-destructive/20 text-destructive' : 'bg-card hover:bg-primary/20 text-muted-foreground'}`}
            title={isLocked ? 'Unlock' : 'Lock'}
            data-testid="button-gimbal-lock"
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          <button
            onClick={handleCenter}
            className="p-1 rounded bg-card hover:bg-primary/20 text-muted-foreground transition-colors"
            title="Center"
            data-testid="button-gimbal-center"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-[120px] aspect-square">
          <div className="absolute inset-0 border-2 border-primary/30 rounded-lg bg-black/20">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1/2 h-1/2 border border-primary/10 rounded"></div>
            </div>
            
            <motion.div
              className="absolute w-4 h-4 bg-gradient-to-br from-primary to-primary/60 rounded-full shadow-[0_0_12px_var(--primary)] cursor-pointer"
              style={{
                left: `calc(50% + ${(pan / 180) * 45}% - 8px)`,
                top: `calc(50% - ${(tilt / 90) * 45}% - 8px)`
              }}
              drag={!isLocked}
              dragConstraints={{
                left: -50,
                right: 50,
                top: -50,
                bottom: 50
              }}
              dragElastic={0}
              onDragStart={() => {
                dragStartRef.current = { pan, tilt };
              }}
              onDrag={(_, info) => {
                const constraintRadius = 50;
                const panScale = 180 / constraintRadius;
                const tiltScale = 90 / constraintRadius;
                const newPan = dragStartRef.current.pan + (info.offset.x * panScale);
                const newTilt = dragStartRef.current.tilt - (info.offset.y * tiltScale);
                handlePanChange(newPan);
                handleTiltChange(newTilt);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-testid="gimbal-control"
            />
          </div>
          
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted-foreground">
            +90°
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted-foreground">
            -90°
          </div>
          <div className="absolute top-1/2 -left-5 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">
            -180°
          </div>
          <div className="absolute top-1/2 -right-6 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">
            +180°
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-card/50 border border-border rounded p-1.5 text-center">
          <div className="text-base font-mono font-bold text-foreground">{pan}°</div>
          <div className="text-[8px] text-muted-foreground uppercase">Pan</div>
        </div>
        <div className="bg-card/50 border border-border rounded p-1.5 text-center">
          <div className="text-base font-mono font-bold text-foreground">{tilt}°</div>
          <div className="text-[8px] text-muted-foreground uppercase">Tilt</div>
        </div>
      </div>

      <button
        onClick={toggleTracking}
        className={`mt-2 w-full py-1.5 rounded text-[10px] font-mono uppercase transition-all ${
          isTracking 
            ? 'bg-secondary/20 border border-secondary text-secondary' 
            : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
        }`}
        data-testid="button-gimbal-tracking"
      >
        {isTracking ? 'Tracking Active' : 'Auto Track'}
      </button>
    </div>
  );
}
