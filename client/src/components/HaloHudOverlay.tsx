import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

interface HaloHudOverlayProps {
  recordingTime: number;
  detectedObjects: Array<{
    id: string;
    type: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  isDemoMode: boolean;
}

export function HaloHudOverlay({ recordingTime, detectedObjects, isDemoMode }: HaloHudOverlayProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="haloGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 0 60 L 40 60 L 60 30 L 100 30"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeOpacity="0.6"
          filter="url(#glow)"
          vectorEffect="non-scaling-stroke"
          style={{ transform: 'scale(1)' }}
        />
        <path
          d="M 0 80 L 30 80 L 45 50"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="absolute top-0 left-0 w-24 h-16">
        <svg className="w-full h-full" viewBox="0 0 100 70" preserveAspectRatio="none">
          <path
            d="M 0 0 L 0 50 L 20 70 L 80 70 L 100 50"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeOpacity="0.7"
            filter="url(#glow)"
          />
        </svg>
      </div>

      <div className="absolute top-0 right-0 w-24 h-16">
        <svg className="w-full h-full" viewBox="0 0 100 70" preserveAspectRatio="none">
          <path
            d="M 100 0 L 100 50 L 80 70 L 20 70 L 0 50"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeOpacity="0.7"
            filter="url(#glow)"
          />
        </svg>
      </div>

      <div className="absolute bottom-0 left-28 right-28 h-12">
        <svg className="w-full h-full" viewBox="0 0 400 50" preserveAspectRatio="none">
          <path
            d="M 0 50 L 30 20 L 170 20 L 200 0 L 230 20 L 370 20 L 400 50"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeOpacity="0.6"
            filter="url(#glow)"
          />
          <path
            d="M 50 50 L 70 30 L 160 30 L 175 20"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
          <path
            d="M 350 50 L 330 30 L 240 30 L 225 20"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
        </svg>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <line x1="60" y1="0" x2="60" y2="45" stroke="var(--primary)" strokeWidth="1" opacity="0.6" />
          <line x1="60" y1="75" x2="60" y2="120" stroke="var(--primary)" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="60" x2="45" y2="60" stroke="var(--primary)" strokeWidth="1" opacity="0.6" />
          <line x1="75" y1="60" x2="120" y2="60" stroke="var(--primary)" strokeWidth="1" opacity="0.6" />
          
          <polygon 
            points="60,50 55,45 65,45" 
            fill="var(--primary)" 
            opacity="0.8"
          />
          <polygon 
            points="60,70 55,75 65,75" 
            fill="var(--primary)" 
            opacity="0.8"
          />
          <polygon 
            points="50,60 45,55 45,65" 
            fill="var(--primary)" 
            opacity="0.8"
          />
          <polygon 
            points="70,60 75,55 75,65" 
            fill="var(--primary)" 
            opacity="0.8"
          />
          
          <circle cx="60" cy="60" r="3" fill="var(--primary)" opacity="0.9" />
          <circle cx="60" cy="60" r="8" fill="none" stroke="var(--primary)" strokeWidth="1" opacity="0.4" />
        </svg>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 flex flex-col items-center gap-1 opacity-60">
        <div className="w-16 h-[2px] bg-primary/60 rounded" />
        <div className="text-[8px] font-mono text-primary/80">5M</div>
        <div className="w-20 h-[2px] bg-primary/50 rounded" />
        <div className="text-[8px] font-mono text-primary/70">10M</div>
        <div className="w-24 h-[2px] bg-primary/40 rounded" />
        <div className="text-[8px] font-mono text-primary/60">15M</div>
      </div>

      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/40 backdrop-blur-sm border border-primary/40 px-4 py-1 rounded-sm">
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-red-400">REC</span>
              <span className="text-primary/80">{formatTime(recordingTime)}</span>
            </div>
            <div className="w-px h-3 bg-primary/30" />
            <span className="text-primary/60">CAM: HUSKY_LENS</span>
            <div className="w-px h-3 bg-primary/30" />
            <span className="text-primary/60">1080p</span>
          </div>
        </div>
      </div>

      {isDemoMode && (
        <div className="absolute top-2 right-2 bg-accent/80 px-2 py-0.5 rounded text-[10px] font-mono pointer-events-auto">
          DEMO
        </div>
      )}

      {detectedObjects.map((obj) => (
        <motion.div
          key={obj.id}
          className="absolute"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            width: `${obj.width}%`,
            height: `${obj.height}%`
          }}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{
            opacity: [0.6, 0.9, 0.6],
            scale: [1, 1.02, 1]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={`w-full h-full border-2 ${
            obj.type.includes('HAZARD') ? 'border-red-500/80' : 'border-accent/70'
          }`}>
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-inherit" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-inherit" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-inherit" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-inherit" />
            
            <div className={`absolute -top-5 left-0 text-[8px] px-1 py-0.5 font-mono font-bold ${
              obj.type.includes('HAZARD') ? 'bg-red-500/90 text-white' : 'bg-accent/90 text-accent-foreground'
            }`}>
              {obj.type} {Math.round(obj.confidence)}%
            </div>
            <div className="absolute -bottom-4 left-0 text-[7px] text-primary/60 font-mono">
              {obj.id}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface CircularCameraControlProps {
  className?: string;
}

export function CircularCameraControl({ className = '' }: CircularCameraControlProps) {
  const { sendCommand } = useWebSocket();
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(0);

  const handlePanChange = (newPan: number) => {
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

  const indicatorX = (pan / 180) * 32;
  const indicatorY = -(tilt / 90) * 32;

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05" />
            </radialGradient>
            <filter id="radarGlow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="45" fill="url(#radarBg)" stroke="var(--primary)" strokeWidth="2" strokeOpacity="0.6" filter="url(#radarGlow)" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.3" />
          <circle cx="50" cy="50" r="15" fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.2" />

          <line x1="50" y1="5" x2="50" y2="95" stroke="var(--primary)" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="var(--primary)" strokeWidth="0.5" strokeOpacity="0.3" />

          <polygon 
            points="50,8 47,15 53,15" 
            fill="var(--primary)" 
            opacity="0.8"
          />

          <circle 
            cx={50 + indicatorX} 
            cy={50 + indicatorY} 
            r="6" 
            fill="var(--primary)" 
            opacity="0.9"
            filter="url(#radarGlow)"
          />
          <circle 
            cx={50 + indicatorX} 
            cy={50 + indicatorY} 
            r="3" 
            fill="white" 
            opacity="0.8"
          />
        </svg>

        <button
          onClick={() => handleTiltChange(tilt + 15)}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-4 flex items-center justify-center text-primary/60 hover:text-primary transition-colors pointer-events-auto"
          data-testid="button-cam-tilt-up"
        >
          <svg width="12" height="8" viewBox="0 0 12 8">
            <path d="M6 0 L12 8 L0 8 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handleTiltChange(tilt - 15)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-4 flex items-center justify-center text-primary/60 hover:text-primary transition-colors pointer-events-auto"
          data-testid="button-cam-tilt-down"
        >
          <svg width="12" height="8" viewBox="0 0 12 8">
            <path d="M6 8 L0 0 L12 0 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handlePanChange(pan - 30)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center text-primary/60 hover:text-primary transition-colors pointer-events-auto"
          data-testid="button-cam-pan-left"
        >
          <svg width="8" height="12" viewBox="0 0 8 12">
            <path d="M0 6 L8 0 L8 12 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handlePanChange(pan + 30)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center text-primary/60 hover:text-primary transition-colors pointer-events-auto"
          data-testid="button-cam-pan-right"
        >
          <svg width="8" height="12" viewBox="0 0 8 12">
            <path d="M8 6 L0 0 L0 12 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleCenter}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary/20 hover:bg-primary/40 flex items-center justify-center transition-colors pointer-events-auto"
          data-testid="button-cam-center"
        >
          <RotateCcw className="w-2.5 h-2.5 text-primary/80" />
        </button>
      </div>

      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[8px] font-mono text-primary/70">
        <span>P:{pan}°</span>
        <span>T:{tilt}°</span>
      </div>
    </div>
  );
}
