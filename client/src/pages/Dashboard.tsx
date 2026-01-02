import { useRoverData } from '@/lib/mockData';
import CameraFeed from '@/components/CameraFeed';
import TelemetryPanel from '@/components/TelemetryPanel';
import SensorStatus from '@/components/SensorStatus';
import Joystick from '@/components/Joystick';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const data = useRoverData();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Main Grid */}
      <main className="grid grid-cols-12 gap-4 p-4 h-[calc(100vh-3.5rem)]">
        
        {/* Left Column: Status & Map (3 cols) */}
        <div className="col-span-3 flex flex-col gap-4">
            <div className="hud-panel p-4 flex-1 overflow-hidden flex flex-col">
                <SensorStatus sensors={data.sensors} />
            </div>
            
            <div className="hud-panel p-4 h-1/3 flex flex-col">
                <h3 className="text-xs font-display text-primary/50 mb-2">SYSTEM LOGS</h3>
                <ScrollArea className="flex-1 font-mono text-[10px] text-muted-foreground">
                    <div className="flex flex-col gap-1">
                        {data.log.map((entry, i) => (
                            <div key={i} className="border-l-2 border-primary/20 pl-2 py-0.5">{entry}</div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>

        {/* Center: Camera Feed (6 cols) */}
        <div className="col-span-6 flex flex-col gap-4 relative">
             <div className="flex-1 rounded-lg overflow-hidden relative group border border-border">
                <CameraFeed />
                
                {/* Overlay Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                     <Joystick onMove={(x, y) => console.log(x, y)} />
                </div>
             </div>
        </div>

        {/* Right Column: Telemetry (3 cols) */}
        <div className="col-span-3 flex flex-col gap-4">
            <div className="hud-panel p-2 flex-1">
                <TelemetryPanel data={data} />
            </div>
             <div className="hud-panel p-4 h-1/4">
                <h3 className="text-xs font-display text-primary/50 mb-2">GPS LOCALIZATION</h3>
                <div className="text-2xl font-mono text-foreground font-bold">{data.gps.lat.toFixed(4)}</div>
                <div className="text-xs text-muted-foreground mb-2">LATITUDE</div>
                <div className="text-2xl font-mono text-foreground font-bold">{data.gps.lng.toFixed(4)}</div>
                 <div className="text-xs text-muted-foreground">LONGITUDE</div>
            </div>
        </div>

      </main>
    </div>
  );
}
