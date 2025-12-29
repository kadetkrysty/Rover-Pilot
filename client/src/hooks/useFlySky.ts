import { useState, useEffect, useRef } from 'react';

export interface FlySkyInput {
  // 10 Channels (PWM values: 1000-2000us)
  channel1: number;   // Roll/Aileron (steering)
  channel2: number;   // Pitch/Elevator (forward/back)
  channel3: number;   // Throttle
  channel4: number;   // Yaw/Rudder
  channel5: number;   // Switch A
  channel6: number;   // Switch B
  channel7: number;   // Aux Channel 1
  channel8: number;   // Aux Channel 2
  channel9: number;   // Aux Channel 3
  channel10: number;  // Aux Channel 4
  
  // Derived control values (normalized -1 to 1)
  throttle: number;
  steering: number;
  pitch: number;
  roll: number;
  
  // Switch states
  switchA: boolean;
  switchB: boolean;
  
  // Auxiliary channels (normalized)
  aux1: number;
  aux2: number;
  aux3: number;
  aux4: number;
  
  // Connection status
  isConnected: boolean;
  signalStrength: number; // 0-100%
  failsafeActive: boolean;
  frameRate: number; // Hz
}

const PWM_MIN = 1000;
const PWM_MAX = 2000;
const PWM_CENTER = 1500;

export const useFlySky = () => {
  const [flySkyInput, setFlySkyInput] = useState<FlySkyInput>({
    channel1: PWM_CENTER,
    channel2: PWM_CENTER,
    channel3: PWM_MIN,
    channel4: PWM_CENTER,
    channel5: PWM_MIN,
    channel6: PWM_MIN,
    channel7: PWM_CENTER,
    channel8: PWM_CENTER,
    channel9: PWM_CENTER,
    channel10: PWM_CENTER,
    throttle: 0,
    steering: 0,
    pitch: 0,
    roll: 0,
    switchA: false,
    switchB: false,
    aux1: 0,
    aux2: 0,
    aux3: 0,
    aux4: 0,
    isConnected: false,
    signalStrength: 0,
    failsafeActive: false,
    frameRate: 0,
  });

  const pollIntervalRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  const normalizePWM = (pwm: number): number => {
    if (pwm < PWM_CENTER) {
      return (pwm - PWM_CENTER) / (PWM_CENTER - PWM_MIN);
    } else {
      return (pwm - PWM_CENTER) / (PWM_MAX - PWM_CENTER);
    }
  };

  const pollFlySky = async () => {
    try {
      // Fetch FlySky data from Raspberry Pi API
      const response = await fetch('http://localhost:8080/api/flysky/input', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setFlySkyInput((prev) => ({
          ...prev,
          isConnected: false,
        }));
        return;
      }

      const data = await response.json();

      // Calculate normalized values
      const throttle = normalizePWM(data.channel3);
      const steering = normalizePWM(data.channel1);
      const pitch = normalizePWM(data.channel2);
      const roll = normalizePWM(data.channel4);
      const aux1 = normalizePWM(data.channel7);
      const aux2 = normalizePWM(data.channel8);
      const aux3 = normalizePWM(data.channel9);
      const aux4 = normalizePWM(data.channel10);

      // Determine switch states (threshold at 1200us)
      const switchThreshold = 1200;
      const switchA = data.channel5 > switchThreshold;
      const switchB = data.channel6 > switchThreshold;

      setFlySkyInput({
        channel1: data.channel1 || PWM_CENTER,
        channel2: data.channel2 || PWM_CENTER,
        channel3: data.channel3 || PWM_MIN,
        channel4: data.channel4 || PWM_CENTER,
        channel5: data.channel5 || PWM_MIN,
        channel6: data.channel6 || PWM_MIN,
        channel7: data.channel7 || PWM_CENTER,
        channel8: data.channel8 || PWM_CENTER,
        channel9: data.channel9 || PWM_CENTER,
        channel10: data.channel10 || PWM_CENTER,
        throttle,
        steering,
        pitch,
        roll,
        switchA,
        switchB,
        aux1,
        aux2,
        aux3,
        aux4,
        isConnected: data.connected || false,
        signalStrength: data.signalStrength || 0,
        failsafeActive: data.failsafe || false,
        frameRate: data.frameRate || 0,
      });

      // Calculate frame rate
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastUpdateRef.current >= 1000) {
        lastUpdateRef.current = now;
        frameCountRef.current = 0;
      }
    } catch (error) {
      // Connection error - FlySky receiver not available
      setFlySkyInput((prev) => ({
        ...prev,
        isConnected: false,
      }));
    }
  };

  useEffect(() => {
    // Poll FlySky input at 50Hz
    pollIntervalRef.current = window.setInterval(() => {
      pollFlySky();
    }, 20);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return flySkyInput;
};
