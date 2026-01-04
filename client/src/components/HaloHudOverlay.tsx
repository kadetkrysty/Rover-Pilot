import { useState } from 'react';
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1920 1080" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="hudGlow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="hudGlowStrong">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#25A8FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#25A8FF" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="1920" height="100" fill="rgba(10, 25, 47, 0.7)" />
        
        <path
          d="M 0 80 L 150 80 L 200 40 L 350 40 L 400 80 L 600 80"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2"
          filter="url(#hudGlow)"
        />
        <path
          d="M 1920 80 L 1770 80 L 1720 40 L 1570 40 L 1520 80 L 1320 80"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2"
          filter="url(#hudGlow)"
        />
        
        <path
          d="M 600 80 L 650 50 L 750 50 L 780 25"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        <path
          d="M 1320 80 L 1270 50 L 1170 50 L 1140 25"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        
        <path
          d="M 780 25 L 850 25 L 880 10 L 960 10"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <path
          d="M 1140 25 L 1070 25 L 1040 10 L 960 10"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        
        <polygon
          points="0,0 0,120 30,120 50,90 50,0"
          fill="rgba(37, 168, 255, 0.1)"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <polygon
          points="1920,0 1920,120 1890,120 1870,90 1870,0"
          fill="rgba(37, 168, 255, 0.1)"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />

        <rect x="0" y="980" width="1920" height="100" fill="rgba(10, 25, 47, 0.7)" />
        
        <path
          d="M 0 1000 L 200 1000 L 280 1040 L 500 1040"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2"
          filter="url(#hudGlow)"
        />
        <path
          d="M 1920 1000 L 1720 1000 L 1640 1040 L 1420 1040"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2"
          filter="url(#hudGlow)"
        />
        
        <path
          d="M 500 1040 L 600 1020 L 750 1020 L 850 1050 L 960 1050"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />
        <path
          d="M 1420 1040 L 1320 1020 L 1170 1020 L 1070 1050 L 960 1050"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />
        
        <polygon
          points="0,1080 0,960 30,960 50,990 50,1080"
          fill="rgba(37, 168, 255, 0.1)"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <polygon
          points="1920,1080 1920,960 1890,960 1870,990 1870,1080"
          fill="rgba(37, 168, 255, 0.1)"
          stroke="#25A8FF"
          strokeWidth="1"
          strokeOpacity="0.5"
        />

        <line x1="860" y1="1000" x2="900" y2="1000" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.6" />
        <text x="910" y="1005" fill="#25A8FF" fontSize="14" fontFamily="monospace" opacity="0.8">5 MTS</text>
        
        <line x1="820" y1="980" x2="870" y2="980" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.5" />
        <text x="880" y="985" fill="#25A8FF" fontSize="12" fontFamily="monospace" opacity="0.6">10 MTS</text>
        
        <line x1="780" y1="960" x2="840" y2="960" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.4" />
        <text x="850" y="965" fill="#25A8FF" fontSize="10" fontFamily="monospace" opacity="0.5">15 MTS</text>
        
        <line x1="1060" y1="1000" x2="1020" y2="1000" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.6" />
        <line x1="1100" y1="980" x2="1050" y2="980" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.5" />
        <line x1="1140" y1="960" x2="1080" y2="960" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.4" />

        <g filter="url(#hudGlow)">
          <line x1="930" y1="520" x2="950" y2="540" stroke="#25A8FF" strokeWidth="1.5" />
          <line x1="990" y1="520" x2="970" y2="540" stroke="#25A8FF" strokeWidth="1.5" />
          <line x1="930" y1="560" x2="950" y2="540" stroke="#25A8FF" strokeWidth="1.5" />
          <line x1="990" y1="560" x2="970" y2="540" stroke="#25A8FF" strokeWidth="1.5" />
          <circle cx="960" cy="540" r="3" fill="none" stroke="#25A8FF" strokeWidth="1" />
        </g>

        <line x1="0" y1="200" x2="0" y2="400" stroke="#25A8FF" strokeWidth="3" strokeOpacity="0.3" />
        <line x1="0" y1="680" x2="0" y2="880" stroke="#25A8FF" strokeWidth="3" strokeOpacity="0.3" />
        <line x1="1920" y1="200" x2="1920" y2="400" stroke="#25A8FF" strokeWidth="3" strokeOpacity="0.3" />
        <line x1="1920" y1="680" x2="1920" y2="880" stroke="#25A8FF" strokeWidth="3" strokeOpacity="0.3" />
      </svg>

      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto z-10">
        <div className="flex items-center gap-4 text-xs font-mono px-4 py-1.5 rounded bg-slate-900/60 backdrop-blur-sm border border-cyan-500/20">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-red-400 font-bold tracking-wide">REC</span>
            <span className="text-cyan-300 font-medium">{formatTime(recordingTime)}</span>
          </div>
          <div className="w-px h-4 bg-cyan-500/30" />
          <span className="text-cyan-300/90 tracking-wide">CAM: HUSKY_LENS</span>
          <div className="w-px h-4 bg-cyan-500/30" />
          <span className="text-cyan-300/90">1080p</span>
        </div>
      </div>

      {isDemoMode && (
        <div className="absolute top-2 right-4 bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 rounded text-xs font-mono text-cyan-300 pointer-events-auto backdrop-blur-sm">
          DEMO MODE
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
          }`} style={{ boxShadow: obj.type.includes('HAZARD') ? '0 0 10px rgba(239,68,68,0.6)' : '0 0 10px rgba(103,199,255,0.6)' }}>
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-inherit" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-inherit" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-inherit" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-inherit" />
            
            <div className={`absolute -top-6 left-0 text-[10px] px-2 py-0.5 font-mono font-bold ${
              obj.type.includes('HAZARD') ? 'bg-red-500/90 text-white' : 'bg-cyan-500/90 text-white'
            }`}>
              {obj.type} {Math.round(obj.confidence)}%
            </div>
            <div className="absolute -bottom-5 left-0 text-[8px] text-cyan-400/70 font-mono">
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

  const indicatorX = 50 + (pan / 180) * 35;
  const indicatorY = 50 - (tilt / 90) * 35;

  return (
    <div className={`relative pointer-events-auto ${className}`}>
      <div className="relative w-[100px] h-[100px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="cameraControlBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#0A192F" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A192F" stopOpacity="0.6" />
            </radialGradient>
            <filter id="cameraGlow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="46" fill="url(#cameraControlBg)" stroke="#25A8FF" strokeWidth="2" filter="url(#cameraGlow)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />

          <line x1="50" y1="6" x2="50" y2="94" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />

          <polygon points="50,8 47,16 53,16" fill="#67C7FF" opacity="0.9" />
          <polygon points="50,92 47,84 53,84" fill="#67C7FF" opacity="0.9" />
          <polygon points="8,50 16,47 16,53" fill="#67C7FF" opacity="0.9" />
          <polygon points="92,50 84,47 84,53" fill="#67C7FF" opacity="0.9" />

          <circle cx={indicatorX} cy={indicatorY} r="6" fill="#25A8FF" fillOpacity="0.3" filter="url(#cameraGlow)" />
          <circle cx={indicatorX} cy={indicatorY} r="4" fill="#25A8FF" />
          <circle cx={indicatorX} cy={indicatorY} r="2" fill="#67C7FF" />
        </svg>

        <button
          onClick={() => handleTiltChange(tilt + 15)}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-up"
        >
          <svg width="12" height="8" viewBox="0 0 12 8"><path d="M6 0 L12 8 L0 8 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handleTiltChange(tilt - 15)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-down"
        >
          <svg width="12" height="8" viewBox="0 0 12 8"><path d="M6 8 L0 0 L12 0 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan - 30)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-left"
        >
          <svg width="8" height="12" viewBox="0 0 8 12"><path d="M0 6 L8 0 L8 12 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan + 30)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-right"
        >
          <svg width="8" height="12" viewBox="0 0 8 12"><path d="M8 6 L0 0 L0 12 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={handleCenter}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors border border-cyan-400/40"
          data-testid="button-cam-center"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400" />
        </button>
      </div>

      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-3 text-[9px] font-mono text-cyan-400/70 bg-slate-900/50 px-2 py-0.5 rounded backdrop-blur-sm">
        <span>P:{pan}°</span>
        <span>T:{tilt}°</span>
      </div>
    </div>
  );
}
