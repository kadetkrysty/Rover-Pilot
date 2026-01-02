import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, AlertTriangle } from 'lucide-react';
import PS4Controller from '@/components/PS4Controller';
import { useRoverData } from '@/lib/mockData';
import { GamepadInput } from '@/hooks/useGamepad';

export default function GamepadControl() {
  const data = useRoverData();
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [mode, setMode] = useState<'MANUAL' | 'AUTONOMOUS'>('MANUAL');
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [lightsEnabled, setLightsEnabled] = useState(false);

  const handleGamepadInput = (input: GamepadInput) => {
    if (input.psButton) {
      setEmergencyStop(true);
      setThrottle(0);
      setSteering(0);
      return;
    } else {
      setEmergencyStop(false);
    }

    const throttleValue = (input.r2 - input.l2) * 100;
    setThrottle(throttleValue);
    setSteering(input.leftStickX * 100);
    setCameraX(input.rightStickX * 100);
    setCameraY(input.rightStickY * 100);

    if (input.circle) {
      setMode(mode === 'MANUAL' ? 'AUTONOMOUS' : 'MANUAL');
    }

    if (input.x) {
      setThrottle(0);
      setSteering(0);
    }

    if (input.triangle) {
      setLightsEnabled(!lightsEnabled);
    }

    if (input.dPadUp) {
      setSpeedMultiplier(Math.min(1.5, speedMultiplier + 0.1));
    }
    if (input.dPadDown) {
      setSpeedMultiplier(Math.max(0.5, speedMultiplier - 0.1));
    }

    if (input.square) {
      console.log('Recording started...');
    }

    if (input.l1) {
      console.log('Strafe left');
    }
    if (input.r1) {
      console.log('Strafe right');
    }

    if (input.dPadLeft) {
      console.log('Sensor mode changed');
    }
    if (input.dPadRight) {
      console.log('Speed mode');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-gamepad-control">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">GAMEPAD CONTROL</h1>
        <p className="text-muted-foreground font-mono mt-1">PS4 DualShock 4 Controller Integration</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Controller Input Visualization */}
        <div className="col-span-8">
          <PS4Controller onInput={handleGamepadInput} />
        </div>

        {/* Status & Controls */}
        <div className="col-span-4 space-y-4">
          {/* Emergency Status */}
          {emergencyStop && (
            <div className="hud-panel p-4 border-2 border-destructive bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                <span className="font-bold text-sm">EMERGENCY STOP ACTIVE</span>
              </div>
            </div>
          )}

          {/* Mode Indicator */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">ROVER MODE</h3>
            <div className={`p-3 rounded border-2 text-center font-display text-lg font-bold transition-all ${
              mode === 'MANUAL'
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-accent bg-accent/10 text-accent'
            }`}>
              {mode}
            </div>
          </div>

          {/* Throttle & Steering */}
          <div className="hud-panel p-4 space-y-3">
            <h3 className="text-xs font-display text-primary/70">MOTION CONTROL</h3>
            
            <div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                <span>THROTTLE</span>
                <span className={throttle > 0 ? 'text-secondary' : throttle < 0 ? 'text-destructive' : ''}>{throttle.toFixed(0)}</span>
              </div>
              <div className="h-3 bg-black/50 border border-border rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    throttle > 0
                      ? 'bg-gradient-to-r from-secondary to-secondary'
                      : 'bg-gradient-to-r from-destructive to-destructive'
                  }`}
                  style={{ width: `${50 + (throttle / 2)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                <span>STEERING</span>
                <span className="text-primary">{steering.toFixed(0)}</span>
              </div>
              <div className="h-3 bg-black/50 border border-border rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary transition-all"
                  style={{ width: `${50 + (steering / 2)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Camera Control */}
          <div className="hud-panel p-4 space-y-3">
            <h3 className="text-xs font-display text-primary/70">CAMERA GIMBAL</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <div className="text-muted-foreground">PAN</div>
                <div className="text-foreground">{cameraX.toFixed(0)}°</div>
              </div>
              <div>
                <div className="text-muted-foreground">TILT</div>
                <div className="text-foreground">{cameraY.toFixed(0)}°</div>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">SYSTEMS</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className={`flex justify-between p-2 rounded border ${lightsEnabled ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}>
                <span>LIGHTS</span>
                <span>{lightsEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex justify-between p-2 rounded border border-border text-muted-foreground">
                <span>SPEED</span>
                <span>{speedMultiplier.toFixed(1)}x</span>
              </div>
              <div className="flex justify-between p-2 rounded border border-border text-muted-foreground">
                <span>BATTERY</span>
                <span className={data.battery < 20 ? 'text-destructive' : 'text-secondary'}>{Math.floor(data.battery)}%</span>
              </div>
            </div>
          </div>

          {/* Button Reference Card */}
          <div className="hud-panel p-3">
            <h3 className="text-xs font-display text-primary/70 mb-2">QUICK REFERENCE</h3>
            <div className="space-y-1 text-[9px] font-mono text-muted-foreground/80">
              <div className="text-primary">L2/R2: Throttle</div>
              <div className="text-primary">Left Stick: Steer</div>
              <div className="text-accent">△: Lights</div>
              <div className="text-accent">◯: Toggle Mode</div>
              <div className="text-accent">✕: Stop</div>
              <div className="text-accent">□: Record</div>
              <div className="text-destructive">PS: E-STOP</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
