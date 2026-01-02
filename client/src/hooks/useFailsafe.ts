import { useState, useEffect, useCallback, useRef } from 'react';
import type { FailsafeConfig, FailsafeTrigger } from '@shared/schema';

interface TelemetryData {
  battery: number;
  speed: number;
  heading: number;
  gps: { lat: number; lng: number; accuracy: number };
  ultrasonic: number[];
  lidarDistance: number;
}

interface FailsafeState {
  isActive: boolean;
  triggers: FailsafeTrigger[];
  lastCheck: number;
  config: FailsafeConfig;
}

const DEFAULT_CONFIG: FailsafeConfig = {
  signalLossThreshold: 3000,        // 3 seconds without signal
  batteryLowThreshold: 20,          // 20% battery warning
  batteryCriticalThreshold: 10,     // 10% battery critical
  obstacleFrontThreshold: 30,       // 30cm front obstacle
  obstacleSideThreshold: 20,        // 20cm side obstacle
  gpsLossTimeout: 10000,            // 10 seconds GPS timeout
  imuDriftThreshold: 15,            // 15 degrees drift per second
  motorOverheatThreshold: 80,       // 80°C motor temperature
  emergencyStopEnabled: true,
  returnToHomeEnabled: true
};

export function useFailsafe(
  telemetry: TelemetryData | null,
  isConnected: boolean,
  rcConnected: boolean
): FailsafeState & { clearTrigger: (type: string) => void; updateConfig: (config: Partial<FailsafeConfig>) => void } {
  const [state, setState] = useState<FailsafeState>({
    isActive: false,
    triggers: [],
    lastCheck: Date.now(),
    config: DEFAULT_CONFIG
  });

  const lastTelemetryRef = useRef<number>(Date.now());
  const lastGpsRef = useRef<number>(Date.now());
  const lastHeadingRef = useRef<number>(0);
  const lastHeadingTimeRef = useRef<number>(Date.now());

  const addTrigger = useCallback((trigger: FailsafeTrigger) => {
    setState(prev => {
      const exists = prev.triggers.some(t => t.type === trigger.type);
      if (exists) return prev;
      
      return {
        ...prev,
        isActive: trigger.severity === 'critical' || trigger.severity === 'emergency',
        triggers: [...prev.triggers, trigger]
      };
    });
  }, []);

  const removeTrigger = useCallback((type: string) => {
    setState(prev => {
      const newTriggers = prev.triggers.filter(t => t.type !== type);
      const hasActiveTrigger = newTriggers.some(
        t => t.severity === 'critical' || t.severity === 'emergency'
      );
      return {
        ...prev,
        isActive: hasActiveTrigger,
        triggers: newTriggers
      };
    });
  }, []);

  const updateConfig = useCallback((config: Partial<FailsafeConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...config }
    }));
  }, []);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const { config } = state;

      // Check signal loss (RC transmitter)
      if (!rcConnected) {
        addTrigger({
          type: 'signal_loss',
          severity: 'critical',
          action: 'stop',
          message: 'RC transmitter signal lost'
        });
      } else {
        removeTrigger('signal_loss');
      }

      // Check WebSocket connection
      if (!isConnected && now - lastTelemetryRef.current > config.signalLossThreshold) {
        addTrigger({
          type: 'signal_loss',
          severity: 'warning',
          action: 'alert',
          message: 'Telemetry connection lost'
        });
      }

      if (telemetry) {
        lastTelemetryRef.current = now;

        // Check battery levels
        if (telemetry.battery <= config.batteryCriticalThreshold) {
          addTrigger({
            type: 'battery_critical',
            severity: 'emergency',
            action: 'return_home',
            message: `Battery critical: ${telemetry.battery.toFixed(0)}%`
          });
        } else if (telemetry.battery <= config.batteryLowThreshold) {
          addTrigger({
            type: 'battery_low',
            severity: 'warning',
            action: 'alert',
            message: `Battery low: ${telemetry.battery.toFixed(0)}%`
          });
          removeTrigger('battery_critical');
        } else {
          removeTrigger('battery_low');
          removeTrigger('battery_critical');
        }

        // Check front obstacle
        const frontDistance = telemetry.ultrasonic[0] || 999;
        if (frontDistance < config.obstacleFrontThreshold) {
          addTrigger({
            type: 'obstacle_detected',
            severity: frontDistance < 15 ? 'emergency' : 'warning',
            action: frontDistance < 15 ? 'emergency_stop' : 'reduce_speed',
            message: `Obstacle detected: ${frontDistance}cm`
          });
        } else {
          removeTrigger('obstacle_detected');
        }

        // Check GPS validity
        if (telemetry.gps.accuracy > 50 || (telemetry.gps.lat === 0 && telemetry.gps.lng === 0)) {
          if (now - lastGpsRef.current > config.gpsLossTimeout) {
            addTrigger({
              type: 'gps_loss',
              severity: 'warning',
              action: 'alert',
              message: 'GPS signal lost or inaccurate'
            });
          }
        } else {
          lastGpsRef.current = now;
          removeTrigger('gps_loss');
        }

        // Check IMU drift (rapid heading changes)
        const headingDelta = Math.abs(telemetry.heading - lastHeadingRef.current);
        const timeDelta = (now - lastHeadingTimeRef.current) / 1000;
        const driftRate = timeDelta > 0 ? headingDelta / timeDelta : 0;
        
        if (driftRate > config.imuDriftThreshold && timeDelta < 2) {
          addTrigger({
            type: 'imu_drift',
            severity: 'warning',
            action: 'alert',
            message: `IMU drift detected: ${driftRate.toFixed(1)}°/s`
          });
        } else {
          removeTrigger('imu_drift');
        }
        
        lastHeadingRef.current = telemetry.heading;
        lastHeadingTimeRef.current = now;
      }

      setState(prev => ({ ...prev, lastCheck: now }));
    }, 500); // Check every 500ms

    return () => clearInterval(checkInterval);
  }, [telemetry, isConnected, rcConnected, state.config, addTrigger, removeTrigger]);

  return {
    ...state,
    clearTrigger: removeTrigger,
    updateConfig
  };
}

export type { FailsafeState, FailsafeConfig, FailsafeTrigger };
