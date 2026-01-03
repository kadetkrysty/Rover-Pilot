import { useRoverData } from '@/lib/mockData';
import CameraFeed from '@/components/CameraFeed';
import TelemetryPanel from '@/components/TelemetryPanel';
import SensorStatus from '@/components/SensorStatus';
import Joystick from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const data = useRoverData();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Main Grid */}
      <main className="grid grid-cols-12 gap-3 p-3 h-[calc(100vh-3.5rem)]">
        
        {/* Left Column: Status & Logs (3 cols) */}
        <div className="col-span-3 flex flex-col gap-3">
            <div className="hud-panel p-3 flex-1 overflow-hidden flex flex-col">
                <SensorStatus sensors={data.sensors} />
            </div>
            
            <div className="hud-panel p-3 h-[30%] flex flex-col">
                <h3 className="text-xs font-display text-primary/50" style={{ paddingBottom: '27px' }}>SYSTEM LOGS</h3>
                <ScrollArea className="flex-1 font-mono text-[10px] text-muted-foreground">
                    <div className="flex flex-col gap-1">
                        {data.log.map((entry, i) => (
                            <div key={i} className="border-l-2 border-primary/20 pl-2 py-0.5">{entry}</div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>

        {/* Center: Camera Feed + Map (6 cols) */}
        <div className="col-span-6 flex flex-col gap-3 relative">
             <div className="flex-[2] rounded-lg overflow-hidden relative group border border-border min-h-0">
                <CameraFeed />
             </div>
             
             {/* Google Maps - User Location */}
             <div className="flex-1 min-h-[180px]">
                <RoverLocationMap 
                  height="100%"
                  showUserLocation
                />
             </div>
        </div>

        {/* Right Column: Telemetry + GPS + Joystick (3 cols) */}
        <div className="col-span-3 flex flex-col gap-3">
            {/* Stats Panels */}
            <div className="hud-panel p-3 flex-shrink-0" style={{ minHeight: '180px' }}>
                <TelemetryPanel data={data} compact />
            </div>
            
            {/* GPS Localization */}
            <div className="hud-panel p-3 flex-shrink-0">
                <h3 className="text-xs font-display text-primary/50" style={{ paddingBottom: '27px' }}>GPS LOCALIZATION</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-xl font-mono text-foreground font-bold" data-testid="text-latitude">
                            {data.gps.lat.toFixed(4)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">LATITUDE</div>
                    </div>
                    <div>
                        <div className="text-xl font-mono text-foreground font-bold" data-testid="text-longitude">
                            {data.gps.lng.toFixed(4)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">LONGITUDE</div>
                    </div>
                </div>
            </div>

            {/* Joystick - Under GPS */}
            <div className="hud-panel p-3 flex-1 flex flex-col items-center justify-center min-h-0">
                <h3 className="text-xs font-display text-primary/50" style={{ paddingBottom: '27px' }}>NAVIGATION CONTROL</h3>
                <div className="flex-1 flex items-center justify-center w-full">
                    <Joystick onMove={(x, y) => console.log('Move:', x, y)} size="80%" />
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}
