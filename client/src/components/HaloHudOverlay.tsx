import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';
import haloHudImage from '@assets/halo-3-hud-transparent-clipart_1767566055231.png';

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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <img 
        src={haloHudImage} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.9 }}
      />

      <div className="absolute top-[3%] left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span className="text-red-400 font-bold">REC</span>
            <span className="text-cyan-300">{formatTime(recordingTime)}</span>
          </div>
          <span className="text-cyan-400/40">|</span>
          <span className="text-cyan-300/90">CAM: HUSKY_LENS</span>
          <span className="text-cyan-400/40">|</span>
          <span className="text-cyan-300/90">1080p</span>
        </div>
      </div>

      {isDemoMode && (
        <div className="absolute top-[3%] right-[8%] bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-auto">
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
            obj.type.includes('HAZARD') ? 'border-red-500/80' : 'border-cyan-400/70'
          }`} style={{ boxShadow: obj.type.includes('HAZARD') ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(103,199,255,0.5)' }}>
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-inherit" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-inherit" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-inherit" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-inherit" />
            
            <div className={`absolute -top-5 left-0 text-[8px] px-1.5 py-0.5 font-mono font-bold ${
              obj.type.includes('HAZARD') ? 'bg-red-500/90 text-white' : 'bg-cyan-500/90 text-white'
            }`}>
              {obj.type} {Math.round(obj.confidence)}%
            </div>
            <div className="absolute -bottom-4 left-0 text-[7px] text-cyan-400/70 font-mono">
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
  const [sweepAngle, setSweepAngle] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

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

  const indicatorX = 50 + (pan / 180) * 30;
  const indicatorY = 50 - (tilt / 90) * 30;

  return (
    <div className={`relative pointer-events-auto ${className}`}>
      <div className="relative w-[90px] h-[90px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="radarBg2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0D2442" stopOpacity="0.15" />
            </radialGradient>
            <filter id="glow2">
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="44" fill="url(#radarBg2)" stroke="#25A8FF" strokeWidth="2" filter="url(#glow2)" />
          <circle cx="50" cy="50" r="32" fill="none" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />

          <line x1="50" y1="6" x2="50" y2="94" stroke="#25A8FF" strokeWidth="0.4" strokeOpacity="0.3" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="#25A8FF" strokeWidth="0.4" strokeOpacity="0.3" />

          <line 
            x1="50" 
            y1="50" 
            x2={50 + 40 * Math.sin(sweepAngle * Math.PI / 180)} 
            y2={50 - 40 * Math.cos(sweepAngle * Math.PI / 180)} 
            stroke="#67C7FF" 
            strokeWidth="1.5" 
            strokeOpacity="0.7"
            filter="url(#glow2)"
          />

          <polygon points="50,8 47,15 53,15" fill="#67C7FF" />

          <circle cx={indicatorX} cy={indicatorY} r="4" fill="#25A8FF" filter="url(#glow2)" />
          <circle cx={indicatorX} cy={indicatorY} r="2" fill="#67C7FF" />
        </svg>

        <button
          onClick={() => handleTiltChange(tilt + 15)}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-4 flex items-center justify-center text-cyan-400/50 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-up"
        >
          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M5 0 L10 6 L0 6 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handleTiltChange(tilt - 15)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-4 flex items-center justify-center text-cyan-400/50 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-down"
        >
          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M5 6 L0 0 L10 0 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan - 30)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center text-cyan-400/50 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-left"
        >
          <svg width="6" height="10" viewBox="0 0 6 10"><path d="M0 5 L6 0 L6 10 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan + 30)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center text-cyan-400/50 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-right"
        >
          <svg width="6" height="10" viewBox="0 0 6 10"><path d="M6 5 L0 0 L0 10 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={handleCenter}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors border border-cyan-400/30"
          data-testid="button-cam-center"
        >
          <RotateCcw className="w-2.5 h-2.5 text-cyan-400/80" />
        </button>
      </div>

      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2 text-[8px] font-mono text-cyan-400/60">
        <span>P:{pan}°</span>
        <span>T:{tilt}°</span>
      </div>
    </div>
  );
}
