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
        viewBox="0 0 1024 576" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glowSoft">
            <feGaussianBlur stdDeviation="1" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glowMedium">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 0 0 
             L 0 125 
             L 15 125 
             L 25 115 
             L 45 115 
             L 55 105 
             L 85 105 
             L 100 90 
             L 140 90 
             L 160 75 
             L 220 75 
             L 245 55 
             L 310 55 
             L 340 35 
             L 400 35 
             L 420 20 
             L 420 0 
             Z"
          fill="#2589D0"
          fillOpacity="0.95"
        />
        <path
          d="M 0 125 
             L 15 125 
             L 25 115 
             L 45 115 
             L 55 105 
             L 85 105 
             L 100 90 
             L 140 90 
             L 160 75 
             L 220 75 
             L 245 55 
             L 310 55 
             L 340 35 
             L 400 35 
             L 420 20"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          filter="url(#glowMedium)"
        />
        <path
          d="M 0 125 
             L 15 125 
             L 25 115 
             L 45 115 
             L 55 105 
             L 85 105 
             L 100 90 
             L 140 90 
             L 160 75 
             L 220 75 
             L 245 55 
             L 310 55 
             L 340 35 
             L 400 35 
             L 420 20"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="0.5"
          strokeOpacity="0.8"
        />

        <path
          d="M 1024 0 
             L 1024 125 
             L 1009 125 
             L 999 115 
             L 979 115 
             L 969 105 
             L 939 105 
             L 924 90 
             L 884 90 
             L 864 75 
             L 804 75 
             L 779 55 
             L 714 55 
             L 684 35 
             L 624 35 
             L 604 20 
             L 604 0 
             Z"
          fill="#2589D0"
          fillOpacity="0.95"
        />
        <path
          d="M 1024 125 
             L 1009 125 
             L 999 115 
             L 979 115 
             L 969 105 
             L 939 105 
             L 924 90 
             L 884 90 
             L 864 75 
             L 804 75 
             L 779 55 
             L 714 55 
             L 684 35 
             L 624 35 
             L 604 20"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          filter="url(#glowMedium)"
        />
        <path
          d="M 1024 125 
             L 1009 125 
             L 999 115 
             L 979 115 
             L 969 105 
             L 939 105 
             L 924 90 
             L 884 90 
             L 864 75 
             L 804 75 
             L 779 55 
             L 714 55 
             L 684 35 
             L 624 35 
             L 604 20"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="0.5"
          strokeOpacity="0.8"
        />

        <rect x="447" y="8" width="130" height="24" rx="5" ry="5" 
          fill="rgba(37, 168, 255, 0.1)" 
          stroke="#25A8FF" 
          strokeWidth="1.5"
          filter="url(#glowMedium)"
        />
        <rect x="452" y="12" width="120" height="16" rx="3" ry="3" 
          fill="rgba(37, 168, 255, 0.08)" 
          stroke="#67C7FF" 
          strokeWidth="0.5"
          strokeOpacity="0.6"
        />

        <g filter="url(#glowSoft)">
          <path d="M 480 42 L 486 38 L 538 38 L 544 42 L 538 46 L 486 46 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="43" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">15 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 472 54 L 480 50 L 544 50 L 552 54 L 544 58 L 480 58 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="55" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">10 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 464 66 L 474 62 L 550 62 L 560 66 L 550 70 L 474 70 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="67" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">5 MTS</text>
        </g>

        <line x1="55" y1="85" x2="80" y2="85" stroke="#25A8FF" strokeWidth="1.2" strokeOpacity="0.7" filter="url(#glowSoft)" />
        <line x1="90" y1="72" x2="110" y2="72" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.6" filter="url(#glowSoft)" />
        <line x1="125" y1="62" x2="140" y2="62" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.5" filter="url(#glowSoft)" />
        <rect x="30" y="100" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="42" y="100" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        
        <line x1="969" y1="85" x2="944" y2="85" stroke="#25A8FF" strokeWidth="1.2" strokeOpacity="0.7" filter="url(#glowSoft)" />
        <line x1="934" y1="72" x2="914" y2="72" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.6" filter="url(#glowSoft)" />
        <line x1="899" y1="62" x2="884" y2="62" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.5" filter="url(#glowSoft)" />
        <rect x="988" y="100" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="976" y="100" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />

        <path
          d="M 0 576 
             L 0 456 
             L 25 456 
             L 35 466 
             L 50 466 
             L 60 456 
             L 80 456 
             L 95 440 
             L 125 440 
             L 145 420 
             L 185 420 
             L 215 400 
             L 280 400 
             L 320 430 
             L 370 430 
             L 400 460 
             L 440 460 
             L 470 490 
             L 490 490 
             L 512 520 
             L 512 576 
             Z"
          fill="#2589D0"
          fillOpacity="0.95"
        />
        <path
          d="M 0 456 
             L 25 456 
             L 35 466 
             L 50 466 
             L 60 456 
             L 80 456 
             L 95 440 
             L 125 440 
             L 145 420 
             L 185 420 
             L 215 400 
             L 280 400 
             L 320 430 
             L 370 430 
             L 400 460 
             L 440 460 
             L 470 490 
             L 490 490 
             L 512 520"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          filter="url(#glowMedium)"
        />
        <path
          d="M 0 456 
             L 25 456 
             L 35 466 
             L 50 466 
             L 60 456 
             L 80 456 
             L 95 440 
             L 125 440 
             L 145 420 
             L 185 420 
             L 215 400 
             L 280 400 
             L 320 430 
             L 370 430 
             L 400 460 
             L 440 460 
             L 470 490 
             L 490 490 
             L 512 520"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="0.5"
          strokeOpacity="0.8"
        />

        <path
          d="M 1024 576 
             L 1024 456 
             L 999 456 
             L 989 466 
             L 974 466 
             L 964 456 
             L 944 456 
             L 929 440 
             L 899 440 
             L 879 420 
             L 839 420 
             L 809 400 
             L 744 400 
             L 704 430 
             L 654 430 
             L 624 460 
             L 584 460 
             L 554 490 
             L 534 490 
             L 512 520 
             L 512 576 
             Z"
          fill="#2589D0"
          fillOpacity="0.95"
        />
        <path
          d="M 1024 456 
             L 999 456 
             L 989 466 
             L 974 466 
             L 964 456 
             L 944 456 
             L 929 440 
             L 899 440 
             L 879 420 
             L 839 420 
             L 809 400 
             L 744 400 
             L 704 430 
             L 654 430 
             L 624 460 
             L 584 460 
             L 554 490 
             L 534 490 
             L 512 520"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="1.5"
          filter="url(#glowMedium)"
        />
        <path
          d="M 1024 456 
             L 999 456 
             L 989 466 
             L 974 466 
             L 964 456 
             L 944 456 
             L 929 440 
             L 899 440 
             L 879 420 
             L 839 420 
             L 809 400 
             L 744 400 
             L 704 430 
             L 654 430 
             L 624 460 
             L 584 460 
             L 554 490 
             L 534 490 
             L 512 520"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="0.5"
          strokeOpacity="0.8"
        />

        <g filter="url(#glowSoft)">
          <path d="M 464 510 L 474 506 L 550 506 L 560 510 L 550 514 L 474 514 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="511" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">5 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 472 522 L 480 518 L 544 518 L 552 522 L 544 526 L 480 526 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="523" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">10 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 480 534 L 486 530 L 538 530 L 544 534 L 538 538 L 486 538 Z" fill="rgba(37, 168, 255, 0.2)" stroke="#25A8FF" strokeWidth="0.8" />
          <text x="512" y="535" fill="#67C7FF" fontSize="6" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">15 MTS</text>
        </g>

        <rect x="30" y="475" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="42" y="475" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="60" y="460" width="5" height="2" fill="#25A8FF" fillOpacity="0.6" />
        <rect x="988" y="475" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="976" y="475" width="6" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="959" y="460" width="5" height="2" fill="#25A8FF" fillOpacity="0.6" />
      </svg>

      <div className="absolute top-[1.5%] left-1/2 -translate-x-1/2 pointer-events-auto z-10">
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
        <div className="absolute top-[12%] right-[12%] bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-auto">
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
