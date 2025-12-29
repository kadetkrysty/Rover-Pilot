import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Wifi, WifiOff, AlertTriangle, Radio } from 'lucide-react';
import { useFlyBaby, FlyBabyInput } from '@/hooks/useFlyBaby';
import { useRoverData } from '@/lib/mockData';

export default function FlyBabyControl() {
  const flyBaby = useFlyBaby();
  const data = useRoverData();
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [mode, setMode] = useState<'MANUAL' | 'AUTONOMOUS'>('MANUAL');

  useEffect(() => {
    if (flyBaby.isConnected) {
      setThrottle(flyBaby.throttle * 100);
      setSteering(flyBaby.steering * 100);
      if (flyBaby.switchB) {
        setMode('AUTONOMOUS');
      } else {
        setMode('MANUAL');
      }
    }
  }, [flyBaby]);

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">FLYBABY RECEIVER CONTROL</h1>
          <p className="text-muted-foreground font-mono mt-1">FS-I6x / FS-IA10B Manual & Autonomous Control</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="font-mono">
            <ArrowLeft className="w-4 h-4 mr-2" /> RETURN
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel: Channel Display */}
        <div className="col-span-8 space-y-4">
          {/* Connection Status */}
          <div className={`hud-panel p-4 border-2 transition-all ${
            flyBaby.isConnected 
              ? 'border-secondary/50 bg-secondary/5' 
              : 'border-destructive/50 bg-destructive/5'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {flyBaby.isConnected ? (
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
              
              {flyBaby.isConnected && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-1 h-3 rounded-sm transition-all ${
                          i < getSignalBars(flyBaby.signalStrength)
                            ? `bg-secondary`
                            : `bg-border/30`
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-mono ${getSignalColor(flyBaby.signalStrength)}`}>
                    {Math.round(flyBaby.signalStrength)}%
                  </span>
                </div>
              )}
            </div>

            {flyBaby.failsafeActive && (
              <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                FAILSAFE ACTIVE - Signal lost for more than 1 second
              </div>
            )}
          </div>

          {/* Channel Display Grid */}
          {flyBaby.isConnected && (
            <div className="grid grid-cols-2 gap-3">
              {/* Channel 1 - Roll/Aileron */}
              <div className="hud-panel p-3">
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH1 - Roll</div>
                <div className="text-xl font-mono font-bold text-foreground">{flyBaby.channel1.toFixed(0)}µs</div>
                <div className="text-xs text-muted-foreground/70 mt-1">Steering: {flyBaby.steering.toFixed(2)}</div>
                <div className="w-full h-2 bg-black/50 border border-border rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary transition-all"
                    style={{ width: `${50 + (flyBaby.steering * 50)}%` }}
                  />
                </div>
              </div>

              {/* Channel 2 - Pitch/Elevator */}
              <div className="hud-panel p-3">
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH2 - Pitch</div>
                <div className="text-xl font-mono font-bold text-foreground">{flyBaby.channel2.toFixed(0)}µs</div>
                <div className="text-xs text-muted-foreground/70 mt-1">Pitch: {flyBaby.pitch.toFixed(2)}</div>
                <div className="w-full h-2 bg-black/50 border border-border rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary to-secondary transition-all"
                    style={{ width: `${50 + (flyBaby.pitch * 50)}%` }}
                  />
                </div>
              </div>

              {/* Channel 3 - Throttle */}
              <div className="hud-panel p-3">
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH3 - Throttle</div>
                <div className="text-xl font-mono font-bold text-secondary">{flyBaby.channel3.toFixed(0)}µs</div>
                <div className="text-xs text-muted-foreground/70 mt-1">Power: {(flyBaby.throttle * 100).toFixed(0)}%</div>
                <div className="w-full h-2 bg-black/50 border border-border rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary to-secondary transition-all"
                    style={{ width: `${Math.max(0, flyBaby.throttle * 100)}%` }}
                  />
                </div>
              </div>

              {/* Channel 4 - Yaw/Rudder */}
              <div className="hud-panel p-3">
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH4 - Yaw</div>
                <div className="text-xl font-mono font-bold text-foreground">{flyBaby.channel4.toFixed(0)}µs</div>
                <div className="text-xs text-muted-foreground/70 mt-1">Yaw: {flyBaby.roll.toFixed(2)}</div>
                <div className="w-full h-2 bg-black/50 border border-border rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent transition-all"
                    style={{ width: `${50 + (flyBaby.roll * 50)}%` }}
                  />
                </div>
              </div>

              {/* Channel 5 - Switch A */}
              <div className={`hud-panel p-3 border-2 transition-all ${
                flyBaby.switchA ? 'border-secondary/50 bg-secondary/10' : 'border-border'
              }`}>
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH5 - Switch A</div>
                <div className="text-xl font-mono font-bold text-foreground">{flyBaby.channel5.toFixed(0)}µs</div>
                <div className={`text-sm font-bold mt-2 px-2 py-1 rounded text-center ${
                  flyBaby.switchA ? 'bg-secondary text-secondary-foreground' : 'bg-border/30 text-muted-foreground'
                }`}>
                  {flyBaby.switchA ? 'ON' : 'OFF'}
                </div>
              </div>

              {/* Channel 6 - Switch B */}
              <div className={`hud-panel p-3 border-2 transition-all ${
                flyBaby.switchB ? 'border-accent/50 bg-accent/10' : 'border-border'
              }`}>
                <div className="text-xs font-display text-primary/70 uppercase mb-2">CH6 - Switch B</div>
                <div className="text-xl font-mono font-bold text-foreground">{flyBaby.channel6.toFixed(0)}µs</div>
                <div className={`text-sm font-bold mt-2 px-2 py-1 rounded text-center ${
                  flyBaby.switchB ? 'bg-accent text-accent-foreground' : 'bg-border/30 text-muted-foreground'
                }`}>
                  {flyBaby.switchB ? 'ON' : 'OFF'}
                </div>
              </div>
            </div>
          )}

          {/* No Connection Message */}
          {!flyBaby.isConnected && (
            <div className="hud-panel p-8 text-center">
              <Radio className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <div className="text-muted-foreground/70">
                <div className="text-lg font-display mb-2">FlyBaby Receiver Not Detected</div>
                <div className="text-sm font-mono">
                  Check wiring and ensure Raspberry Pi is running the FlyBaby service
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
                <span className="text-muted-foreground">Model</span>
                <span className="text-foreground font-bold">FS-I6x 2.4GHz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receiver</span>
                <span className="text-foreground font-bold">FS-IA10B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channels</span>
                <span className="text-foreground font-bold">6CH PWM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Update Rate</span>
                <span className="text-foreground font-bold">50Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signal Range</span>
                <span className="text-foreground font-bold">1000-2000µs</span>
              </div>
            </div>
          </div>

          {/* Control Mapping */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">CHANNEL MAPPING</h3>
            <div className="space-y-1 text-[10px] font-mono text-muted-foreground/80">
              <div>CH1 → Steering</div>
              <div>CH2 → Pitch Control</div>
              <div>CH3 → Forward/Reverse</div>
              <div>CH4 → Rotation Yaw</div>
              <div>CH5 → Record Toggle</div>
              <div>CH6 → Mode Select</div>
            </div>
          </div>

          {/* Status Indicator */}
          {flyBaby.isConnected && (
            <Card className="hud-panel p-4 border-secondary/30 bg-secondary/5">
              <div className="text-center">
                <div className="text-sm font-bold text-secondary mb-1">Ready to Drive</div>
                <div className="text-xs text-muted-foreground">All channels responding</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
