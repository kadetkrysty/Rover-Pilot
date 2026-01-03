import { useState, useEffect, useRef } from 'react';

export interface GamepadInput {
  leftStickX: number;      // -1 to 1
  leftStickY: number;      // -1 to 1
  rightStickX: number;     // -1 to 1
  rightStickY: number;     // -1 to 1
  l1: boolean;
  l2: number;              // 0 to 1
  l3: boolean;
  r1: boolean;
  r2: number;              // 0 to 1
  r3: boolean;
  triangle: boolean;
  circle: boolean;
  x: boolean;
  square: boolean;
  dPadUp: boolean;
  dPadDown: boolean;
  dPadLeft: boolean;
  dPadRight: boolean;
  options: boolean;
  share: boolean;
  psButton: boolean;
  isConnected: boolean;
  gamepadIndex: number | null;
}

const DEADZONE = 0.15;
const TRIGGER_THRESHOLD = 0.1;

export const useGamepad = () => {
  const [gamepadInput, setGamepadInput] = useState<GamepadInput>({
    leftStickX: 0,
    leftStickY: 0,
    rightStickX: 0,
    rightStickY: 0,
    l1: false,
    l2: 0,
    l3: false,
    r1: false,
    r2: 0,
    r3: false,
    triangle: false,
    circle: false,
    x: false,
    square: false,
    dPadUp: false,
    dPadDown: false,
    dPadLeft: false,
    dPadRight: false,
    options: false,
    share: false,
    psButton: false,
    isConnected: false,
    gamepadIndex: null,
  });

  const animationFrameRef = useRef<number | null>(null);

  const applyDeadzone = (value: number, threshold: number = DEADZONE): number => {
    if (Math.abs(value) < threshold) return 0;
    return value > 0 ? (value - threshold) / (1 - threshold) : -(Math.abs(value) - threshold) / (1 - threshold);
  };

  const pollGamepad = () => {
    const gamepads = navigator.getGamepads?.() || [];

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;

      // Check if it's a PS4 controller (DualShock 4)
      const isPS4 = gamepad.id.toLowerCase().includes('054c') || // Sony
                    gamepad.id.toLowerCase().includes('playstation') ||
                    gamepad.id.toLowerCase().includes('ps4') ||
                    gamepad.id.toLowerCase().includes('dualshock');

      if (isPS4 || gamepad.buttons.length >= 17) {
        const buttons = gamepad.buttons;
        const axes = gamepad.axes;

        // Apply deadzone to analog sticks
        const leftStickX = applyDeadzone(axes[0]);
        const leftStickY = applyDeadzone(axes[1]);
        const rightStickX = applyDeadzone(axes[2]);
        const rightStickY = applyDeadzone(axes[3]);

        // L2 and R2 are typically axes 4 and 5, range -1 to 1, convert to 0 to 1
        const l2 = Math.max(0, (axes[4] + 1) / 2);
        const r2 = Math.max(0, (axes[5] + 1) / 2);

        // PS4 DualShock 4 Standard Button Mapping:
        // 0 = Cross (X), 1 = Circle, 2 = Square, 3 = Triangle
        // 4 = L1, 5 = R1, 6 = L2 (button), 7 = R2 (button)
        // 8 = Share, 9 = Options, 10 = L3, 11 = R3
        // 12 = D-Up, 13 = D-Down, 14 = D-Left, 15 = D-Right, 16 = PS
        setGamepadInput({
          leftStickX,
          leftStickY,
          rightStickX,
          rightStickY,
          l1: buttons[4]?.pressed || false,                    // L1
          l2: l2,                                               // L2 (analog from axis)
          l3: buttons[10]?.pressed || false,                   // L3 (left stick click)
          r1: buttons[5]?.pressed || false,                    // R1
          r2: r2,                                               // R2 (analog from axis)
          r3: buttons[11]?.pressed || false,                   // R3 (right stick click)
          triangle: buttons[3]?.pressed || false,              // Triangle (top)
          circle: buttons[1]?.pressed || false,                // Circle (right)
          x: buttons[0]?.pressed || false,                     // Cross/X (bottom)
          square: buttons[2]?.pressed || false,                // Square (left)
          dPadUp: buttons[12]?.pressed || false,
          dPadDown: buttons[13]?.pressed || false,
          dPadLeft: buttons[14]?.pressed || false,
          dPadRight: buttons[15]?.pressed || false,
          options: buttons[9]?.pressed || false,               // Options (right of touchpad)
          share: buttons[8]?.pressed || false,                 // Share (left of touchpad)
          psButton: buttons[16]?.pressed || false,             // PS button (center)
          isConnected: gamepad.connected,
          gamepadIndex: i,
        });

        return; // Exit after finding first PS4 controller
      }
    }

    // No PS4 controller found, reset state
    setGamepadInput((prev) => ({
      ...prev,
      isConnected: false,
      gamepadIndex: null,
    }));
  };

  useEffect(() => {
    const handleGamepadConnected = () => {
      // Gamepad API requires polling, not events
    };

    const handleGamepadDisconnected = () => {
      setGamepadInput((prev) => ({
        ...prev,
        isConnected: false,
        gamepadIndex: null,
      }));
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Start polling
    const poll = () => {
      pollGamepad();
      animationFrameRef.current = requestAnimationFrame(poll);
    };
    animationFrameRef.current = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return gamepadInput;
};
