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
        className="absolute top-0 left-0 w-full" 
        viewBox="0 0 1925.5 121.58"
        preserveAspectRatio="xMidYMin slice"
        style={{ height: 'auto', maxHeight: '15%' }}
      >
        <defs>
          <filter id="headerGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon 
          points="2.5 19.83 249.62 50.07 290.33 83.93 707.97 119 775.3 60.15 1171.17 60.55 1241.71 119 1659.36 82.32 1693.62 52.09 1923 23.46 1923 2.5 2.5 2.5 2.5 19.83"
          fill="#2cd7ff"
          fillOpacity="0.6"
          stroke="aqua"
          strokeWidth="5"
          strokeMiterlimit="10"
          filter="url(#headerGlow)"
        />
      </svg>

      <svg 
        className="absolute bottom-0 left-0 w-full" 
        viewBox="0 0 1925.5 121.58"
        preserveAspectRatio="xMidYMax slice"
        style={{ height: 'auto', maxHeight: '15%', transform: 'scaleY(-1)' }}
      >
        <defs>
          <filter id="footerGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon 
          points="2.5 19.83 249.62 50.07 290.33 83.93 707.97 119 775.3 60.15 1171.17 60.55 1241.71 119 1659.36 82.32 1693.62 52.09 1923 23.46 1923 2.5 2.5 2.5 2.5 19.83"
          fill="#2cd7ff"
          fillOpacity="0.6"
          stroke="aqua"
          strokeWidth="5"
          strokeMiterlimit="10"
          filter="url(#footerGlow)"
        />
      </svg>

      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1024 576" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glowSoft">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glowMedium">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#glowSoft)">
          <path d="M 486 86 L 504 78 L 520 78 L 538 86 L 520 94 L 504 94 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="103" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">15 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 476 104 L 498 96 L 526 96 L 548 104 L 526 112 L 498 112 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="121" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">10 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 466 122 L 492 114 L 532 114 L 558 122 L 532 130 L 492 130 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="139" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">5 MTS</text>
        </g>

        <g filter="url(#glowSoft)">
          <path d="M 466 446 L 492 438 L 532 438 L 558 446 L 532 454 L 492 454 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="463" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">5 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 476 464 L 498 456 L 526 456 L 548 464 L 526 472 L 498 472 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="481" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">10 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 486 482 L 504 474 L 520 474 L 538 482 L 520 490 L 504 490 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="499" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">15 MTS</text>
        </g>

        <g filter="url(#glowMedium)">
          <circle cx="100" cy="476" r="58" fill="none" stroke="#25A8FF" strokeWidth="2" strokeOpacity="0.9" />
          <circle cx="100" cy="476" r="44" fill="none" stroke="#25A8FF" strokeWidth="1.5" strokeOpacity="0.7" />
          <circle cx="100" cy="476" r="30" fill="none" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.5" />
          <circle cx="100" cy="476" r="16" fill="none" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="100" y1="418" x2="100" y2="534" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />
          <line x1="42" y1="476" x2="158" y2="476" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />
          <polygon points="100,420 97,430 103,430" fill="#FFFF00" opacity="0.9" />
        </g>
      </svg>

      <div className="absolute top-[2%] left-1/2 -translate-x-1/2 pointer-events-auto z-10">
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
        <div className="absolute top-[12%] right-[8%] bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-auto">
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
