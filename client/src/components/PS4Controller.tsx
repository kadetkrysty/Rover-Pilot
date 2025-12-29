import { useGamepad, GamepadInput } from '@/hooks/useGamepad';
import { motion } from 'framer-motion';
import { AlertCircle, Zap } from 'lucide-react';

interface PS4ControllerProps {
  onInput?: (input: GamepadInput) => void;
  className?: string;
}

export default function PS4Controller({ onInput, className }: PS4ControllerProps) {
  const gamepadInput = useGamepad();

  // Call parent callback when input changes
  if (onInput && gamepadInput.isConnected) {
    onInput(gamepadInput);
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Connection Status */}
      <div className="hud-panel p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {gamepadInput.isConnected ? (
              <>
                <div className="w-3 h-3 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_var(--secondary)]"></div>
                <span className="font-mono text-xs text-secondary">PS4 CONNECTED</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
                <span className="font-mono text-xs text-destructive/70">NO CONTROLLER</span>
              </>
            )}
          </div>
          {gamepadInput.isConnected && (
            <span className="font-mono text-[10px] text-muted-foreground">Index: {gamepadInput.gamepadIndex}</span>
          )}
        </div>
      </div>

      {gamepadInput.isConnected ? (
        <div className="hud-panel p-4 space-y-4">
          {/* Controller Mapping Legend */}
          <div>
            <h3 className="text-xs font-display text-primary/70 uppercase tracking-wider mb-3">BUTTON MAPPING</h3>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {/* Sticks */}
              <div className="border border-border/50 p-2 rounded">
                <div className="text-primary font-bold mb-1">LEFT STICK</div>
                <div className="text-muted-foreground">
                  <div>X: {gamepadInput.leftStickX.toFixed(2)}</div>
                  <div>Y: {gamepadInput.leftStickY.toFixed(2)}</div>
                  <div className="text-[9px]">→ STEERING</div>
                </div>
              </div>

              <div className="border border-border/50 p-2 rounded">
                <div className="text-primary font-bold mb-1">RIGHT STICK</div>
                <div className="text-muted-foreground">
                  <div>X: {gamepadInput.rightStickX.toFixed(2)}</div>
                  <div>Y: {gamepadInput.rightStickY.toFixed(2)}</div>
                  <div className="text-[9px]">→ CAMERA</div>
                </div>
              </div>

              {/* Triggers */}
              <div className="border border-border/50 p-2 rounded">
                <div className="text-primary font-bold mb-1">L2 TRIGGER</div>
                <div className="text-muted-foreground">
                  <div>{(gamepadInput.l2 * 100).toFixed(0)}%</div>
                  <div className="text-[9px]">← REVERSE</div>
                </div>
              </div>

              <div className="border border-border/50 p-2 rounded">
                <div className="text-primary font-bold mb-1">R2 TRIGGER</div>
                <div className="text-muted-foreground">
                  <div>{(gamepadInput.r2 * 100).toFixed(0)}%</div>
                  <div className="text-[9px]">→ FORWARD</div>
                </div>
              </div>

              {/* Shoulder Buttons */}
              <div className={`border p-2 rounded transition-all ${gamepadInput.l1 ? 'border-secondary bg-secondary/10' : 'border-border/50'}`}>
                <div className="text-secondary font-bold text-xs">L1</div>
                <div className="text-[9px] text-muted-foreground">STRAFE LEFT</div>
              </div>

              <div className={`border p-2 rounded transition-all ${gamepadInput.r1 ? 'border-secondary bg-secondary/10' : 'border-border/50'}`}>
                <div className="text-secondary font-bold text-xs">R1</div>
                <div className="text-[9px] text-muted-foreground">STRAFE RIGHT</div>
              </div>

              {/* Action Buttons */}
              <div className={`border p-2 rounded transition-all ${gamepadInput.triangle ? 'border-accent bg-accent/10' : 'border-border/50'}`}>
                <div className="text-accent font-bold text-xs">△ TRIANGLE</div>
                <div className="text-[9px] text-muted-foreground">LIGHTS</div>
              </div>

              <div className={`border p-2 rounded transition-all ${gamepadInput.circle ? 'border-destructive bg-destructive/10' : 'border-border/50'}`}>
                <div className="text-destructive font-bold text-xs">◯ CIRCLE</div>
                <div className="text-[9px] text-muted-foreground">NAV MODE</div>
              </div>

              <div className={`border p-2 rounded transition-all ${gamepadInput.x ? 'border-secondary bg-secondary/10' : 'border-border/50'}`}>
                <div className="text-secondary font-bold text-xs">✕ CROSS</div>
                <div className="text-[9px] text-muted-foreground">STOP</div>
              </div>

              <div className={`border p-2 rounded transition-all ${gamepadInput.square ? 'border-primary bg-primary/10' : 'border-border/50'}`}>
                <div className="text-primary font-bold text-xs">□ SQUARE</div>
                <div className="text-[9px] text-muted-foreground">RECORD</div>
              </div>

              {/* D-Pad */}
              <div className="border border-border/50 p-2 rounded col-span-2">
                <div className="text-primary font-bold text-xs mb-1">D-PAD</div>
                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  <div className={gamepadInput.dPadLeft ? 'text-accent' : 'text-muted-foreground'}>◀ SENSOR</div>
                  <div className="text-center">
                    <div className={gamepadInput.dPadUp ? 'text-accent' : 'text-muted-foreground'}>▲</div>
                    <div className={gamepadInput.dPadDown ? 'text-accent' : 'text-muted-foreground'}>▼</div>
                  </div>
                  <div className={gamepadInput.dPadRight ? 'text-accent' : 'text-muted-foreground'}>SPEED ▶</div>
                </div>
              </div>

              {/* Special Buttons */}
              <div className={`border p-2 rounded transition-all ${gamepadInput.options ? 'border-primary bg-primary/10' : 'border-border/50'}`}>
                <div className="text-primary font-bold text-xs">OPTIONS</div>
                <div className="text-[9px] text-muted-foreground">MENU</div>
              </div>

              <div className={`border p-2 rounded transition-all ${gamepadInput.psButton ? 'border-destructive bg-destructive/20' : 'border-border/50'}`}>
                <div className="text-destructive font-bold text-xs">PS BTN</div>
                <div className="text-[9px] text-muted-foreground">E-STOP</div>
              </div>
            </div>
          </div>

          {/* Visual Stick Indicators */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Left Stick */}
            <div className="border border-border/50 rounded p-3 flex flex-col items-center gap-2">
              <div className="text-xs font-mono text-primary/70">LEFT STICK</div>
              <div className="relative w-20 h-20 bg-black/50 border border-primary/20 rounded-full">
                <motion.div
                  className="absolute w-3 h-3 bg-primary rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  animate={{
                    x: gamepadInput.leftStickX * 30,
                    y: gamepadInput.leftStickY * 30,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 50 }}
                />
              </div>
            </div>

            {/* Right Stick */}
            <div className="border border-border/50 rounded p-3 flex flex-col items-center gap-2">
              <div className="text-xs font-mono text-primary/70">RIGHT STICK</div>
              <div className="relative w-20 h-20 bg-black/50 border border-primary/20 rounded-full">
                <motion.div
                  className="absolute w-3 h-3 bg-secondary rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  animate={{
                    x: gamepadInput.rightStickX * 30,
                    y: gamepadInput.rightStickY * 30,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 50 }}
                />
              </div>
            </div>
          </div>

          {/* Trigger Bars */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-mono text-primary/70 mb-1">L2</div>
              <div className="w-full h-3 bg-black/50 border border-border/50 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-secondary to-secondary transition-all"
                  style={{ width: `${gamepadInput.l2 * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-mono text-primary/70 mb-1">R2</div>
              <div className="w-full h-3 bg-black/50 border border-border/50 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-secondary to-secondary transition-all"
                  style={{ width: `${gamepadInput.r2 * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hud-panel p-8 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
          <div>
            <div className="text-sm font-display text-muted-foreground/70">PS4 Controller Not Detected</div>
            <div className="text-xs text-muted-foreground/50 mt-2 font-mono">
              Connect a DualShock 4 / PS4 controller to your device
            </div>
            <div className="text-xs text-muted-foreground/50 font-mono mt-1">
              Most tablets support Bluetooth controllers
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
