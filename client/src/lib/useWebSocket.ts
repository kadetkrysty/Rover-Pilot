import { useEffect, useRef, useState, useCallback } from 'react';

export interface TelemetryData {
  timestamp: number;
  gps: { lat: number; lng: number; accuracy: number; speed: number };
  imu: { heading: number; pitch: number; roll: number; accelX: number; accelY: number; accelZ: number };
  lidar: Array<{ angle: number; distance: number }>;
  ultrasonic: number[];
  battery: number;
  motorLeft: number;
  motorRight: number;
}

export interface LidarScan {
  angle: number;
  distance: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'telemetry' | 'lidar_scan' | 'slam_update' | 'command';
  data?: TelemetryData | LidarScan[] | unknown;
  command?: unknown;
}

export type ClientRole = 'viewer' | 'operator' | 'rover';

export interface UseWebSocketResult {
  isConnected: boolean;
  isAuthenticated: boolean;
  role: ClientRole;
  sessionId: string | null;
  telemetry: TelemetryData | null;
  lidarScans: LidarScan[];
  sendCommand: (command: object) => void;
  authenticate: (role: ClientRole, token: string) => void;
  reconnect: () => void;
}

export function useWebSocket(): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<ClientRole>('viewer');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [lidarScans, setLidarScans] = useState<LidarScan[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'auth_required') {
            setSessionId(message.sessionId);
          } else if (message.type === 'auth_success') {
            setIsAuthenticated(true);
            setRole(message.role);
          } else if (message.type === 'auth_failed') {
            setIsAuthenticated(false);
            console.error('Authentication failed:', message.message);
          } else if (message.type === 'telemetry' && message.data) {
            setTelemetry(message.data as TelemetryData);
          } else if (message.type === 'lidar_scan' && message.data) {
            setLidarScans(message.data as LidarScan[]);
          } else if (message.type === 'error') {
            console.error('WebSocket error:', message.message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  const sendCommand = useCallback((command: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated && role === 'operator') {
      wsRef.current.send(JSON.stringify({ type: 'command', command }));
    } else if (!isAuthenticated || role !== 'operator') {
      console.warn('Cannot send command: not authenticated as operator');
    }
  }, [isAuthenticated, role]);

  const authenticate = useCallback((authRole: ClientRole, token: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth', role: authRole, token }));
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsAuthenticated(false);
    setRole('viewer');
    setSessionId(null);
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    isAuthenticated,
    role,
    sessionId,
    telemetry,
    lidarScans,
    sendCommand,
    authenticate,
    reconnect,
  };
}
