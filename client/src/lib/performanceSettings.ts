import { createContext, useContext } from 'react';

export interface PerformanceSettings {
  enable3DSimulation: boolean;
  enableAnimations: boolean;
  enableParticleEffects: boolean;
  radarUpdateInterval: number;
  maxLidarPoints: number;
  maxObstacleHistory: number;
  lowPowerMode: boolean;
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  enable3DSimulation: true,
  enableAnimations: true,
  enableParticleEffects: true,
  radarUpdateInterval: 50,
  maxLidarPoints: 360,
  maxObstacleHistory: 50,
  lowPowerMode: false,
};

const MOBILE_SETTINGS: PerformanceSettings = {
  enable3DSimulation: false,
  enableAnimations: true,
  enableParticleEffects: false,
  radarUpdateInterval: 100,
  maxLidarPoints: 180,
  maxObstacleHistory: 20,
  lowPowerMode: true,
};

const LOW_POWER_SETTINGS: PerformanceSettings = {
  enable3DSimulation: false,
  enableAnimations: false,
  enableParticleEffects: false,
  radarUpdateInterval: 150,
  maxLidarPoints: 90,
  maxObstacleHistory: 10,
  lowPowerMode: true,
};

export function detectPerformanceProfile(): 'desktop' | 'mobile' | 'low-power' {
  if (typeof window === 'undefined') return 'desktop';
  
  const isMobile = window.innerWidth < 768 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const memoryInfo = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const isLowMemory = memoryInfo !== undefined && memoryInfo < 4;
  
  const hardwareConcurrency = navigator.hardwareConcurrency;
  const isLowCPU = hardwareConcurrency !== undefined && hardwareConcurrency < 4;
  
  if (isLowMemory || isLowCPU) return 'low-power';
  if (isMobile) return 'mobile';
  return 'desktop';
}

export function getPerformanceSettings(profile?: 'desktop' | 'mobile' | 'low-power'): PerformanceSettings {
  const detectedProfile = profile || detectPerformanceProfile();
  
  switch (detectedProfile) {
    case 'low-power':
      return LOW_POWER_SETTINGS;
    case 'mobile':
      return MOBILE_SETTINGS;
    default:
      return DEFAULT_SETTINGS;
  }
}

export const PerformanceContext = createContext<PerformanceSettings>(DEFAULT_SETTINGS);

export function usePerformanceSettings(): PerformanceSettings {
  return useContext(PerformanceContext);
}
