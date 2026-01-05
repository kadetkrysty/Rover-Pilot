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
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 0 0 
             L 0 136 
             L 122 176 
             L 246 158 
             L 346 126 
             L 420 96 
             L 476 64 
             L 506 44 
             L 528 22 
             L 528 0 
             Z"
          fill="#1a3a5c"
          fillOpacity="0.85"
        />
        <path
          d="M 0 136 
             L 122 176 
             L 246 158 
             L 346 126 
             L 420 96 
             L 476 64 
             L 506 44 
             L 528 22"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2.4"
          filter="url(#glowMedium)"
        />
        <path
          d="M 3 133 
             L 122 172 
             L 244 155 
             L 343 124 
             L 417 94 
             L 473 63 
             L 503 43 
             L 525 22"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="1"
          strokeOpacity="0.7"
        />

        <path
          d="M 1024 0 
             L 1024 136 
             L 902 176 
             L 778 158 
             L 678 126 
             L 604 96 
             L 548 64 
             L 518 44 
             L 496 22 
             L 496 0 
             Z"
          fill="#1a3a5c"
          fillOpacity="0.85"
        />
        <path
          d="M 1024 136 
             L 902 176 
             L 778 158 
             L 678 126 
             L 604 96 
             L 548 64 
             L 518 44 
             L 496 22"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2.4"
          filter="url(#glowMedium)"
        />
        <path
          d="M 1021 133 
             L 902 172 
             L 780 155 
             L 681 124 
             L 607 94 
             L 551 63 
             L 521 43 
             L 499 22"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="1"
          strokeOpacity="0.7"
        />

        <path
          d="M 402 18 
             Q 402 8, 412 4
             L 438 0 
             L 586 0 
             Q 612 0, 622 18
             L 622 44 
             Q 622 54, 612 58
             L 586 62 
             L 438 62 
             Q 412 62, 402 44
             Z"
          fill="rgba(37, 168, 255, 0.08)"
          stroke="#25A8FF"
          strokeWidth="2"
          filter="url(#glowMedium)"
        />
        <path
          d="M 428 18 
             L 596 18 
             Q 612 18, 614 28
             L 614 38 
             Q 612 48, 596 48
             L 428 48 
             Q 412 48, 410 38
             L 410 28 
             Q 412 18, 428 18
             Z"
          fill="rgba(103, 199, 255, 0.1)"
          stroke="#67C7FF"
          strokeWidth="0.8"
          strokeOpacity="0.6"
        />

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

        <line x1="60" y1="150" x2="100" y2="150" stroke="#25A8FF" strokeWidth="1.5" strokeOpacity="0.6" filter="url(#glowSoft)" />
        <line x1="110" y1="140" x2="140" y2="140" stroke="#25A8FF" strokeWidth="1.2" strokeOpacity="0.5" filter="url(#glowSoft)" />
        <rect x="40" y="160" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="54" y="160" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        
        <line x1="964" y1="150" x2="924" y2="150" stroke="#25A8FF" strokeWidth="1.5" strokeOpacity="0.6" filter="url(#glowSoft)" />
        <line x1="914" y1="140" x2="884" y2="140" stroke="#25A8FF" strokeWidth="1.2" strokeOpacity="0.5" filter="url(#glowSoft)" />
        <rect x="976" y="160" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="962" y="160" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />

        <path
          d="M 0 576 
             L 0 444 
             L 42 444 
             L 66 460 
             L 106 460 
             L 130 438 
             L 170 416 
             L 222 404 
             L 302 408 
             L 352 432 
             L 394 462 
             L 430 492 
             L 460 512 
             L 486 540 
             L 512 576 
             Z"
          fill="#1a3a5c"
          fillOpacity="0.85"
        />
        <path
          d="M 0 444 
             L 42 444 
             L 66 460 
             L 106 460 
             L 130 438 
             L 170 416 
             L 222 404 
             L 302 408 
             L 352 432 
             L 394 462 
             L 430 492 
             L 460 512 
             L 486 540 
             L 512 576"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2.4"
          filter="url(#glowMedium)"
        />
        <path
          d="M 3 447 
             L 42 447 
             L 64 462 
             L 104 462 
             L 128 441 
             L 168 419 
             L 220 407 
             L 300 411 
             L 350 434 
             L 392 464 
             L 428 494 
             L 458 514 
             L 484 541"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="1"
          strokeOpacity="0.7"
        />

        <path
          d="M 1024 576 
             L 1024 444 
             L 982 444 
             L 958 460 
             L 918 460 
             L 894 438 
             L 854 416 
             L 802 404 
             L 722 408 
             L 672 432 
             L 630 462 
             L 594 492 
             L 564 512 
             L 538 540 
             L 512 576 
             Z"
          fill="#1a3a5c"
          fillOpacity="0.85"
        />
        <path
          d="M 1024 444 
             L 982 444 
             L 958 460 
             L 918 460 
             L 894 438 
             L 854 416 
             L 802 404 
             L 722 408 
             L 672 432 
             L 630 462 
             L 594 492 
             L 564 512 
             L 538 540 
             L 512 576"
          fill="none"
          stroke="#25A8FF"
          strokeWidth="2.4"
          filter="url(#glowMedium)"
        />
        <path
          d="M 1021 447 
             L 982 447 
             L 960 462 
             L 920 462 
             L 896 441 
             L 856 419 
             L 804 407 
             L 724 411 
             L 674 434 
             L 632 464 
             L 596 494 
             L 566 514 
             L 540 541"
          fill="none"
          stroke="#67C7FF"
          strokeWidth="1"
          strokeOpacity="0.7"
        />

        <g filter="url(#glowSoft)">
          <path d="M 466 486 L 492 478 L 532 478 L 558 486 L 532 494 L 492 494 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="503" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">5 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 476 504 L 498 496 L 526 496 L 548 504 L 526 512 L 498 512 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="521" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">10 MTS</text>
        </g>
        <g filter="url(#glowSoft)">
          <path d="M 486 522 L 504 514 L 520 514 L 538 522 L 520 530 L 504 530 Z" 
            fill="rgba(37, 168, 255, 0.15)" stroke="#25A8FF" strokeWidth="1" />
          <text x="512" y="539" fill="#67C7FF" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1">15 MTS</text>
        </g>

        <rect x="40" y="460" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="54" y="460" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="976" y="460" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />
        <rect x="962" y="460" width="8" height="2" fill="#25A8FF" fillOpacity="0.7" />

        <g filter="url(#glowMedium)">
          <circle cx="154" cy="454" r="74" fill="none" stroke="#25A8FF" strokeWidth="2" strokeOpacity="0.9" />
          <circle cx="154" cy="454" r="58" fill="none" stroke="#25A8FF" strokeWidth="1.5" strokeOpacity="0.7" />
          <circle cx="154" cy="454" r="42" fill="none" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.5" />
          <circle cx="154" cy="454" r="26" fill="none" stroke="#25A8FF" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="154" y1="380" x2="154" y2="528" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />
          <line x1="80" y1="454" x2="228" y2="454" stroke="#25A8FF" strokeWidth="0.6" strokeOpacity="0.3" />
          <path 
            d="M 154 454 L 120 400 A 74 74 0 0 1 188 400 Z" 
            fill="rgba(37, 168, 255, 0.08)" 
            stroke="#25A8FF" 
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />
          <polygon points="154,382 150,394 158,394" fill="#FFFF00" opacity="0.9" />
        </g>
      </svg>

      <div className="absolute top-[1.2%] left-1/2 -translate-x-1/2 pointer-events-auto z-10">
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
        <div className="absolute top-[15%] right-[8%] bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-auto">
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
