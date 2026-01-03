import { Activity, Battery, Compass, MapPin, Gauge } from "lucide-react";
import { RoverData } from "@/lib/mockData";
import { Progress } from "@/components/ui/progress";

interface TelemetryPanelProps {
  data: RoverData;
  compact?: boolean;
}

export default function TelemetryPanel({ data, compact = false }: TelemetryPanelProps) {
  return (
    <div className={`grid grid-cols-2 h-full ${compact ? 'gap-2' : 'gap-4'}`}>
      {/* Speed */}
      <div className={`hud-panel flex flex-col justify-between group hover:border-primary/60 transition-colors ${compact ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-1 text-primary/70 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-sm'}`}>
          <Gauge className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> Speed
        </div>
        <div className="flex items-end gap-1">
          <span className={`font-mono font-bold text-foreground ${compact ? 'text-2xl' : 'text-4xl'}`}>{data.speed.toFixed(1)}</span>
          <span className={`text-muted-foreground mb-0.5 ${compact ? 'text-[10px]' : 'text-sm'}`}>km/h</span>
        </div>
        <Progress value={(data.speed / 20) * 100} className={`bg-primary/20 ${compact ? 'h-0.5 mt-1' : 'h-1 mt-2'}`} />
      </div>

      {/* Battery */}
      <div className={`hud-panel flex flex-col justify-between group hover:border-primary/60 transition-colors ${compact ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-1 text-primary/70 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-sm'}`}>
          <Battery className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> Power
        </div>
        <div className="flex items-end gap-1">
          <span className={`font-mono font-bold ${compact ? 'text-2xl' : 'text-4xl'} ${data.battery < 20 ? 'text-destructive' : 'text-foreground'}`}>
            {Math.floor(data.battery)}
          </span>
          <span className={`text-muted-foreground mb-0.5 ${compact ? 'text-[10px]' : 'text-sm'}`}>%</span>
        </div>
        <Progress 
          value={data.battery} 
          className={`bg-primary/20 [&>div]:bg-secondary ${compact ? 'h-0.5 mt-1' : 'h-1 mt-2'}`} 
        />
      </div>

      {/* Heading */}
      <div className={`hud-panel flex flex-col justify-between group hover:border-primary/60 transition-colors ${compact ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-1 text-primary/70 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-sm'}`}>
          <Compass className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> Heading
        </div>
        <div className="flex items-end gap-1">
          <span className={`font-mono font-bold text-foreground ${compact ? 'text-2xl' : 'text-4xl'}`}>{Math.floor(data.heading)}°</span>
          <span className={`text-muted-foreground mb-0.5 ${compact ? 'text-[10px]' : 'text-sm'}`}>N</span>
        </div>
        <div className={`w-full bg-primary/20 overflow-hidden flex items-center justify-center relative ${compact ? 'h-0.5 mt-1' : 'h-1 mt-2'}`}>
            <div className="w-1 h-2 bg-primary absolute" style={{ left: `${(data.heading / 360) * 100}%` }}></div>
        </div>
      </div>

      {/* Pitch/Roll */}
      <div className={`hud-panel flex flex-col justify-between group hover:border-primary/60 transition-colors ${compact ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-1 text-primary/70 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-sm'}`}>
          <Activity className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> Stability
        </div>
        <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1 mt-1'}`}>
            <div className={`flex justify-between font-mono text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
                <span>PITCH</span>
                <span className="text-foreground">{data.pitch.toFixed(1)}°</span>
            </div>
            <div className={`flex justify-between font-mono text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
                <span>ROLL</span>
                <span className="text-foreground">{data.roll.toFixed(1)}°</span>
            </div>
        </div>
      </div>
    </div>
  );
}
