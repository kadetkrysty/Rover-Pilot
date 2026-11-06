import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { driveStatusSchema, type DriveAction, type DriveSource, type DriveStatus, unavailableDriveStatus } from "@shared/drive";
import { isDemoMode } from "@/lib/demoMode";
import { roverFetch } from "@/lib/roverConnection";
import { isFlyskyArmReady, readGamepadDriveSample } from "@/lib/driveMapping";
import { hasConfirmedDriveLease, shouldActivateAfterArm } from "@/lib/driveLifecycle";

interface DriveControlContextValue {
  status: DriveStatus;
  source: DriveSource | null;
  busy: boolean;
  error: string | null;
  demo: boolean;
  gamepadConnected: boolean;
  gamepadStandard: boolean;
  gamepadReady: boolean;
  joystickReady: boolean;
  selectSource: (source: DriveSource) => Promise<void>;
  arm: () => Promise<boolean>;
  stop: () => Promise<void>;
  emergencyStop: () => Promise<void>;
  resetEmergencyStop: () => Promise<void>;
  setJoystick: (x: number, y: number) => void;
  releaseJoystick: () => Promise<void>;
}

const DriveControlContext = createContext<DriveControlContextValue | null>(null);
const DEMO_REASON = "Preview only — real rover controls are disabled in Demo mode.";
const clamp = (n: number) => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));

