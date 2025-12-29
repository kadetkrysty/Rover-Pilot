import { Activity, Battery, Compass, MapPin, Gauge } from "lucide-react";
import { RoverData } from "@/lib/mockData";
import { Progress } from "@/components/ui/progress";

interface TelemetryPanelProps {
  data: RoverData;
}

export default function TelemetryPanel({ data }: TelemetryPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Speed */}
      <div className="hud-panel p-4 flex flex-col justify-between group hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-primary/70 text-sm uppercase tracking-wider">
          <Gauge className="w-4 h-4" /> Speed
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-mono font-bold text-foreground">{data.speed.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground mb-1">km/h</span>
        </div>
        <Progress value={(data.speed / 20) * 100} className="h-1 mt-2 bg-primary/20" />
      </div>

      {/* Battery */}
      <div className="hud-panel p-4 flex flex-col justify-between group hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-primary/70 text-sm uppercase tracking-wider">
          <Battery className="w-4 h-4" /> Power
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-mono font-bold ${data.battery < 20 ? 'text-destructive' : 'text-foreground'}`}>
            {Math.floor(data.battery)}
          </span>
          <span className="text-sm text-muted-foreground mb-1">%</span>
        </div>
        <Progress 
          value={data.battery} 
          className={`h-1 mt-2 bg-primary/20 [&>div]:bg-secondary`} 
        />
      </div>

      {/* Heading */}
      <div className="hud-panel p-4 flex flex-col justify-between group hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-primary/70 text-sm uppercase tracking-wider">
          <Compass className="w-4 h-4" /> Heading
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-mono font-bold text-foreground">{Math.floor(data.heading)}°</span>
          <span className="text-sm text-muted-foreground mb-1">N</span>
        </div>
        <div className="w-full h-1 bg-primary/20 mt-2 overflow-hidden flex items-center justify-center relative">
            <div className="w-1 h-2 bg-primary absolute" style={{ left: `${(data.heading / 360) * 100}%` }}></div>
        </div>
      </div>

      {/* Pitch/Roll */}
      <div className="hud-panel p-4 flex flex-col justify-between group hover:border-primary/60 transition-colors">
        <div className="flex items-center gap-2 text-primary/70 text-sm uppercase tracking-wider">
          <Activity className="w-4 h-4" /> Stability
        </div>
        <div className="flex flex-col gap-1 mt-1">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span>PITCH</span>
                <span className="text-foreground">{data.pitch.toFixed(1)}°</span>
            </div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span>ROLL</span>
                <span className="text-foreground">{data.roll.toFixed(1)}°</span>
            </div>
        </div>
      </div>
    </div>
  );
}
