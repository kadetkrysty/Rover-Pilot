import { useState, useEffect, useCallback } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
  permissionGranted: boolean;
}

export function useLocation(watchPosition: boolean = false) {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    loading: true,
    permissionGranted: false,
  });

  const requestPermission = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        return permission.location === 'granted';
      } else {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state === 'granted' || result.state === 'prompt';
      }
    } catch (err) {
      console.error('Permission request failed:', err);
      return false;
    }
  }, []);

  const getCurrentPosition = useCallback(async () => {
    try {
      setLocation(prev => ({ ...prev, loading: true, error: null }));

      let position: Position;

      if (Capacitor.isNativePlatform()) {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
        });
      } else {
        position = await new Promise<Position>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  altitude: pos.coords.altitude,
                  altitudeAccuracy: pos.coords.altitudeAccuracy,
                  heading: pos.coords.heading,
                  speed: pos.coords.speed,
                },
                timestamp: pos.timestamp,
              });
            },
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        });
      }

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
        error: null,
        loading: false,
        permissionGranted: true,
      });
    } catch (err: any) {
      setLocation(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to get location',
      }));
    }
  }, []);

  useEffect(() => {
    let watchId: string | null = null;

    const initLocation = async () => {
      const hasPermission = await requestPermission();
      
      if (!hasPermission) {
        setLocation(prev => ({
          ...prev,
          loading: false,
          error: 'Location permission denied',
          permissionGranted: false,
        }));
        return;
      }

      setLocation(prev => ({ ...prev, permissionGranted: true }));

      if (watchPosition && Capacitor.isNativePlatform()) {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: false },
          (position, err) => {
            if (err) {
              setLocation(prev => ({
                ...prev,
                loading: false,
                error: err.message,
              }));
              return;
            }
            if (position) {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp,
                error: null,
                loading: false,
                permissionGranted: true,
              });
            }
          }
        );
      } else if (watchPosition) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
              error: null,
              loading: false,
              permissionGranted: true,
            });
          },
          (err) => {
            setLocation(prev => ({
              ...prev,
              loading: false,
              error: err.message,
            }));
          },
          { enableHighAccuracy: false, maximumAge: 30000 }
        );
        watchId = id.toString();
      } else {
        await getCurrentPosition();
      }
    };

    initLocation();

    return () => {
      if (watchId) {
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id: watchId });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchId));
        }
      }
    };
  }, [watchPosition, requestPermission, getCurrentPosition]);

  return {
    ...location,
    refresh: getCurrentPosition,
    requestPermission,
  };
}
