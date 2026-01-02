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
      // Fetch iBUS data from Mini PC controller API
      // iBUS data is now received via Arduino Serial1 and forwarded to API
      const response = await fetch('/api/ibus', {
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
      
      // Handle new iBUS format from Arduino via Mini PC
      // API returns: { connected, channels: [10], frameRate, control: {throttle, steering} }
      const channels = data.channels || [];
      
      // Map channel array to individual values (iBUS channels are 0-indexed in array)
      const ch1 = channels[0] || PWM_CENTER;
      const ch2 = channels[1] || PWM_CENTER;
      const ch3 = channels[2] || PWM_MIN;
      const ch4 = channels[3] || PWM_CENTER;
      const ch5 = channels[4] || PWM_MIN;
      const ch6 = channels[5] || PWM_MIN;
      const ch7 = channels[6] || PWM_CENTER;
      const ch8 = channels[7] || PWM_CENTER;
      const ch9 = channels[8] || PWM_CENTER;
      const ch10 = channels[9] || PWM_CENTER;

      // Calculate normalized values
      const throttle = normalizePWM(ch3);
      const steering = normalizePWM(ch1);
      const pitch = normalizePWM(ch2);
      const roll = normalizePWM(ch4);
      const aux1 = normalizePWM(ch7);
      const aux2 = normalizePWM(ch8);
      const aux3 = normalizePWM(ch9);
      const aux4 = normalizePWM(ch10);

      // Determine switch states (threshold at 1500us for 2-position switches)
      const switchThreshold = 1500;
      const switchA = ch5 > switchThreshold;
      const switchB = ch6 > switchThreshold;

      // Use backend-provided signalStrength if available, otherwise calculate from frame rate
      const signalStrength = data.signalStrength !== undefined 
        ? data.signalStrength 
        : (data.connected ? Math.min(100, (data.frameRate / 143) * 100) : 0);

      // Use backend-provided failsafe flag (true if transmitter signal lost)
      const failsafeActive = data.failsafe !== undefined ? data.failsafe : !data.connected;

      setFlySkyInput({
        channel1: ch1,
        channel2: ch2,
        channel3: ch3,
        channel4: ch4,
        channel5: ch5,
        channel6: ch6,
        channel7: ch7,
        channel8: ch8,
        channel9: ch9,
        channel10: ch10,
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
        signalStrength: signalStrength,
        failsafeActive: failsafeActive,
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
