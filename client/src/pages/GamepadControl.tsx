import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Camera, Video, Volume2, Lightbulb, ZoomIn, ZoomOut, Sun } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';
import { GamepadInput, useGamepad } from '@/hooks/useGamepad';
import { useWebSocket } from '@/lib/useWebSocket';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function GamepadControl() {
  const [, setLocation] = useLocation();
  const data = useRoverData();
  const gamepadInput = useGamepad();
  const { sendCommand, isConnected: wsConnected } = useWebSocket();
  
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [mode, setMode] = useState<'MANUAL' | 'AUTONOMOUS'>('MANUAL');
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [cameraPan, setCameraPan] = useState(0);
  const [cameraTilt, setCameraTilt] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1.0);
  const [cameraExposure, setCameraExposure] = useState(0);
  const [lightsEnabled, setLightsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hornActive, setHornActive] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const prevInputRef = useRef<GamepadInput | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isButtonJustPressed = (current: boolean, prev: boolean | undefined) => {
    return current && !prev;
  };

  useEffect(() => {
    if (!gamepadInput.isConnected) {
      prevInputRef.current = null;
      return;
    }

    const prev = prevInputRef.current;

    if (isButtonJustPressed(gamepadInput.options, prev?.options)) {
      setEmergencyStop(true);
      setThrottle(0);
      setSteering(0);
      sendCommand({ type: 'command', action: 'ESTOP', timestamp: Date.now() });
      toast.error('EMERGENCY STOP ACTIVATED');
      setTimeout(() => setEmergencyStop(false), 3000);
    }

    if (isButtonJustPressed(gamepadInput.psButton, prev?.psButton)) {
      toast.info('Exiting Gamepad Mode');
      setLocation('/');
      return;
    }

    if (!emergencyStop) {
      if (gamepadInput.triangle) {
        setThrottle(100);
        setMode('MANUAL');
      } else if (gamepadInput.x) {
        setThrottle(-100);
        setMode('MANUAL');
      } else {
        setThrottle(0);
      }

      setSteering(gamepadInput.rightStickX * 100);
      setCameraPan(gamepadInput.leftStickX * 90);
      setCameraTilt(-gamepadInput.leftStickY * 45);

      if (isButtonJustPressed(gamepadInput.circle, prev?.circle)) {
        if (!isRecording) {
          setIsRecording(true);
          setRecordingTime(0);
          sendCommand({ type: 'command', action: 'START_RECORDING', timestamp: Date.now() });
          toast.success('Recording Started');
        }
      }

      if (isButtonJustPressed(gamepadInput.square, prev?.square)) {
        if (isRecording) {
          setIsRecording(false);
          sendCommand({ type: 'command', action: 'STOP_RECORDING', timestamp: Date.now() });
          toast.success('Recording Stopped');
        }
      }

      if (isButtonJustPressed(gamepadInput.share, prev?.share)) {
        setLightsEnabled(!lightsEnabled);
        sendCommand({ type: 'command', action: lightsEnabled ? 'LIGHTS_OFF' : 'LIGHTS_ON', timestamp: Date.now() });
        toast.success(lightsEnabled ? 'Lights OFF' : 'Lights ON');
      }

      if (gamepadInput.dPadUp) {
        setCameraZoom(z => Math.min(5.0, z + 0.05));
      }
      if (gamepadInput.dPadDown) {
        setCameraZoom(z => Math.max(1.0, z - 0.05));
      }

      if (gamepadInput.dPadLeft) {
        setCameraExposure(e => Math.max(-2, e - 0.1));
      }
      if (gamepadInput.dPadRight) {
        setCameraExposure(e => Math.min(2, e + 0.1));
      }

      if (isButtonJustPressed(gamepadInput.l1, prev?.l1)) {
        sendCommand({ type: 'command', action: 'CAPTURE_SNAPSHOT', timestamp: Date.now() });
        toast.success('Snapshot Captured');
      }

      setHornActive(gamepadInput.l2 > 0.5);
      if (gamepadInput.l2 > 0.5 && !(prev?.l2 && prev.l2 > 0.5)) {
        sendCommand({ type: 'command', action: 'HORN_ON', timestamp: Date.now() });
      } else if (gamepadInput.l2 <= 0.5 && prev?.l2 && prev.l2 > 0.5) {
        sendCommand({ type: 'command', action: 'HORN_OFF', timestamp: Date.now() });
      }
    }

    prevInputRef.current = { ...gamepadInput };
  }, [gamepadInput]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isDemoMode = !wsConnected;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4" data-testid="page-gamepad-control">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-primary">GAMEPAD CONTROL</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">PS4 DualShock 4 Controller</p>
          </div>
          <div className={`px-3 py-1 rounded font-mono text-xs ${isDemoMode ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-secondary/20 text-secondary border border-secondary/50'}`}>
            {isDemoMode ? 'DEMO MODE' : 'CONNECTED'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <div className="hud-panel p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {gamepadInput.isConnected ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_var(--secondary)]"></div>
                  <span className="font-mono text-sm text-secondary">PS4 CONNECTED</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
                  <span className="font-mono text-sm text-destructive/70">NO CONTROLLER</span>
                </>
              )}
            </div>
            {gamepadInput.isConnected && (
              <span className="font-mono text-xs text-muted-foreground">Index: {gamepadInput.gamepadIndex}</span>
            )}
          </div>

          <div className="hud-panel p-0 overflow-hidden">
            <div className="aspect-video relative bg-black">
              {isDemoMode ? (
                <DemoCameraFeed 
                  zoom={cameraZoom} 
                  exposure={cameraExposure}
                  isRecording={isRecording}
                  recordingTime={recordingTime}
                  pan={cameraPan}
                  tilt={cameraTilt}
                />
              ) : (
                <LiveCameraFeed 
                  zoom={cameraZoom}
                  pan={cameraPan}
                  tilt={cameraTilt}
                />
              )}
              
              {isDemoMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent/90 px-3 py-1 rounded text-xs font-mono font-bold">
                  DEMO MODE - SIMULATED FEED
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 px-3 py-2 rounded">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="font-mono text-sm text-white">REC {formatTime(recordingTime)}</span>
                </div>
              )}

              <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded font-mono text-xs text-white space-y-1">
                <div>ZOOM: {cameraZoom.toFixed(1)}x</div>
                <div>EXP: {cameraExposure > 0 ? '+' : ''}{cameraExposure.toFixed(1)}</div>
              </div>

              <div className="absolute bottom-4 left-4 flex gap-2">
                {lightsEnabled && (
                  <div className="bg-accent/80 px-2 py-1 rounded text-xs font-mono flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> LIGHTS
                  </div>
                )}
                {hornActive && (
                  <div className="bg-primary/80 px-2 py-1 rounded text-xs font-mono flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> HORN
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="hud-panel p-4">
              <div className="text-xs font-display text-primary/70 mb-2">LEFT STICK - CAMERA</div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 bg-black/50 border border-primary/20 rounded-full">
                  <motion.div
                    className="absolute w-3 h-3 bg-accent rounded-full top-1/2 left-1/2"
                    style={{ x: '-50%', y: '-50%' }}
                    animate={{
                      x: `calc(-50% + ${gamepadInput.leftStickX * 24}px)`,
                      y: `calc(-50% + ${gamepadInput.leftStickY * 24}px)`,
                    }}
                  />
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  <div>PAN: {cameraPan.toFixed(0)}°</div>
                  <div>TILT: {cameraTilt.toFixed(0)}°</div>
                </div>
              </div>
            </div>

            <div className="hud-panel p-4">
              <div className="text-xs font-display text-primary/70 mb-2">RIGHT STICK - STEERING</div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 bg-black/50 border border-primary/20 rounded-full">
                  <motion.div
                    className="absolute w-3 h-3 bg-secondary rounded-full top-1/2 left-1/2"
                    style={{ x: '-50%', y: '-50%' }}
                    animate={{
                      x: `calc(-50% + ${gamepadInput.rightStickX * 24}px)`,
                      y: `calc(-50% + ${gamepadInput.rightStickY * 24}px)`,
                    }}
                  />
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  <div>STEERING: {steering.toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          {emergencyStop && (
            <div className="hud-panel p-4 border-2 border-destructive bg-destructive/10 animate-pulse">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold text-sm">EMERGENCY STOP ACTIVE</span>
              </div>
            </div>
          )}

          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">ROVER MODE</h3>
            <div className={`p-3 rounded border-2 text-center font-display text-lg font-bold ${
              mode === 'MANUAL'
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-accent bg-accent/10 text-accent'
            }`}>
              {mode}
            </div>
          </div>

          <div className="hud-panel p-4 space-y-3">
            <h3 className="text-xs font-display text-primary/70">MOTION CONTROL</h3>
            
            <div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                <span>THROTTLE</span>
                <span className={throttle > 0 ? 'text-secondary' : throttle < 0 ? 'text-destructive' : ''}>{throttle.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-black/50 border border-border rounded overflow-hidden relative">
                <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/30"></div>
                <div
                  className={`h-full transition-all absolute ${throttle >= 0 ? 'left-1/2 bg-secondary' : 'right-1/2 bg-destructive'}`}
                  style={{ width: `${Math.abs(throttle) / 2}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                <span>STEERING</span>
                <span className="text-primary">{steering.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-black/50 border border-border rounded overflow-hidden relative">
                <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/30"></div>
                <div
                  className={`h-full bg-primary transition-all absolute ${steering >= 0 ? 'left-1/2' : 'right-1/2'}`}
                  style={{ width: `${Math.abs(steering) / 2}%` }}
                />
              </div>
            </div>
          </div>

          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">CAMERA GIMBAL</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-black/30 rounded">
                <div className="text-muted-foreground">PAN</div>
                <div className="text-foreground text-lg">{cameraPan.toFixed(0)}°</div>
              </div>
              <div className="p-2 bg-black/30 rounded">
                <div className="text-muted-foreground">TILT</div>
                <div className="text-foreground text-lg">{cameraTilt.toFixed(0)}°</div>
              </div>
            </div>
          </div>

          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">STATUS</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className={`flex justify-between items-center p-2 rounded border ${isRecording ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground'}`}>
                <span className="flex items-center gap-2"><Video className="w-3 h-3" /> RECORDING</span>
                <span>{isRecording ? 'ON' : 'OFF'}</span>
              </div>
              <div className={`flex justify-between items-center p-2 rounded border ${lightsEnabled ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}>
                <span className="flex items-center gap-2"><Lightbulb className="w-3 h-3" /> LIGHTS</span>
                <span>{lightsEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border text-muted-foreground">
                <span className="flex items-center gap-2"><ZoomIn className="w-3 h-3" /> ZOOM</span>
                <span>{cameraZoom.toFixed(1)}x</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border text-muted-foreground">
                <span className="flex items-center gap-2"><Sun className="w-3 h-3" /> EXPOSURE</span>
                <span>{cameraExposure > 0 ? '+' : ''}{cameraExposure.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border text-muted-foreground">
                <span>BATTERY</span>
                <span className={data.battery < 20 ? 'text-destructive' : 'text-secondary'}>{Math.floor(data.battery)}%</span>
              </div>
            </div>
          </div>

          <div className="hud-panel p-3">
            <h3 className="text-xs font-display text-primary/70 mb-2">QUICK REFERENCE</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono text-muted-foreground/80">
              <div><span className="text-secondary">△</span> Forward</div>
              <div><span className="text-secondary">✕</span> Reverse</div>
              <div><span className="text-accent">◯</span> Start Rec</div>
              <div><span className="text-accent">□</span> Stop Rec</div>
              <div><span className="text-primary">L-Stick</span> Camera</div>
              <div><span className="text-primary">R-Stick</span> Steer</div>
              <div><span className="text-primary">↑↓</span> Zoom</div>
              <div><span className="text-primary">←→</span> Exposure</div>
              <div><span className="text-accent">L1</span> Snapshot</div>
              <div><span className="text-accent">L2</span> Horn</div>
              <div><span className="text-accent">Share</span> Lights</div>
              <div><span className="text-destructive">Options</span> E-STOP</div>
              <div className="col-span-2 mt-1 pt-1 border-t border-border/50">
                <span className="text-destructive">PS</span> Exit to Dashboard
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoCameraFeed({ zoom, exposure, isRecording, recordingTime, pan, tilt }: {
  zoom: number;
  exposure: number;
  isRecording: boolean;
  recordingTime: number;
  pan: number;
  tilt: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.fillStyle = `hsl(30, 60%, ${15 + exposure * 5}%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizonY = canvas.height * 0.45 + tilt * 2;
      
      ctx.fillStyle = `hsl(25, 50%, ${25 + exposure * 8}%)`;
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, `hsl(220, 30%, ${10 + exposure * 5}%)`);
      skyGrad.addColorStop(1, `hsl(30, 40%, ${20 + exposure * 8}%)`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, horizonY);

      const centerX = canvas.width / 2 - pan * 3;
      
      for (let i = 0; i < 15; i++) {
        const rockX = ((centerX + i * 120 + t * 10) % (canvas.width + 200)) - 100;
        const rockY = horizonY + 20 + Math.sin(i * 2.3) * 50 + (i % 3) * 30;
        const rockSize = 20 + Math.sin(i * 1.7) * 15;
        
        ctx.fillStyle = `hsl(25, ${30 + i * 2}%, ${15 + exposure * 5}%)`;
        ctx.beginPath();
        ctx.ellipse(rockX, rockY, rockSize * zoom * 0.3, rockSize * 0.4 * zoom * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < 8; i++) {
        const boulderX = ((centerX + i * 180 + 50) % canvas.width);
        const boulderY = horizonY + 80 + i * 20;
        const size = (30 + i * 5) * zoom * 0.5;
        
        ctx.fillStyle = `hsl(20, 25%, ${12 + exposure * 4}%)`;
        ctx.beginPath();
        ctx.moveTo(boulderX, boulderY - size);
        ctx.lineTo(boulderX + size, boulderY + size * 0.5);
        ctx.lineTo(boulderX - size, boulderY + size * 0.5);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(0, 255, 200, ${0.3 + Math.sin(t * 2) * 0.1})`;
      ctx.lineWidth = 1;
      const crossSize = 40;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      ctx.beginPath();
      ctx.moveTo(cx - crossSize, cy);
      ctx.lineTo(cx - 10, cy);
      ctx.moveTo(cx + 10, cy);
      ctx.lineTo(cx + crossSize, cy);
      ctx.moveTo(cx, cy - crossSize);
      ctx.lineTo(cx, cy - 10);
      ctx.moveTo(cx, cy + 10);
      ctx.lineTo(cx, cy + crossSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [zoom, exposure, pan, tilt]);

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      className="w-full h-full object-cover"
      style={{ imageRendering: 'auto' }}
    />
  );
}

function LiveCameraFeed({ zoom, pan, tilt }: {
  zoom: number;
  pan: number;
  tilt: number;
}) {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
      <div 
        className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center transition-transform duration-100"
        style={{ 
          transform: `scale(${zoom}) translate(${-pan * 0.5}px, ${tilt * 0.5}px)`,
          transformOrigin: 'center center'
        }}
      >
        <div className="text-center">
          <div className="text-primary font-mono text-sm mb-2">LIVE CAMERA FEED</div>
          <div className="text-muted-foreground font-mono text-xs">Connected to Rover</div>
          <div className="mt-4 w-32 h-32 border-2 border-primary/50 rounded-full mx-auto flex items-center justify-center">
            <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
          </div>
          <div className="mt-4 text-xs font-mono text-muted-foreground">
            <div>CAM: HUSKY_LENS_AI_01</div>
            <div>RES: 1080p 60FPS</div>
          </div>
        </div>
      </div>
      
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
          <div className="w-[120px] h-[120px] border border-primary/40 rounded-full">
            <div className="w-1 h-3 bg-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60px]"></div>
            <div className="w-1 h-3 bg-primary absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[48px]"></div>
            <div className="w-3 h-1 bg-primary absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-[60px]"></div>
            <div className="w-3 h-1 bg-primary absolute top-1/2 left-1/2 -translate-y-1/2 translate-x-[48px]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
