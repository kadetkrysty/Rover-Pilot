import { useState, useEffect } from 'react';

export interface RoverData {
  speed: number;
  battery: number;
  heading: number;
  pitch: number;
  roll: number;
  gps: { lat: number; lng: number };
  lidarDistance: number;
  sensors: {
    ultrasonic: [number, number, number, number, number]; // 5 sensors
    huskyLens: boolean;
    lidar: boolean;
    imu: boolean;
    gps: boolean;
  };
  log: string[];
  stats: {
    totalDistance: number;
    waypointCount: number;
    avgSpeed: number;
    bearing: number;
  };
}

export const useRoverData = () => {
  const [data, setData] = useState<RoverData>({
    speed: 0,
    battery: 85,
    heading: 0,
    pitch: 0,
    roll: 0,
    gps: { lat: 34.0522, lng: -118.2437 },
    lidarDistance: 120,
    sensors: {
      ultrasonic: [120, 150, 45, 200, 180],
      huskyLens: true,
      lidar: true,
      imu: true,
      gps: true,
    },
    log: [
      "[SYSTEM] Boot sequence initiated...",
      "[SYSTEM] Hoverboard firmware verified (Emmanuel Feru)",
      "[SENSORS] IMU calibrated.",
      "[SENSORS] Lidar active.",
      "[NETWORK] Connected to Rover-AP-5G",
      "[AI] Husky Lens object detection active"
    ],
    stats: {
      totalDistance: 0.09,
      waypointCount: 3,
      avgSpeed: 9.0,
      bearing: 53
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        speed: Math.max(0, Math.min(20, prev.speed + (Math.random() - 0.5) * 2)),
        heading: (prev.heading + (Math.random() - 0.5) * 5) % 360,
        pitch: (Math.random() - 0.5) * 5,
        roll: (Math.random() - 0.5) * 5,
        lidarDistance: Math.max(0, 500 + (Math.random() - 0.5) * 50),
        battery: Math.max(0, prev.battery - 0.01),
        sensors: {
            ...prev.sensors,
            ultrasonic: prev.sensors.ultrasonic.map(v => Math.max(0, v + (Math.random() - 0.5) * 10)) as [number, number, number, number, number]
        },
        stats: {
          totalDistance: prev.stats.totalDistance + (Math.random() * 0.001),
          waypointCount: prev.stats.waypointCount,
          avgSpeed: Math.max(0, prev.stats.avgSpeed + (Math.random() - 0.5) * 0.5),
          bearing: (prev.stats.bearing + (Math.random() - 0.5) * 2) % 360
        },
        log: Math.random() > 0.9 
          ? [`[TELEMETRY] Ping: ${Math.floor(Math.random() * 50)}ms`, ...prev.log.slice(0, 9)] 
          : prev.log
      }));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return data;
};
