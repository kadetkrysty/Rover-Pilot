import { Check, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { RoverData } from "@/lib/mockData";

interface SensorStatusProps {
  sensors: RoverData['sensors'];
}

function StatusIndicator({ active, label }: { active: boolean; label: string }) {
    return (
        <div className="flex items-center justify-between p-2 border border-border bg-card/50 rounded hover:bg-card hover:border-primary/40 transition-all">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
            {active ? (
                <div className="flex items-center gap-1 text-secondary text-xs">
                    <span>OK</span>
                    <Check className="w-3 h-3" />
                </div>
            ) : (
                <div className="flex items-center gap-1 text-destructive text-xs">
                    <span>ERR</span>
                    <XCircle className="w-3 h-3" />
                </div>
            )}
        </div>
    )
}

export default function SensorStatus({ sensors }: SensorStatusProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <h3 className="text-xs font-display text-primary/50 mb-1">SYSTEM STATUS</h3>
      <StatusIndicator active={sensors.huskyLens} label="Husky Lens AI" />
      <StatusIndicator active={sensors.lidar} label="TF Mini Lidar" />
      <StatusIndicator active={sensors.imu} label="IMU (MPU6050)" />
      <StatusIndicator active={sensors.gps} label="GPS Module" />
      <StatusIndicator active={true} label="Hoverboard ESC" />
      
      <div className="mt-4">
        <h3 className="text-xs font-display text-primary/50 mb-2">ULTRASONIC ARRAY</h3>
        <div className="flex gap-1 justify-between">
            {sensors.ultrasonic.map((val, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="h-16 w-full bg-card relative overflow-hidden rounded-sm border border-border">
                        <div 
                            className={`absolute bottom-0 w-full transition-all duration-300 ${val < 50 ? 'bg-destructive' : 'bg-secondary'}`}
                            style={{ height: `${Math.min(100, (val / 200) * 100)}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{val.toFixed(0)}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
