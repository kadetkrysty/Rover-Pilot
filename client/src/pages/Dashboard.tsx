import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import TelemetryPanel from '@/components/TelemetryPanel';
import SensorStatus from '@/components/SensorStatus';
import RadarScanner from '@/components/RadarScanner';
import Joystick, { useJoystickData } from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function Dashboard() {
  const data = useRoverData();
  const location = useLocation();
  const { data: joystickData, handleHeadingChange, reset } = useJoystickData();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Main Grid */}
      <main className="grid grid-cols-12 gap-3 p-3 h-[calc(100vh-3.5rem)]">
        
        {/* Left Column: Status + Radar + Logs (3 cols) */}
        <div className="col-span-3 flex flex-col gap-3">
            {/* System Status */}
            <div className="hud-panel p-3 flex-shrink-0">
                <SensorStatus sensors={data.sensors} />
            </div>
            
            {/* Radar Scanner */}
            <div className="hud-panel p-3 flex-1 min-h-0 overflow-hidden">
                <RadarScanner 
                  ultrasonicData={data.sensors.ultrasonic}
                  lidarDistance={data.lidarDistance}
                />
            </div>
            
            {/* System Logs */}
            <div className="hud-panel p-3 flex-shrink-0" style={{ height: '150px' }}>
                <h3 className="text-xs font-display text-primary/50" style={{ paddingBottom: '12px' }}>SYSTEM LOGS</h3>
                <ScrollArea className="h-[100px] font-mono text-[10px] text-muted-foreground">
                    <div className="flex flex-col gap-1">
                        {data.log.map((entry, i) => (
                            <div key={i} className="border-l-2 border-primary/20 pl-2 py-0.5">{entry}</div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>

        {/* Center: Camera Feed + Map (6 cols) */}
        <div className="col-span-6 flex flex-col gap-3 h-full min-h-0">
             {/* Camera with 16:9 aspect ratio */}
             <div className="hud-panel flex-shrink-0 overflow-hidden">
                <AspectRatio ratio={16 / 9}>
                  <CameraFeed className="h-full" />
                </AspectRatio>
             </div>
             
             {/* Google Maps - Fill remaining height */}
             <div className="hud-panel flex-1 min-h-0 overflow-hidden">
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
                            {location.loading ? '---' : location.latitude?.toFixed(4) ?? '---'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">LATITUDE</div>
                    </div>
                    <div>
                        <div className="text-xl font-mono text-foreground font-bold" data-testid="text-longitude">
                            {location.loading ? '---' : location.longitude?.toFixed(4) ?? '---'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">LONGITUDE</div>
                    </div>
                </div>
            </div>

            {/* Joystick - Under GPS */}
            <div className="hud-panel navigation-control-panel p-3 flex-1 flex flex-col min-h-0" data-joystick-panel>
                <div className="map-background" aria-hidden="true"></div>
                <div className="panel-content flex flex-col h-full">
                    <div className="flex justify-between items-center" style={{ paddingBottom: '27px' }}>
                        <h3 className="text-xs font-display text-primary/50">NAVIGATION CONTROL</h3>
                        <div className="font-mono text-xs text-primary/80">
                            {joystickData.heading !== null ? (
                                <>{joystickData.heading.toFixed(0)}° {joystickData.cardinalDirection} | {(joystickData.magnitude * 100).toFixed(0)}%</>
                            ) : (
                                <>---° | 0%</>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center w-full">
                        <Joystick 
                          onMove={(x, y) => {
                            if (x === 0 && y === 0) reset();
                            console.log('Move:', x, y);
                          }} 
                          onHeadingChange={handleHeadingChange}
                          size="80%" 
                        />
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}
