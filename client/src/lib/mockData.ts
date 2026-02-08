import { useState, useEffect } from 'react';

export interface PowerData {
  batteryPercent: number;
  batteryVoltage: number;
  batteryCurrent: number;
  batteryCapacityAh: number;
  remainingCapacityAh: number;
  estimatedRangeKm: number;
  estimatedRuntimeMin: number;
  powerConsumptionW: number;
  chargingStatus: 'charging' | 'discharging' | 'idle';
}

export interface SystemStatus {
  miniPC: boolean;
  arduinoMega: boolean;
  raspberryPi: boolean;
  hoverboardESC: boolean;
  flySkyReceiver: boolean;
  slushEngine: boolean;
  huskyLens: boolean;
  lidar: boolean;
  imu: boolean;
  gps: boolean;
  cameraPanTilt: boolean;
  batteryMonitor: boolean;
}

export interface LidarPoint {
  angle: number;
  distance: number;
  intensity?: number;
}

export interface RoverData {
  speed: number;
  heading: number;
  pitch: number;
  roll: number;
  gps: { lat: number; lng: number };
  lidarDistance: number;
  lidarScan?: LidarPoint[];
  sensors: {
    ultrasonic: [number, number, number, number, number];
    huskyLens: boolean;
    lidar: boolean;
    imu: boolean;
    gps: boolean;
  };
  systems: SystemStatus;
  power: PowerData;
  log: string[];
  battery: number;
}

export const useRoverData = () => {
  const [data, setData] = useState<RoverData>({
    speed: 0,
    battery: 85,
    heading: 0,
    pitch: 0,
    roll: 0,
    gps: { lat: 0, lng: 0 },
    lidarDistance: 120,
    sensors: {
      ultrasonic: [120, 150, 45, 200, 180],
      huskyLens: true,
      lidar: true,
      imu: true,
      gps: true,
    },
    systems: {
      miniPC: true,
      arduinoMega: true,
      raspberryPi: true,
      hoverboardESC: true,
      flySkyReceiver: true,
      slushEngine: true,
      huskyLens: true,
      lidar: true,
      imu: true,
      gps: true,
      cameraPanTilt: true,
      batteryMonitor: true,
    },
    power: {
      batteryPercent: 85,
      batteryVoltage: 25.2,
      batteryCurrent: 4.5,
      batteryCapacityAh: 20,
      remainingCapacityAh: 17,
      estimatedRangeKm: 12.5,
      estimatedRuntimeMin: 180,
      powerConsumptionW: 113.4,
      chargingStatus: 'discharging',
    },
    log: [
      "[SYSTEM] Boot sequence initiated...",
      "[SYSTEM] Hoverboard firmware verified (Emmanuel Feru)",
      "[SENSORS] IMU calibrated.",
      "[SENSORS] Lidar active.",
      "[NETWORK] Connected to Rover-AP-5G",
      "[AI] Husky Lens object detection active"
    ]
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newBatteryPercent = Math.max(0, prev.power.batteryPercent - 0.01);
        const newBatteryVoltage = 21 + (newBatteryPercent / 100) * 4.2;
        const newBatteryCurrent = 3.5 + Math.random() * 2;
        const newPowerConsumptionW = newBatteryVoltage * newBatteryCurrent;
        const newRemainingAh = (newBatteryPercent / 100) * prev.power.batteryCapacityAh;
        
        const newSpeed = Math.max(0, Math.min(20, prev.speed + (Math.random() - 0.5) * 2));
        const avgSpeed = newSpeed > 0.5 ? newSpeed : 5;
        const whPerKm = newPowerConsumptionW / avgSpeed;
        const totalEnergyWh = newRemainingAh * newBatteryVoltage;
        const estimatedRange = whPerKm > 0 ? totalEnergyWh / whPerKm : 0;
        const estimatedRuntime = newBatteryCurrent > 0 
          ? (newRemainingAh / newBatteryCurrent) * 60 
          : 0;

        return {
          ...prev,
          speed: newSpeed,
          heading: (prev.heading + (Math.random() - 0.5) * 5) % 360,
          pitch: (Math.random() - 0.5) * 5,
          roll: (Math.random() - 0.5) * 5,
          lidarDistance: Math.max(0, 500 + (Math.random() - 0.5) * 50),
          battery: newBatteryPercent,
          sensors: {
            ...prev.sensors,
            ultrasonic: prev.sensors.ultrasonic.map(v => Math.max(0, v + (Math.random() - 0.5) * 10)) as [number, number, number, number, number]
          },
          power: {
            ...prev.power,
            batteryPercent: newBatteryPercent,
            batteryVoltage: newBatteryVoltage,
            batteryCurrent: newBatteryCurrent,
            remainingCapacityAh: newRemainingAh,
            estimatedRangeKm: Math.max(0, Math.min(estimatedRange, 50)),
            estimatedRuntimeMin: Math.max(0, Math.min(estimatedRuntime, 600)),
            powerConsumptionW: newPowerConsumptionW,
          },
          log: Math.random() > 0.9 
            ? [`[TELEMETRY] Ping: ${Math.floor(Math.random() * 50)}ms`, ...prev.log.slice(0, 9)] 
            : prev.log
        };
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return data;
};
