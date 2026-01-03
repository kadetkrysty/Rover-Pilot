import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import TelemetryPanel from '@/components/TelemetryPanel';
import SensorStatus from '@/components/SensorStatus';
import RadarScanner from '@/components/RadarScanner';
import Joystick, { useJoystickData } from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function Dashboard() {
  const data = useRoverData();
  const location = useLocation();
  const { data: joystickData, handleHeadingChange, reset } = useJoystickData();

  return (
    <div className="h-dvh bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Desktop Layout (≥1024px): 3 columns that fit viewport */}
      <main className="hidden lg:grid grid-cols-12 gap-2 p-2 h-full">
        
        {/* Left Column: Status + Radar */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
            <div className="hud-panel p-2 flex-shrink-0 overflow-auto max-h-[35%]">
                <SensorStatus sensors={data.sensors} />
            </div>
            
            <div className="hud-panel p-2 flex-1 min-h-0 overflow-hidden">
                <RadarScanner 
                  ultrasonicData={data.sensors.ultrasonic}
                  lidarDistance={data.lidarDistance}
                />
            </div>
        </div>

        {/* Center: Camera Feed + Map */}
        <div className="col-span-6 flex flex-col gap-2 min-h-0">
             <div className="hud-panel flex-shrink-0 overflow-hidden">
                <AspectRatio ratio={16 / 9}>
                  <CameraFeed className="h-full" />
                </AspectRatio>
             </div>
             
             <div className="hud-panel flex-1 min-h-0 overflow-hidden">
                <RoverLocationMap 
                  height="100%"
                  showUserLocation
                />
             </div>
        </div>

        {/* Right Column: Telemetry + GPS + Joystick */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
            <div className="hud-panel p-2 flex-shrink-0">
                <TelemetryPanel data={data} compact />
            </div>
            
            <div className="hud-panel p-2 flex-shrink-0">
                <h3 className="text-[10px] font-display text-primary/50 pb-2">GPS LOCALIZATION</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-lg font-mono text-foreground font-bold" data-testid="text-latitude">
                            {location.loading ? '---' : location.latitude?.toFixed(4) ?? '---'}
                        </div>
                        <div className="text-[9px] text-muted-foreground">LAT</div>
                    </div>
                    <div>
                        <div className="text-lg font-mono text-foreground font-bold" data-testid="text-longitude">
                            {location.loading ? '---' : location.longitude?.toFixed(4) ?? '---'}
                        </div>
                        <div className="text-[9px] text-muted-foreground">LNG</div>
                    </div>
                </div>
            </div>

            <div className="hud-panel navigation-control-panel p-2 flex-1 flex flex-col min-h-0" data-joystick-panel>
                <div className="map-background" aria-hidden="true"></div>
                <div className="panel-content flex flex-col h-full min-h-0">
                    <div className="flex justify-between items-center pb-2">
                        <h3 className="text-[10px] font-display text-primary/50">NAV CONTROL</h3>
                        <div className="font-mono text-[10px] text-primary/80">
                            {joystickData.heading !== null ? (
                                <>{joystickData.heading.toFixed(0)}° {joystickData.cardinalDirection}</>
                            ) : (
                                <>---°</>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-0">
                        <Joystick 
                          onMove={(x, y) => {
                            if (x === 0 && y === 0) reset();
                          }} 
                          onHeadingChange={handleHeadingChange}
                          size="85%" 
                        />
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* Tablet Layout (640px - 1023px): 2 columns */}
      <main className="hidden sm:grid lg:hidden grid-cols-2 gap-2 p-2 h-full overflow-y-auto">
        {/* Left Column */}
        <div className="flex flex-col gap-2 min-h-0">
            <div className="hud-panel flex-shrink-0 overflow-hidden">
                <AspectRatio ratio={16 / 9}>
                  <CameraFeed className="h-full" />
                </AspectRatio>
            </div>
            
            <div className="hud-panel p-2 flex-shrink-0">
                <TelemetryPanel data={data} compact />
            </div>
            
            <div className="hud-panel navigation-control-panel p-2 aspect-square max-h-[40vh]" data-joystick-panel>
                <div className="map-background" aria-hidden="true"></div>
                <div className="panel-content flex flex-col h-full">
                    <div className="flex justify-between items-center pb-1">
                        <h3 className="text-[10px] font-display text-primary/50">NAV</h3>
                        <div className="font-mono text-[9px] text-primary/80">
                            {joystickData.heading !== null ? (
                                <>{joystickData.heading.toFixed(0)}°</>
                            ) : (
                                <>---°</>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <Joystick 
                          onMove={(x, y) => {
                            if (x === 0 && y === 0) reset();
                          }} 
                          onHeadingChange={handleHeadingChange}
                          size="90%" 
                        />
                    </div>
                </div>
            </div>
        </div>
        
        {/* Right Column */}
        <div className="flex flex-col gap-2 min-h-0">
            <div className="hud-panel h-[30vh] overflow-hidden">
                <RoverLocationMap 
                  height="100%"
                  showUserLocation
                />
            </div>
            
            <div className="hud-panel p-2 flex-shrink-0">
                <h3 className="text-[9px] font-display text-primary/50 pb-1">GPS</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-base font-mono text-foreground font-bold">
                            {location.loading ? '---' : location.latitude?.toFixed(3) ?? '---'}
                        </div>
                        <div className="text-[8px] text-muted-foreground">LAT</div>
                    </div>
                    <div>
                        <div className="text-base font-mono text-foreground font-bold">
                            {location.loading ? '---' : location.longitude?.toFixed(3) ?? '---'}
                        </div>
                        <div className="text-[8px] text-muted-foreground">LNG</div>
                    </div>
                </div>
            </div>
            
            <div className="hud-panel p-2 flex-1 min-h-[25vh] overflow-hidden">
                <RadarScanner 
                  ultrasonicData={data.sensors.ultrasonic}
                  lidarDistance={data.lidarDistance}
                />
            </div>
            
            <div className="hud-panel p-2 flex-shrink-0">
                <SensorStatus sensors={data.sensors} />
            </div>
        </div>
      </main>

      {/* Mobile Layout (<640px): Single column stacked */}
      <main className="sm:hidden flex flex-col gap-2 p-2 h-full overflow-y-auto">
        {/* Camera */}
        <div className="hud-panel flex-shrink-0 overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
        </div>
        
        {/* Telemetry + GPS Row */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
            <div className="hud-panel p-2">
                <div className="text-center">
                    <div className="text-xl font-mono text-foreground font-bold">{data.speed.toFixed(1)}</div>
                    <div className="text-[8px] text-muted-foreground">KM/H</div>
                </div>
                <div className="text-center mt-1">
                    <div className="text-lg font-mono text-secondary font-bold">{data.battery.toFixed(0)}%</div>
                    <div className="text-[8px] text-muted-foreground">BAT</div>
                </div>
            </div>
            <div className="hud-panel p-2">
                <div className="text-center">
                    <div className="text-sm font-mono text-foreground font-bold">
                        {location.loading ? '---' : location.latitude?.toFixed(3) ?? '---'}
                    </div>
                    <div className="text-[8px] text-muted-foreground">LAT</div>
                </div>
                <div className="text-center mt-1">
                    <div className="text-sm font-mono text-foreground font-bold">
                        {location.loading ? '---' : location.longitude?.toFixed(3) ?? '---'}
                    </div>
                    <div className="text-[8px] text-muted-foreground">LNG</div>
                </div>
            </div>
        </div>
        
        {/* Joystick */}
        <div className="hud-panel navigation-control-panel p-2 flex-shrink-0 aspect-square" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex flex-col h-full">
                <div className="flex justify-between items-center pb-1">
                    <h3 className="text-[10px] font-display text-primary/50">NAVIGATION</h3>
                    <div className="font-mono text-[10px] text-primary/80">
                        {joystickData.heading !== null ? (
                            <>{joystickData.heading.toFixed(0)}° {joystickData.cardinalDirection}</>
                        ) : (
                            <>---°</>
                        )}
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <Joystick 
                      onMove={(x, y) => {
                        if (x === 0 && y === 0) reset();
                      }} 
                      onHeadingChange={handleHeadingChange}
                      size="95%" 
                    />
                </div>
            </div>
        </div>
        
        {/* Map */}
        <div className="hud-panel flex-shrink-0 overflow-hidden h-[30vh]">
            <RoverLocationMap 
              height="100%"
              showUserLocation
            />
        </div>
        
        {/* Radar */}
        <div className="hud-panel p-2 flex-shrink-0 h-[40vh]">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
        </div>
        
        {/* Sensor Status */}
        <div className="hud-panel p-2 flex-shrink-0">
            <SensorStatus sensors={data.sensors} />
        </div>
      </main>
    </div>
  );
}
