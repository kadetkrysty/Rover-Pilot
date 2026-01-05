import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wifi, WifiOff, AlertTriangle, Radio } from 'lucide-react';
import { useFlySky, FlySkyInput } from '@/hooks/useFlySky';
import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function FlySkyControl() {
  const flySky = useFlySky();
  const data = useRoverData();
  const location = useLocation();
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [mode, setMode] = useState<'MANUAL' | 'AUTONOMOUS'>('MANUAL');

  useEffect(() => {
    if (flySky.isConnected) {
      setThrottle(flySky.throttle * 100);
      setSteering(flySky.steering * 100);
      if (flySky.switchB) {
        setMode('AUTONOMOUS');
      } else {
        setMode('MANUAL');
      }
    }
  }, [flySky]);

  const getSignalColor = (strength: number) => {
    if (strength > 75) return 'text-secondary';
    if (strength > 50) return 'text-accent';
    if (strength > 25) return 'text-accent/50';
    return 'text-destructive';
  };

  const getSignalBars = (strength: number) => {
    if (strength === 0) return 0;
    if (strength < 25) return 1;
    if (strength < 50) return 2;
    if (strength < 75) return 3;
    return 4;
  };

  const ChannelDisplay = ({ ch, label, value, color }: { ch: number; label: string; value: number; color: string }) => (
    <div className="hud-panel p-3">
      <div className="text-xs font-display text-primary/70 uppercase mb-2">CH{ch} - {label}</div>
      <div className={`text-xl font-mono font-bold ${color}`}>{value.toFixed(0)}µs</div>
      <div className="w-full h-2 bg-black/50 border border-border rounded mt-2 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color.replace('text-', 'from-')} to-${color.replace('text-', '')} transition-all`}
          style={{ width: `${50 + (((value - 1500) / 500) * 50)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-flysky-control">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary" data-testid="text-flysky-title">FLYSKY RECEIVER CONTROL</h1>
        <p className="text-muted-foreground font-mono mt-1">FS-I6x / FS-IA10B 10-Channel Remote Control (iBUS)</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel: Channel Display */}
        <div className="col-span-8 space-y-4">
          {/* Connection Status */}
          <div className={`hud-panel p-4 border-2 transition-all ${
            flySky.isConnected 
              ? 'border-secondary/50 bg-secondary/5' 
              : 'border-destructive/50 bg-destructive/5'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {flySky.isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-secondary animate-pulse" />
                    <span className="font-bold text-secondary">FS-I6x CONNECTED</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-destructive" />
                    <span className="font-bold text-destructive">NO RECEIVER DETECTED</span>
                  </>
                )}
              </div>
              
              {flySky.isConnected && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-1 h-3 rounded-sm transition-all ${
                          i < getSignalBars(flySky.signalStrength)
                            ? `bg-secondary`
                            : `bg-border/30`
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-mono ${getSignalColor(flySky.signalStrength)}`}>
                    {Math.round(flySky.signalStrength)}%
                  </span>
                </div>
              )}
            </div>

            {flySky.failsafeActive && (
              <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                FAILSAFE ACTIVE - Signal lost for more than 1 second
              </div>
            )}
          </div>

          {/* Camera Feed with HUD Overlay */}
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed 
                className="h-full" 
                showCameraControl={true} 
                latitude={location.latitude ?? 34.0522} 
                longitude={location.longitude ?? -118.2437} 
              />
            </AspectRatio>
          </div>


          {/* No Connection Message */}
          {!flySky.isConnected && (
            <div className="hud-panel p-8 text-center">
              <Radio className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <div className="text-muted-foreground/70">
                <div className="text-lg font-display mb-2">FlySky Receiver Not Detected</div>
                <div className="text-sm font-mono">
                  Check iBUS wiring to Arduino Pin 19 and ensure rover controller is running
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Status & Info */}
        <div className="col-span-4 space-y-4">
          {/* Mode & Battery */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">SYSTEM STATUS</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">MODE</div>
                <div className={`text-lg font-bold font-mono px-3 py-2 rounded text-center ${
                  mode === 'MANUAL'
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-accent/10 text-accent'
                }`}>
                  {mode}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">THROTTLE</div>
                <div className="text-2xl font-mono font-bold text-secondary">{throttle.toFixed(0)}%</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">STEERING</div>
                <div className="text-2xl font-mono font-bold text-primary">{steering.toFixed(0)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">BATTERY</div>
                <div className={`text-2xl font-mono font-bold ${
                  data.battery > 50 ? 'text-secondary' : data.battery > 20 ? 'text-accent' : 'text-destructive'
                }`}>
                  {Math.floor(data.battery)}%
                </div>
              </div>
            </div>
          </div>

          {/* Receiver Info */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">RECEIVER INFO</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transmitter</span>
                <span className="text-foreground font-bold">FlySky FS-I6x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receiver</span>
                <span className="text-foreground font-bold">FS-IA10B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protocol</span>
                <span className="text-foreground font-bold text-green-400">iBUS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channels</span>
                <span className="text-foreground font-bold">10 CH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Update Rate</span>
                <span className="text-foreground font-bold">~143Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection</span>
                <span className="text-foreground font-bold">Arduino Pin 19</span>
              </div>
            </div>
          </div>

          {/* Control Mapping */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">CHANNEL MAPPING</h3>
            <div className="space-y-1 text-[10px] font-mono text-muted-foreground/80">
              <div>CH1 → Steering (Roll)</div>
              <div>CH2 → Forward/Back (Pitch)</div>
              <div>CH3 → Throttle</div>
              <div>CH4 → Yaw Rotation</div>
              <div>CH5 → Switch A (Record Toggle)</div>
              <div>CH6 → Switch B (Mode Select)</div>
              <div>CH7 → Aux 1 (Camera Pan)</div>
              <div>CH8 → Aux 2 (Camera Tilt)</div>
              <div>CH9 → Aux 3 (Light Control)</div>
              <div>CH10 → Aux 4 (Horn)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
