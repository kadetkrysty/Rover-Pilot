import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertCircle, XCircle, Activity } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';

interface SystemStatus {
  name: string;
  status: 'online' | 'warning' | 'offline';
  value: string;
  details?: string;
}

export default function SystemDiagnostics() {
  const data = useRoverData();
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([]);

  useEffect(() => {
    const status: SystemStatus[] = [
      {
        name: 'Arduino Mega Controller',
        status: 'online',
        value: '✓ Connected',
        details: 'Firmware v3.0.0 | 115200 baud | iBUS'
      },
      {
        name: 'Mini PC Host',
        status: 'online',
        value: '✓ Connected',
        details: 'Intel Celeron | Ubuntu | Flask API'
      },
      {
        name: 'FlySky RC (iBUS)',
        status: 'online',
        value: '10 Channels',
        details: 'FS-I6x + FS-IA10B | ~143Hz'
      },
      {
        name: 'Hoverboard Motors',
        status: data.speed > 0 ? 'online' : 'online',
        value: `${data.speed.toFixed(1)} km/h`,
        details: 'FOC Firmware | 36V Supply'
      },
      {
        name: 'Battery Level',
        status: data.battery > 20 ? (data.battery > 50 ? 'online' : 'warning') : 'warning',
        value: `${Math.floor(data.battery)}%`,
        details: data.battery > 50 ? 'Healthy' : 'Low - Consider charging'
      },
      {
        name: 'IMU (MPU6050)',
        status: data.sensors.imu ? 'online' : 'offline',
        value: `${data.heading.toFixed(0)}°`,
        details: 'Pitch/Roll/Heading | Calibrated'
      },
      {
        name: 'GPS (Neo-6M)',
        status: data.sensors.gps ? 'online' : 'offline',
        value: `${data.gps.lat.toFixed(4)}°`,
        details: 'Fix Type: 3D | Satellites: 12'
      },
      {
        name: 'Lidar (TF Mini Pro)',
        status: data.sensors.lidar ? 'online' : 'offline',
        value: `${data.lidarDistance} cm`,
        details: '100Hz Update Rate'
      },
      {
        name: 'Ultrasonic Array (5x)',
        status: 'online',
        value: `45 cm (min)`,
        details: 'Front, FL, FR, RL, RR'
      },
      {
        name: 'HuskyLens AI Camera',
        status: data.sensors.huskyLens ? 'online' : 'offline',
        value: 'Object Detection',
        details: 'I2C | Frame Rate: 30fps'
      },
      {
        name: 'WiFi Connection',
        status: 'online',
        value: 'ROVER-AP-5G',
        details: 'Signal: -45 dBm | 5 GHz'
      }
    ];
    setSystemStatus(status);
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-secondary" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-accent" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'border-secondary/30 bg-secondary/5';
      case 'warning':
        return 'border-accent/30 bg-accent/5';
      case 'offline':
        return 'border-destructive/30 bg-destructive/5';
      default:
        return '';
    }
  };

  const onlineCount = systemStatus.filter(s => s.status === 'online').length;
  const warningCount = systemStatus.filter(s => s.status === 'warning').length;
  const offlineCount = systemStatus.filter(s => s.status === 'offline').length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-system-diagnostics">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary" data-testid="text-diagnostics-title">SYSTEM DIAGNOSTICS</h1>
        <p className="text-muted-foreground font-mono mt-1">Real-time hardware and software status monitoring</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="hud-panel p-4 text-center" data-testid="card-online-count">
          <Activity className="w-6 h-6 mx-auto text-secondary mb-2" />
          <div className="text-3xl font-bold text-secondary" data-testid="text-online-count">{onlineCount}</div>
          <div className="text-xs text-muted-foreground mt-1">SYSTEMS ONLINE</div>
        </Card>
        <Card className="hud-panel p-4 text-center" data-testid="card-warning-count">
          <AlertCircle className="w-6 h-6 mx-auto text-accent mb-2" />
          <div className="text-3xl font-bold text-accent" data-testid="text-warning-count">{warningCount}</div>
          <div className="text-xs text-muted-foreground mt-1">WARNINGS</div>
        </Card>
        <Card className="hud-panel p-4 text-center" data-testid="card-offline-count">
          <XCircle className="w-6 h-6 mx-auto text-destructive mb-2" />
          <div className="text-3xl font-bold text-destructive" data-testid="text-offline-count">{offlineCount}</div>
          <div className="text-xs text-muted-foreground mt-1">OFFLINE</div>
        </Card>
        <Card className="hud-panel p-4 text-center" data-testid="card-health">
          <div className="text-3xl font-bold text-primary" data-testid="text-health-percent">{Math.round((onlineCount / systemStatus.length) * 100)}%</div>
          <div className="text-xs text-muted-foreground mt-1">HEALTH</div>
        </Card>
      </div>

      {/* Detailed System Status */}
      <div className="hud-panel p-4">
        <h2 className="text-sm font-display text-primary mb-4">COMPONENT STATUS</h2>
        <div className="space-y-3">
          {systemStatus.map((system, idx) => (
            <div
              key={idx}
              className={`border rounded p-3 transition-all flex items-start justify-between ${getStatusColor(system.status)}`}
            >
              <div className="flex gap-3 flex-1">
                {getStatusIcon(system.status)}
                <div>
                  <div className="text-sm font-mono font-bold text-foreground">{system.name}</div>
                  {system.details && (
                    <div className="text-xs text-muted-foreground/70 mt-0.5">{system.details}</div>
                  )}
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-foreground text-right min-w-fit ml-4">
                {system.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware Configuration */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="hud-panel p-4">
          <h3 className="text-sm font-display text-primary mb-3">CONTROL HARDWARE</h3>
          <div className="space-y-2 text-xs font-mono text-muted-foreground/80">
            <div className="flex justify-between"><span>Main CPU</span><span className="text-foreground">Raspberry Pi 3 B+</span></div>
            <div className="flex justify-between"><span>Controller</span><span className="text-foreground">Arduino Mega 2560</span></div>
            <div className="flex justify-between"><span>Motor Driver</span><span className="text-foreground">Hoverboard FOC</span></div>
            <div className="flex justify-between"><span>Battery</span><span className="text-foreground">36V LiPo</span></div>
          </div>
        </div>

        <div className="hud-panel p-4">
          <h3 className="text-sm font-display text-primary mb-3">SENSOR SUITE</h3>
          <div className="space-y-2 text-xs font-mono text-muted-foreground/80">
            <div className="flex justify-between"><span>Vision</span><span className="text-foreground">HuskyLens AI Camera</span></div>
            <div className="flex justify-between"><span>Range</span><span className="text-foreground">TF Mini Pro Lidar</span></div>
            <div className="flex justify-between"><span>Proximity</span><span className="text-foreground">5x HC-SR04 Ultrasonic</span></div>
            <div className="flex justify-between"><span>Motion</span><span className="text-foreground">MPU6050 IMU</span></div>
          </div>
        </div>
      </div>

      {/* Software Info */}
      <div className="hud-panel p-4 mt-6">
        <h3 className="text-sm font-display text-primary mb-3">SOFTWARE VERSION</h3>
        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <div className="text-muted-foreground/70">Firmware Version</div>
            <div className="text-foreground font-bold">2.4.0</div>
          </div>
          <div>
            <div className="text-muted-foreground/70">Controller API</div>
            <div className="text-foreground font-bold">Flask REST v1.0</div>
          </div>
          <div>
            <div className="text-muted-foreground/70">Dashboard Version</div>
            <div className="text-foreground font-bold">RoverOS v2.4</div>
          </div>
          <div>
            <div className="text-muted-foreground/70">Build Target</div>
            <div className="text-foreground font-bold">Android APK</div>
          </div>
        </div>
      </div>
    </div>
  );
}
