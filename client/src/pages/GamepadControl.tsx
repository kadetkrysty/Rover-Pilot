import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Camera, Video, Volume2, Lightbulb, ZoomIn, ZoomOut, Sun, HelpCircle, X } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';
import { GamepadInput, useGamepad } from '@/hooks/useGamepad';
import { useWebSocket } from '@/lib/useWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function GamepadControl() {
  const [, setLocation] = useLocation();
  const data = useRoverData();
  const gamepadInput = useGamepad();
  const { sendCommand, isConnected: wsConnected } = useWebSocket();
  
  const [throttle, setThrottle] = useState(0);
  const [direction, setDirection] = useState<'FORWARD' | 'REVERSE' | 'NEUTRAL'>('NEUTRAL');
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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [useDeviceCamera, setUseDeviceCamera] = useState(false);
  
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
      // Triangle = Select Forward direction, X = Select Reverse direction
      if (isButtonJustPressed(gamepadInput.triangle, prev?.triangle)) {
        setDirection('FORWARD');
        setMode('MANUAL');
        toast.info('Direction: FORWARD');
      }
      if (isButtonJustPressed(gamepadInput.x, prev?.x)) {
        setDirection('REVERSE');
        setMode('MANUAL');
        toast.info('Direction: REVERSE');
      }

      // R2 = Throttle amount (0-100%), direction determines actual movement
      const throttleAmount = gamepadInput.r2 * 100;
      setThrottle(throttleAmount > 5 ? throttleAmount : 0);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-2 h-7 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center"
              data-testid="button-help"
            >
              <HelpCircle className="w-4 h-4 text-primary" />
            </button>
            <div className={`px-3 h-7 rounded font-mono text-xs flex items-center ${gamepadInput.isConnected ? 'bg-secondary/20 text-secondary border border-secondary/50' : 'bg-destructive/20 text-destructive border border-destructive/50'}`}>
              {gamepadInput.isConnected ? 'CONTROLLER CONNECTED' : 'NO CONTROLLER'}
            </div>
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
              {useDeviceCamera ? (
                <DeviceCameraFeed 
                  zoom={cameraZoom}
                  pan={cameraPan}
                  tilt={cameraTilt}
                  isRecording={isRecording}
                />
              ) : (
                <DemoCameraFeed 
                  zoom={cameraZoom} 
                  exposure={cameraExposure}
                  isRecording={isRecording}
                  recordingTime={recordingTime}
                  pan={cameraPan}
                  tilt={cameraTilt}
                />
              )}
              
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  onClick={() => setUseDeviceCamera(false)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${!useDeviceCamera ? 'bg-accent text-black' : 'bg-black/50 text-muted-foreground hover:bg-black/70'}`}
                >
                  SIMULATED
                </button>
                <button
                  onClick={() => setUseDeviceCamera(true)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${useDeviceCamera ? 'bg-accent text-black' : 'bg-black/50 text-muted-foreground hover:bg-black/70'}`}
                >
                  DEVICE CAM
                </button>
              </div>
              
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
                <span>DIRECTION</span>
                <span className={
                  direction === 'FORWARD' ? 'text-secondary' : 
                  direction === 'REVERSE' ? 'text-destructive' : 'text-muted-foreground'
                }>
                  {direction}
                </span>
              </div>
              <div className="flex gap-1">
                <div className={`flex-1 h-6 rounded flex items-center justify-center text-xs font-mono transition-all ${
                  direction === 'REVERSE' ? 'bg-destructive/20 border border-destructive text-destructive' : 'bg-black/30 border border-border text-muted-foreground/50'
                }`}>
                  ← REV
                </div>
                <div className={`flex-1 h-6 rounded flex items-center justify-center text-xs font-mono transition-all ${
                  direction === 'FORWARD' ? 'bg-secondary/20 border border-secondary text-secondary' : 'bg-black/30 border border-border text-muted-foreground/50'
                }`}>
                  FWD →
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                <span>THROTTLE</span>
                <span className={throttle > 0 ? (direction === 'FORWARD' ? 'text-secondary' : 'text-destructive') : ''}>{throttle.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-black/50 border border-border rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${direction === 'FORWARD' ? 'bg-secondary' : direction === 'REVERSE' ? 'bg-destructive' : 'bg-muted-foreground'}`}
                  style={{ width: `${throttle}%` }}
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

        </div>
      </div>

      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="hud-panel p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display text-primary font-bold">QUICK REFERENCE</h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 rounded hover:bg-primary/20 transition-colors"
                  data-testid="button-close-help"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-display text-primary/70 mb-2">MOVEMENT</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-secondary">△ Triangle</span>
                      <span className="text-muted-foreground">Forward</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-destructive">✕ Cross</span>
                      <span className="text-muted-foreground">Reverse</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-secondary">R2</span>
                      <span className="text-muted-foreground">Throttle</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-primary">R-Stick</span>
                      <span className="text-muted-foreground">Steering</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-display text-primary/70 mb-2">CAMERA</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-primary">L-Stick</span>
                      <span className="text-muted-foreground">Pan/Tilt</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-primary">↑↓ D-Pad</span>
                      <span className="text-muted-foreground">Zoom</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-primary">←→ D-Pad</span>
                      <span className="text-muted-foreground">Exposure</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-accent">L1</span>
                      <span className="text-muted-foreground">Snapshot</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-display text-primary/70 mb-2">RECORDING & CONTROLS</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-accent">◯ Circle</span>
                      <span className="text-muted-foreground">Start Rec</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-accent">□ Square</span>
                      <span className="text-muted-foreground">Stop Rec</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-accent">Share</span>
                      <span className="text-muted-foreground">Lights</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-accent">L2</span>
                      <span className="text-muted-foreground">Horn</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-display text-destructive/70 mb-2">SYSTEM</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-destructive/10 border border-destructive/30 rounded flex justify-between">
                      <span className="text-destructive">Options</span>
                      <span className="text-destructive">E-STOP</span>
                    </div>
                    <div className="p-2 bg-black/30 rounded flex justify-between">
                      <span className="text-muted-foreground">PS</span>
                      <span className="text-muted-foreground">Exit</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

function DeviceCameraFeed({ zoom, pan, tilt, isRecording }: {
  zoom: number;
  pan: number;
  tilt: number;
  isRecording: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'active' | 'denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => {
              setCameraStatus('active');
            }).catch((err) => {
              console.error('Video play error:', err);
              setCameraStatus('error');
              setErrorMessage('Failed to play video stream.');
            });
          };
          
          videoRef.current.onerror = () => {
            setCameraStatus('error');
            setErrorMessage('Video stream error.');
          };
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setErrorMessage('Camera permission denied. Please allow camera access.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraStatus('error');
          setErrorMessage('No camera found on this device.');
        } else if (err.name === 'NotReadableError') {
          setCameraStatus('error');
          setErrorMessage('Camera is in use by another application. Close other tabs using camera.');
        } else {
          setCameraStatus('error');
          setErrorMessage(err.message || 'Failed to access camera.');
        }
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!streamRef.current || cameraStatus !== 'active') return;

    if (isRecording) {
      chunksRef.current = [];
      try {
        const mediaRecorder = new MediaRecorder(streamRef.current, {
          mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rover-recording-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };
        
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (err) {
        console.error('MediaRecorder error:', err);
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    }
  }, [isRecording, cameraStatus]);

  const requestPermission = async () => {
    setCameraStatus('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStatus('active');
      }
    } catch (err: any) {
      setCameraStatus('denied');
      setErrorMessage(err.message || 'Permission denied');
    }
  };

  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-transform duration-100 ${cameraStatus !== 'active' ? 'hidden' : ''}`}
        style={{ 
          transform: `scale(${zoom}) translate(${-pan * 0.5}px, ${tilt * 0.5}px)`,
          transformOrigin: 'center center'
        }}
      />

      {cameraStatus === 'loading' && (
        <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary font-mono text-sm">REQUESTING CAMERA ACCESS...</div>
          <div className="text-muted-foreground font-mono text-xs mt-2">Please allow camera and microphone permissions</div>
        </div>
      )}

      {(cameraStatus === 'denied' || cameraStatus === 'error') && (
        <div className="text-center p-4 absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-2 border-destructive/50 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Camera className="w-8 h-8 text-destructive/70" />
          </div>
          <div className="text-destructive font-mono text-sm mb-2">CAMERA UNAVAILABLE</div>
          <div className="text-muted-foreground font-mono text-xs mb-4 max-w-xs">{errorMessage}</div>
          <button
            onClick={requestPermission}
            className="px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary font-mono text-xs hover:bg-primary/30 transition-colors"
          >
            REQUEST PERMISSION
          </button>
        </div>
      )}
      
      {cameraStatus === 'active' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center opacity-40">
            <div className="w-[120px] h-[120px] border border-primary/40 rounded-full relative">
              <div className="w-1 h-3 bg-primary absolute top-0 left-1/2 -translate-x-1/2"></div>
              <div className="w-1 h-3 bg-primary absolute bottom-0 left-1/2 -translate-x-1/2"></div>
              <div className="w-3 h-1 bg-primary absolute top-1/2 left-0 -translate-y-1/2"></div>
              <div className="w-3 h-1 bg-primary absolute top-1/2 right-0 -translate-y-1/2"></div>
            </div>
          </div>
          <div className="absolute top-4 left-4 text-xs font-mono text-primary/70">
            <div>DEVICE CAMERA</div>
            <div>DEMO MODE ACTIVE</div>
          </div>
        </div>
      )}
    </div>
  );
}
