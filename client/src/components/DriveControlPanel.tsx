import { AlertTriangle, Radio, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDriveControl } from "@/lib/DriveControlProvider";
import { isFlyskyArmReady } from "@/lib/driveMapping";

const sources = [
  { value: "joystick", label: "On-screen joystick" },
  { value: "gamepad", label: "Standard gamepad" },
  { value: "flysky", label: "FlySky receiver" },
] as const;

export default function DriveControlPanel() {
  const { status, source, busy, error, demo, gamepadConnected, gamepadStandard, gamepadReady, joystickReady, selectSource, arm, stop, emergencyStop, resetEmergencyStop } = useDriveControl();
  const selected = status.source ?? source;
  const flyskyReady = isFlyskyArmReady(status.receiver);
  const canArm = !demo && status.available && status.commissioned && status.serialConnected && status.firmwareReady && status.canDrive && !status.estop && !status.armed &&
    (selected === "joystick" ? joystickReady : selected === "gamepad" ? gamepadReady : selected === "flysky" ? flyskyReady : false);

  return (
    <section className="hud-panel mx-2 mt-2 p-3 sm:mx-3 sm:mt-3 sm:p-4" aria-label="Safe rover drive controls" data-testid="drive-control-panel">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-bold tracking-wider text-primary">DRIVE AUTHORITY</h2>
            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-mono ${status.armed ? "border-destructive/60 bg-destructive/10 text-destructive" : status.estop ? "border-destructive/60 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/5 text-muted-foreground"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.armed ? "bg-destructive animate-pulse" : status.estop ? "bg-destructive" : "bg-muted-foreground"}`} />
              {status.estop ? "E-STOP LATCHED" : status.armed ? "ARMED" : "DISARMED"}
            </span>
            {status.owned && <span className="rounded border border-secondary/40 bg-secondary/10 px-2 py-1 text-[10px] font-mono text-secondary">THIS CLIENT OWNS LEASE</span>}
            {demo && <span className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-mono text-accent">DEMO · PREVIEW ONLY</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Selection never arms. Arm explicitly while neutral; release or loss of focus disarms.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(190px,1fr)_auto]">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Drive source
              <select
                value={selected ?? ""}
                onChange={(event) => void selectSource(event.target.value as "joystick" | "gamepad" | "flysky")}
                className="mt-1 block h-10 w-full rounded border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Select rover drive source"
              >
                {!selected && <option value="" disabled>Select source</option>}
                {sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <Button onClick={() => void arm()} disabled={busy || !canArm} className="h-10 min-w-24 font-mono text-xs" aria-label="Arm rover drive">
                <Shield className="mr-1.5 h-4 w-4" /> ARM
              </Button>
              <Button onClick={() => void stop()} disabled={demo} variant="outline" className="h-10 min-w-24 border-border font-mono text-xs">DISARM</Button>
              <Button onClick={() => void emergencyStop()} disabled={demo} variant="destructive" className="h-10 min-w-24 font-mono text-xs" aria-label="Latch emergency stop">
                <ShieldAlert className="mr-1.5 h-4 w-4" /> E-STOP
              </Button>
              {status.estop && status.canReset && !demo && (
                <Button onClick={() => void resetEmergencyStop()} disabled={busy} variant="outline" className="h-10 border-destructive/50 font-mono text-xs">OWNER RESET</Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[38%] xl:max-w-[430px]">
          <div className="rounded border border-border/70 bg-background/40 p-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-primary/80"><Radio className="h-3.5 w-3.5" /> Source readiness</div>
            <div className="mt-1 text-xs text-foreground">
                {selected === "gamepad" ? (gamepadReady ? "Standard mapping · centered · R1 released" : !gamepadConnected ? "No standard gamepad connected" : !gamepadStandard ? "Controller mapping is not standard; driving is disabled" : "Center sticks and release R1 to arm") :
                selected === "flysky" ? (flyskyReady ? "Receiver fresh · CH1 / CH3 centered · CH5 high" : "Connect receiver; center CH1 / CH3, hold CH5 high, clear failsafe") :
                  selected === "joystick" ? (joystickReady ? "Centered; ready for explicit arm" : "Release and center the joystick before arming") : "Choose a drive source"}
            </div>
          </div>
          <div className="rounded border border-border/70 bg-background/40 p-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-primary/80"><AlertTriangle className="h-3.5 w-3.5" /> MPU6050 · relative attitude</div>
            {status.imu?.valid ? (
              <>
                <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-xs">
                  <span>YAW {status.imu.yaw.toFixed(1)}°</span><span>PITCH {status.imu.pitch.toFixed(1)}°</span><span>ROLL {status.imu.roll.toFixed(1)}°</span>
                </div>
                {status.imu.ageMs > 500 && <p className="mt-1 text-[10px] text-accent">IMU data is stale ({Math.round(status.imu.ageMs)} ms old).</p>}
              </>
            ) : <p className="mt-1 text-xs text-muted-foreground">Relative yaw / pitch / roll unavailable or invalid.</p>}
          </div>
        </div>
      </div>
      {(!status.available || !status.commissioned || !status.canDrive) && (
        <p className="mt-3 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent" role="status">
          {demo ? status.reason : status.reason || (!status.canDrive ? "This paired client does not currently have owner/operator drive permission." : "The rover drive service is unavailable.")}
          {!demo && !status.commissioned && " Hardware commissioning is required before arming."}
        </p>
      )}
      {status.estop && !status.canReset && !demo && (
        <p className="mt-2 text-xs text-destructive" role="status">Emergency stop is latched. Only the owner client can reset it.</p>
      )}
      {error && <p className="mt-2 rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
    </section>
  );
}
