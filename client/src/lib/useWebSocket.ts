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

export interface ConnectionStatus {
  state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastConnectedAt: number | null;
  lastError: string | null;
  reconnectAttempts: number;
  latency: number;
}

export interface UseWebSocketResult {
  isConnected: boolean;
  isAuthenticated: boolean;
  role: ClientRole;
  sessionId: string | null;
  telemetry: TelemetryData | null;
  lidarScans: LidarScan[];
  connectionStatus: ConnectionStatus;
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'connecting',
    lastConnectedAt: null,
    lastError: null,
    reconnectAttempts: 0,
    latency: 0
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const lastPingRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Check for custom rover URL in localStorage
    const roverUrl = localStorage.getItem('rover_api_url');
    let wsUrl: string;
    
    if (roverUrl) {
      // For remote rover, connect to WebSocket on port 5001
      const wsProtocol = roverUrl.startsWith('https') ? 'wss:' : 'ws:';
      const hostMatch = roverUrl.match(/^https?:\/\/([^:\/]+)/);
      const host = hostMatch ? hostMatch[1] : 'localhost';
      wsUrl = `${wsProtocol}//${host}:5001`;
    } else {
      // For local development, use same host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    }

    try {
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to:', wsUrl);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setConnectionStatus(prev => ({
          ...prev,
          state: 'connected',
          lastConnectedAt: Date.now(),
          lastError: null,
          reconnectAttempts: 0
        }));
        
        // Start ping interval for latency measurement
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            lastPingRef.current = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type, message);
          
          if (message.type === 'auth_required') {
            setSessionId(message.sessionId);
            // Auto-authenticate as viewer
            ws.send(JSON.stringify({ type: 'auth', role: 'viewer', token: '' }));
          } else if (message.type === 'auth_success') {
            setIsAuthenticated(true);
            setRole(message.role);
          } else if (message.type === 'auth_failed') {
            setIsAuthenticated(false);
            console.error('Authentication failed:', message.message);
          } else if (message.type === 'telemetry' && message.data) {
            setTelemetry(message.data as TelemetryData);
          } else if (message.type === 'lidar_scan' && message.data) {
            const scans = message.data as LidarScan[];
            setLidarScans(prev => {
              const combined = [...scans, ...prev];
              return combined.slice(0, 360);
            });
          } else if (message.type === 'pong') {
            const latency = Date.now() - lastPingRef.current;
            setConnectionStatus(prev => ({ ...prev, latency }));
          } else if (message.type === 'error') {
            console.error('WebSocket error:', message.message);
            setConnectionStatus(prev => ({
              ...prev,
              lastError: message.message || 'Unknown error'
            }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          setConnectionStatus(prev => ({
            ...prev,
            lastError: 'Failed to parse message'
          }));
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        setConnectionStatus(prev => ({
          ...prev,
          state: 'reconnecting',
          reconnectAttempts: reconnectAttemptsRef.current,
          lastError: event.reason || `Connection closed (code: ${event.code})`
        }));
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus(prev => ({
          ...prev,
          state: 'error',
          lastError: 'Connection error'
        }));
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus(prev => ({
        ...prev,
        state: 'error',
        lastError: 'Failed to create connection'
      }));
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

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    isAuthenticated,
    role,
    sessionId,
    telemetry,
    lidarScans,
    connectionStatus,
    sendCommand,
    authenticate,
    reconnect,
  };
}
