import { Check, XCircle, Cpu, Radio, Gauge, Eye, Navigation, Thermometer, Camera, Battery } from "lucide-react";
import { RoverData } from "@/lib/mockData";

interface SensorStatusProps {
  sensors: RoverData['sensors'];
  systems?: RoverData['systems'];
}

function StatusIndicator({ active, label, icon: Icon }: { active: boolean; label: string; icon?: React.ComponentType<{className?: string}> }) {
  return (
    <div className="flex items-center justify-between px-1.5 py-1 border border-border bg-card/50 rounded hover:bg-card hover:border-primary/40 transition-all">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-foreground/70" />}
        <span className="text-[10px] font-mono text-foreground/80 uppercase tracking-wide">{label}</span>
      </div>
      {active ? (
        <div className="flex items-center gap-0.5 text-secondary text-[10px]">
          <span>OK</span>
          <Check className="w-2.5 h-2.5" />
        </div>
      ) : (
        <div className="flex items-center gap-0.5 text-destructive text-[10px]">
          <span>ERR</span>
          <XCircle className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  )
}

export default function SensorStatus({ sensors, systems }: SensorStatusProps) {
  const systemData = systems || {
    miniPC: true,
    arduinoMega: true,
    raspberryPi: true,
    hoverboardESC: true,
    flySkyReceiver: true,
    slushEngine: true,
    huskyLens: sensors.huskyLens,
    lidar: sensors.lidar,
    imu: sensors.imu,
    gps: sensors.gps,
    cameraPanTilt: true,
    batteryMonitor: true,
  };

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-display text-primary/80 mb-1">CORE SYSTEMS</h3>
      <div className="grid grid-cols-2 gap-1">
        <StatusIndicator active={systemData.miniPC} label="Mini PC" icon={Cpu} />
        <StatusIndicator active={systemData.arduinoMega} label="Arduino" icon={Cpu} />
        <StatusIndicator active={systemData.raspberryPi} label="RPi 3B+" icon={Cpu} />
        <StatusIndicator active={systemData.hoverboardESC} label="ESC" icon={Gauge} />
        <StatusIndicator active={systemData.flySkyReceiver} label="FlySky RX" icon={Radio} />
        <StatusIndicator active={systemData.slushEngine} label="SlushEngine" icon={Cpu} />
      </div>
      
      <h3 className="text-[10px] font-display text-primary/80 mt-2 mb-1">SENSORS</h3>
      <div className="grid grid-cols-2 gap-1">
        <StatusIndicator active={systemData.lidar} label="TF Mini" icon={Navigation} />
        <StatusIndicator active={systemData.imu} label="MPU6050" icon={Thermometer} />
        <StatusIndicator active={systemData.gps} label="Neo-6M" icon={Navigation} />
        <StatusIndicator active={systemData.huskyLens} label="HuskyLens" icon={Eye} />
        <StatusIndicator active={systemData.cameraPanTilt} label="Pan/Tilt" icon={Camera} />
        <StatusIndicator active={systemData.batteryMonitor} label="BMS" icon={Battery} />
      </div>
      
      <h3 className="text-[10px] font-display text-primary/80 mt-2 mb-1">ULTRASONIC ARRAY</h3>
      <div className="flex gap-0.5 justify-between">
        {sensors.ultrasonic.map((val, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="h-8 w-full bg-card relative overflow-hidden rounded-sm border border-border">
              <div 
                className={`absolute bottom-0 w-full transition-all duration-300 ${val < 50 ? 'bg-destructive' : 'bg-secondary'}`}
                style={{ height: `${Math.min(100, (val / 200) * 100)}%` }}
              ></div>
            </div>
            <span className="text-[8px] font-mono text-foreground/70">{val.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
