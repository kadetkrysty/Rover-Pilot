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
        viewBox="0 0 1930 335.41"
        preserveAspectRatio="xMidYMax slice"
        style={{ height: 'auto', maxHeight: '35%' }}
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
        <g opacity="0.6" filter="url(#footerGlow)">
          <path 
            fill="#2cd7ff"
            d="M2.5,332.91V2.71L156.91,15l41.38,30.76-1.13,1.94A180.85,180.85,0,0,0,183,81.33l-.06.15a141,141,0,0,0-9.45,50.93c0,78,63.48,141.5,141.5,141.5a140.89,140.89,0,0,0,52.67-10.13c56.95-22.16,82.79-79.79,83-80.37l.79-1.8,302,53.18,97.8-55.88h224.31l102.78,56.88,300-54.17.83,1.68a159.64,159.64,0,0,0,9.28,15.59l.07.11.06.11A141.52,141.52,0,0,0,1708,239.2l.11-.1.58-.4,1.68-1.17c1-1.07,1.92-2.13,2.85-3.2l.12-.13a140.86,140.86,0,0,0,39.17-71.54c15.63-64.15-22-112.21-22.42-112.69l-1.54-1.92L1771,13,1927.5,2.74V332.91Z"
          />
          <path 
            fill="aqua"
            d="M1925,5.41v325H5V5.41l151,12,39,29s-7.84,13.38-14.38,34.17a144.08,144.08,0,0,0,188,185.52c58.61-22.81,84.4-81.69,84.4-81.69l301,53,98-56h223l103,57,299-54a160.15,160.15,0,0,0,9.44,15.86,144,144,0,0,0,223.18,40.8c.79-.55,1.58-1.09,2.38-1.66q1.56-1.71,3.06-3.43a143.67,143.67,0,0,0,39.85-72.81C1771,97.16,1732,48.41,1732,48.41l40-33,153-10M0,0V335.41H1930V.08l-5.33.34-153,10-1.61.11-1.24,1-40,33-3.8,3.13,3.08,3.85c.09.11,9.49,12.05,16.84,31.62,6.73,17.91,13.08,46.13,5.12,78.83l0,.07,0,.08a138.31,138.31,0,0,1-38.47,70.28l-.13.13-.12.14c-1,1.11-1.83,2.06-2.63,2.95-.5.36-1,.7-1.51,1.05l-.38.27-.25.17-.23.2A139,139,0,0,1,1490.87,198l-.12-.23-.14-.21a159.21,159.21,0,0,1-9.13-15.31l-1.67-3.37-3.7.66-297.25,53.69L1077.42,177l-1.13-.63H850.67l-1.15.66-96.43,55.11L453.87,179.49l-3.87-.68-1.58,3.6c-.06.14-6.46,14.54-19.76,31.44-12.16,15.46-32.76,36.26-61.88,47.59h0a138.35,138.35,0,0,1-51.73,10c-76.64,0-139-62.35-139-139a138.18,138.18,0,0,1,9.29-50l.05-.15,0-.15a179,179,0,0,1,13.93-33.14l2.25-3.87L198,42.4l-39-29-1.15-.86-1.43-.11L5.4.43,0,0Z"
          />
        </g>
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
