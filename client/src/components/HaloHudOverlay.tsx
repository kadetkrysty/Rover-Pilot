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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1920 1080" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="haloGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="haloGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.9"/>
            <stop offset="50%" stopColor="#67C7FF" stopOpacity="1"/>
            <stop offset="100%" stopColor="#25A8FF" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="frameFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#0D2442" stopOpacity="0.25"/>
          </linearGradient>
        </defs>

        <g filter="url(#haloGlow)">
          <path
            d="M 0 120 
               L 0 80 
               L 60 80 
               L 120 40 
               L 280 40 
               L 340 0
               L 480 0"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <path
            d="M 0 160 
               L 0 100 
               L 40 100 
               L 90 60 
               L 200 60"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          <polygon
            points="0,80 60,80 120,40 120,120 60,160 0,160"
            fill="url(#frameFill)"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.4"
          />
        </g>

        <g filter="url(#haloGlow)">
          <path
            d="M 1920 120 
               L 1920 80 
               L 1860 80 
               L 1800 40 
               L 1640 40 
               L 1580 0
               L 1440 0"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <path
            d="M 1920 160 
               L 1920 100 
               L 1880 100 
               L 1830 60 
               L 1720 60"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          <polygon
            points="1920,80 1860,80 1800,40 1800,120 1860,160 1920,160"
            fill="url(#frameFill)"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.4"
          />
        </g>

        <g filter="url(#haloGlowStrong)">
          <path
            d="M 760 20 
               L 860 20 
               L 880 40 
               L 1040 40 
               L 1060 20 
               L 1160 20
               L 1180 40
               L 1180 70
               L 1160 90
               L 760 90
               L 740 70
               L 740 40
               Z"
            fill="url(#frameFill)"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <path
            d="M 800 50 L 1120 50"
            stroke="#67C7FF"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          <rect x="810" y="58" width="300" height="8" rx="2" fill="#25A8FF" fillOpacity="0.3"/>
          <rect x="810" y="58" width="180" height="8" rx="2" fill="#67C7FF" fillOpacity="0.7"/>
        </g>

        <g filter="url(#haloGlow)">
          <path
            d="M 0 1000 
               L 0 900 
               L 80 850 
               L 200 850 
               L 280 900 
               L 350 900
               L 420 960
               L 500 960"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <polygon
            points="0,900 80,850 200,850 280,900 280,980 200,1030 80,1030 0,980"
            fill="url(#frameFill)"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        </g>

        <g filter="url(#haloGlow)">
          <path
            d="M 1920 1000 
               L 1920 900 
               L 1840 850 
               L 1720 850 
               L 1640 900 
               L 1570 900
               L 1500 960
               L 1420 960"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <polygon
            points="1920,900 1840,850 1720,850 1640,900 1640,980 1720,1030 1840,1030 1920,980"
            fill="url(#frameFill)"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        </g>

        <g filter="url(#haloGlow)">
          <path
            d="M 600 1060 
               L 700 1000 
               L 860 1000 
               L 920 950 
               L 960 920 
               L 1000 950 
               L 1060 1000 
               L 1220 1000 
               L 1320 1060"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="3"
          />
          <path
            d="M 700 1080 
               L 780 1030 
               L 880 1030 
               L 920 1000 
               L 960 970 
               L 1000 1000 
               L 1040 1030 
               L 1140 1030 
               L 1220 1080"
            fill="none"
            stroke="#25A8FF"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
          
          <line x1="880" y1="1050" x2="1040" y2="1050" stroke="#67C7FF" strokeWidth="2" strokeOpacity="0.6"/>
          <text x="960" y="1045" textAnchor="middle" fill="#67C7FF" fontSize="14" fontFamily="monospace" opacity="0.8">5 MTS</text>
          
          <line x1="850" y1="1070" x2="1070" y2="1070" stroke="#67C7FF" strokeWidth="2" strokeOpacity="0.5"/>
          <text x="960" y="1065" textAnchor="middle" fill="#67C7FF" fontSize="12" fontFamily="monospace" opacity="0.6">10 MTS</text>
          
          <line x1="820" y1="1090" x2="1100" y2="1090" stroke="#67C7FF" strokeWidth="2" strokeOpacity="0.4"/>
        </g>
      </svg>

      <div className="absolute top-[2%] left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-4 text-[11px] font-mono px-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-red-400 font-bold">REC</span>
            <span className="text-cyan-400">{formatTime(recordingTime)}</span>
          </div>
          <span className="text-cyan-500/60">|</span>
          <span className="text-cyan-400/80">CAM: HUSKY_LENS</span>
          <span className="text-cyan-500/60">|</span>
          <span className="text-cyan-400/80">1080p 60FPS</span>
        </div>
      </div>

      {isDemoMode && (
        <div className="absolute top-[2%] right-[5%] bg-cyan-500/20 border border-cyan-400/50 px-3 py-1 rounded text-[10px] font-mono text-cyan-400 pointer-events-auto">
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
          }`} style={{ boxShadow: obj.type.includes('HAZARD') ? '0 0 10px rgba(239,68,68,0.5)' : '0 0 10px rgba(103,199,255,0.5)' }}>
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-inherit" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-inherit" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-inherit" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-inherit" />
            
            <div className={`absolute -top-6 left-0 text-[9px] px-2 py-0.5 font-mono font-bold ${
              obj.type.includes('HAZARD') ? 'bg-red-500/90 text-white' : 'bg-cyan-500/90 text-white'
            }`} style={{ boxShadow: '0 0 8px rgba(0,0,0,0.5)' }}>
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

  const indicatorX = 50 + (pan / 180) * 35;
  const indicatorY = 50 - (tilt / 90) * 35;

  return (
    <div className={`relative pointer-events-auto ${className}`}>
      <div className="relative w-28 h-28">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="radarBgGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#25A8FF" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#0D2442" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#25A8FF" stopOpacity="0.1" />
            </radialGradient>
            <filter id="radarGlow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <mask id="sweepMask">
              <rect x="0" y="0" width="100" height="100" fill="black"/>
              <path
                d={`M 50 50 L 50 5 A 45 45 0 ${sweepAngle > 180 ? 1 : 0} 1 ${50 + 45 * Math.sin(sweepAngle * Math.PI / 180)} ${50 - 45 * Math.cos(sweepAngle * Math.PI / 180)} Z`}
                fill="white"
                opacity="0.3"
              />
            </mask>
          </defs>

          <circle cx="50" cy="50" r="46" fill="url(#radarBgGrad)" stroke="#25A8FF" strokeWidth="2.5" filter="url(#radarGlow)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.3" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="#25A8FF" strokeWidth="1" strokeOpacity="0.2" />

          <line x1="50" y1="4" x2="50" y2="96" stroke="#25A8FF" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="#25A8FF" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="17" y1="17" x2="83" y2="83" stroke="#25A8FF" strokeWidth="0.3" strokeOpacity="0.2" />
          <line x1="83" y1="17" x2="17" y2="83" stroke="#25A8FF" strokeWidth="0.3" strokeOpacity="0.2" />

          <circle cx="50" cy="50" r="45" fill="#25A8FF" fillOpacity="0.1" mask="url(#sweepMask)" />
          <line 
            x1="50" 
            y1="50" 
            x2={50 + 42 * Math.sin(sweepAngle * Math.PI / 180)} 
            y2={50 - 42 * Math.cos(sweepAngle * Math.PI / 180)} 
            stroke="#67C7FF" 
            strokeWidth="1.5" 
            strokeOpacity="0.8"
            filter="url(#radarGlow)"
          />

          <polygon 
            points="50,6 47,14 53,14" 
            fill="#67C7FF"
          />

          <circle 
            cx={indicatorX} 
            cy={indicatorY} 
            r="5" 
            fill="#25A8FF"
            filter="url(#radarGlow)"
          />
          <circle 
            cx={indicatorX} 
            cy={indicatorY} 
            r="2.5" 
            fill="#67C7FF"
          />
        </svg>

        <button
          onClick={() => handleTiltChange(tilt + 15)}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-up"
        >
          <svg width="14" height="8" viewBox="0 0 14 8">
            <path d="M7 0 L14 8 L0 8 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handleTiltChange(tilt - 15)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-down"
        >
          <svg width="14" height="8" viewBox="0 0 14 8">
            <path d="M7 8 L0 0 L14 0 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handlePanChange(pan - 30)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-left"
        >
          <svg width="8" height="14" viewBox="0 0 8 14">
            <path d="M0 7 L8 0 L8 14 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={() => handlePanChange(pan + 30)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-right"
        >
          <svg width="8" height="14" viewBox="0 0 8 14">
            <path d="M8 7 L0 0 L0 14 Z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleCenter}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors border border-cyan-400/30"
          data-testid="button-cam-center"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400/80" />
        </button>
      </div>

      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-3 text-[9px] font-mono text-cyan-400/70">
        <span>P:{pan}°</span>
        <span>T:{tilt}°</span>
      </div>
    </div>
  );
}