export function DriveControlProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(() => isDemoMode());
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const [status, setStatus] = useState<DriveStatus>(() => unavailableDriveStatus(demo ? DEMO_REASON : "Checking rover control service…"));
  const [source, setSource] = useState<DriveSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadStandard, setGamepadStandard] = useState(false);
  const [gamepadReady, setGamepadReady] = useState(false);
  const [joystickReady, setJoystickReady] = useState(true);
  const statusRef = useRef(status);
  const sourceRef = useRef<DriveSource | null>(source);
  const inFlightRef = useRef(false);
  const pendingActionRef = useRef(0);
  const invalidatedRef = useRef(false);
  const controlEpochRef = useRef(0);
  const engagementActiveRef = useRef(false);
  const staleArmStopPendingRef = useRef(false);
  const sequenceRef = useRef(0);
  const joystickRef = useRef({ x: 0, y: 0 });
  const gamepadRef = useRef({ connected: false, standard: false, throttle: 0, steering: 0, deadman: false, neutralAndReleased: false });
  const gamepadWasDeadmanRef = useRef(false);
  const gamepadWasConnectedRef = useRef(false);
  statusRef.current = status;
  sourceRef.current = source;

  useEffect(() => {
    if (demo) return;
    const checkDemoMode = () => {
      if (!demoRef.current && isDemoMode()) {
        demoRef.current = true;
        setDemo(true);
      }
    };
    const timer = window.setInterval(checkDemoMode, 250);
    return () => window.clearInterval(timer);
  }, [demo]);

  const updateStatus = useCallback((next: DriveStatus) => {
    statusRef.current = next;
    setStatus(next);
    sourceRef.current = next.source;
    setSource(next.source);
  }, []);

  const invalidate = useCallback((message: string) => {
    invalidatedRef.current = true;
    controlEpochRef.current += 1;
    engagementActiveRef.current = false;
    setError(message);
    joystickRef.current = { x: 0, y: 0 };
    setJoystickReady(true);
  }, []);

  const requestStatus = useCallback(async () => {
    if (demo || demoRef.current || inFlightRef.current || pendingActionRef.current > 0) return;
    inFlightRef.current = true;
    try {
      const response = await roverFetch("/api/drive/status", { method: "GET", cache: "no-store" });
      const payload: unknown = await response.json();
      if (demoRef.current) return;
      if (!response.ok) throw new Error(readError(payload, `Rover status request failed (${response.status}).`));
      const parsed = driveStatusSchema.parse(payload);
      const activeAuthorityLost = engagementActiveRef.current &&
        (!parsed.available || !parsed.commissioned || !parsed.canDrive || !parsed.owned ||
          !parsed.lease || !parsed.armed || parsed.estop || parsed.source !== sourceRef.current);
      if (activeAuthorityLost) {
        engagementActiveRef.current = false;
        invalidatedRef.current = true;
        controlEpochRef.current += 1;
        joystickRef.current = { x: 0, y: 0 };
        setError("Drive authority or lease changed. The local driver is blocked; arm again explicitly.");
      }
      if (parsed.armed && parsed.owned && !engagementActiveRef.current && !staleArmStopPendingRef.current) {
        staleArmStopPendingRef.current = true;
        invalidatedRef.current = true;
        setError("A previously armed lease was found and is being disarmed before control resumes.");
      }
      updateStatus(parsed);
      if (!parsed.armed) setError(null);
    } catch (cause) {
      invalidate(cause instanceof Error ? cause.message : "Unable to read rover drive status.");
    } finally {
      inFlightRef.current = false;
    }
  }, [demo, invalidate, updateStatus]);

  const post = useCallback(async (action: DriveAction): Promise<boolean> => {
    if (demo || demoRef.current) return false;
    pendingActionRef.current += 1;
    while (inFlightRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 10));
    }
    if (demoRef.current) {
      pendingActionRef.current = Math.max(0, pendingActionRef.current - 1);
      return false;
    }
    inFlightRef.current = true;
    setBusy(true);
    try {
      const response = await roverFetch("/api/drive/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload: unknown = await response.json();
      if (demoRef.current) return false;
      if (!response.ok) throw new Error(readError(payload, `Rover control request failed (${response.status}).`));
      updateStatus(driveStatusSchema.parse(payload));
      if (action.action === "stop" || action.action === "select") staleArmStopPendingRef.current = false;
      setError(null);
      return true;
    } catch (cause) {
      invalidate(cause instanceof Error ? cause.message : "Rover control request failed.");
      return false;
    } finally {
      inFlightRef.current = false;
      pendingActionRef.current = Math.max(0, pendingActionRef.current - 1);
      setBusy(false);
    }
  }, [demo, invalidate, updateStatus]);

  const selectSource = useCallback(async (next: DriveSource) => {
    if (demo || demoRef.current) {
      sourceRef.current = next;
      setSource(next);
      return;
    }
    const epoch = ++controlEpochRef.current;
    engagementActiveRef.current = false;
    invalidatedRef.current = true;
    joystickRef.current = { x: 0, y: 0 };
    setJoystickReady(true);
    setError(null);
    if (await post({ action: "select", source: next }) && epoch === controlEpochRef.current) {
      invalidatedRef.current = false;
      staleArmStopPendingRef.current = false;
    }
  }, [demo, post]);

  const arm = useCallback(async (): Promise<boolean> => {
    if (demo || demoRef.current) {
      setError(DEMO_REASON);
      return false;
    }
    if (inFlightRef.current || pendingActionRef.current > 0) {
      setError("Wait for the current rover control request to finish before arming.");
      return false;
    }
    if (staleArmStopPendingRef.current) {
      setError("A previously armed drive lease is being disarmed. Try again after it completes.");
      return false;
    }
    if (statusRef.current.armed) {
      setError("The drive is already armed. Disarm it before requesting a new arm.");
      return false;
    }
    const selected = sourceRef.current;
    if (!selected) {
      setError("Select a drive source before arming.");
      return false;
    }
    if (selected === "joystick" && !joystickReady) {
      setError("Release the on-screen joystick and return it to center before arming.");
      return false;
    }
    if (selected === "gamepad" && !gamepadRef.current.neutralAndReleased) {
      setError("Center both sticks and release R1 before arming.");
      return false;
    }
    if (selected === "flysky") {
      if (!isFlyskyArmReady(statusRef.current.receiver)) {
        setError("FlySky must be connected and fresh, with CH1 steering centered, CH3 throttle centered, and CH5 held high.");
        return false;
      }
    }
    if (!statusRef.current.canDrive || !statusRef.current.available || !statusRef.current.commissioned) {
      setError(statusRef.current.reason || "This client cannot drive the rover.");
      return false;
    }
    const armEpoch = controlEpochRef.current;
    if (statusRef.current.source !== selected || !statusRef.current.owned) {
      invalidatedRef.current = true;
      if (!(await post({ action: "select", source: selected }))) return false;
      if (armEpoch !== controlEpochRef.current) return false;
      const selectedStatus = statusRef.current;
      if (selectedStatus.armed || !selectedStatus.owned || selectedStatus.source !== selected) {
        setError("Source selection did not establish an unarmed lease for this client.");
        return false;
      }
      invalidatedRef.current = false;
    }
    if (armEpoch !== controlEpochRef.current) return false;
    invalidatedRef.current = false;
    const accepted = await post({ action: "arm", neutral: true });
    if (!accepted || !shouldActivateAfterArm(armEpoch, controlEpochRef.current, invalidatedRef.current) || demoRef.current) return false;
    if (!hasConfirmedDriveLease(statusRef.current, selected)) {
      setError("The drive controller did not confirm an active, owned lease.");
      return false;
    }
    engagementActiveRef.current = true;
    return true;
  }, [demo, joystickReady, post]);

  const stop = useCallback(async () => {
    controlEpochRef.current += 1;
    joystickRef.current = { x: 0, y: 0 };
    gamepadWasDeadmanRef.current = false;
    engagementActiveRef.current = false;
    invalidatedRef.current = true;
    setJoystickReady(true);
    staleArmStopPendingRef.current = false;
    if (demo || demoRef.current) return;
    await post({ action: "stop" });
    staleArmStopPendingRef.current = false;
  }, [demo, post]);

  const releaseJoystick = useCallback(async () => {
    joystickRef.current = { x: 0, y: 0 };
    setJoystickReady(true);
    if (demo || demoRef.current) return;
    if (sourceRef.current !== "joystick") return;
    await stop();
  }, [demo, stop]);

  const emergencyStop = useCallback(async () => {
    controlEpochRef.current += 1;
    joystickRef.current = { x: 0, y: 0 };
    engagementActiveRef.current = false;
    invalidatedRef.current = true;
    setJoystickReady(true);
    staleArmStopPendingRef.current = false;
    if (demo || demoRef.current) {
      setError(DEMO_REASON);
      return;
    }
    await post({ action: "estop" });
  }, [demo, post]);

  const resetEmergencyStop = useCallback(async () => {
    if (demo || demoRef.current) return;
    if (!statusRef.current.canReset) {
      setError("Only the owner client can reset the latched emergency stop.");
      return;
    }
    await post({ action: "reset" });
  }, [demo, post]);

  const setJoystick = useCallback((x: number, y: number) => {
    joystickRef.current = { x: clamp(x), y: clamp(y) };
    const centered = Math.abs(joystickRef.current.x) < 0.08 && Math.abs(joystickRef.current.y) < 0.08;
    setJoystickReady((previous) => previous === centered ? previous : centered);
  }, []);

  useEffect(() => {
    if (demo || demoRef.current) return;
    void requestStatus();
    const timer = window.setInterval(() => void requestStatus(), 500);
    return () => window.clearInterval(timer);
  }, [demo, requestStatus]);

  useEffect(() => {
    if (demo || demoRef.current) return;
    const tick = () => {
      if (demoRef.current) return;
      if (staleArmStopPendingRef.current && !inFlightRef.current && pendingActionRef.current === 0) {
        staleArmStopPendingRef.current = false;
        void stop();
        return;
      }
      const pads = navigator.getGamepads?.();
      const sample = readGamepadDriveSample(pads ? Array.from(pads).find((pad) => pad?.connected) ?? null : null);
      gamepadRef.current = sample;
      setGamepadConnected(sample.connected);
      setGamepadStandard(sample.standard);
      setGamepadReady(sample.connected && sample.standard && sample.neutralAndReleased);

      const current = statusRef.current;
      const selected = sourceRef.current;
      const wasConnected = gamepadWasConnectedRef.current;
      gamepadWasConnectedRef.current = sample.connected;
      if (selected === "gamepad" && current.armed && sample.connected && sample.standard) {
        if (!sample.deadman) {
          if (gamepadWasDeadmanRef.current) void stop();
          else if (!sample.neutralAndReleased) void stop();
          gamepadWasDeadmanRef.current = false;
        } else {
          gamepadWasDeadmanRef.current = true;
        }
      } else if (selected === "gamepad" && current.armed && (!sample.connected || !sample.standard) && wasConnected) {
        gamepadWasDeadmanRef.current = false;
        void stop();
      }

      if (invalidatedRef.current || !engagementActiveRef.current || pendingActionRef.current > 0 ||
        !current.available || !current.commissioned || !current.canDrive || current.estop ||
        !current.owned || !current.lease || !current.armed || current.source !== selected || !selected || inFlightRef.current) return;
      let throttle = 0;
      let steering = 0;
      if (selected === "joystick") {
        throttle = joystickRef.current.y;
        steering = joystickRef.current.x;
      } else if (selected === "gamepad") {
        if (!sample.connected || !sample.standard) return;
        if (sample.deadman) {
          throttle = sample.throttle;
          steering = sample.steering;
        } else if (!sample.neutralAndReleased) return;
      }
      void post({ action: "frame", source: selected, lease: current.lease, sequence: sequenceRef.current++, throttle, steering });
    };
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [demo, post, stop]);

  useEffect(() => {
    if (demo || demoRef.current) return;
    const onHide = () => { void stop(); };
    window.addEventListener("blur", onHide);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", onHide);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      if (!demoRef.current) void stop();
    };
  }, [demo, stop]);

  const value = useMemo(() => ({
    status, source, busy, error, demo, gamepadConnected, gamepadStandard, gamepadReady, joystickReady,
    selectSource, arm, stop, emergencyStop, resetEmergencyStop, setJoystick, releaseJoystick,
  }), [status, source, busy, error, demo, gamepadConnected, gamepadStandard, gamepadReady, joystickReady, selectSource, arm, stop, emergencyStop, resetEmergencyStop, setJoystick, releaseJoystick]);
  return <DriveControlContext.Provider value={value}>{children}</DriveControlContext.Provider>;
}

export function useDriveControl() {
  const context = useContext(DriveControlContext);
  if (!context) throw new Error("useDriveControl must be used within DriveControlProvider.");
  return context;
}

function readError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error.slice(0, 300);
  return fallback;
}
