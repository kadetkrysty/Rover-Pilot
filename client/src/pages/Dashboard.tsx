import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import SensorStatus from '@/components/SensorStatus';
import RadarScanner from '@/components/RadarScanner';
import PowerPanel from '@/components/PowerPanel';
import Joystick, { useJoystickData } from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const data = useRoverData();
  const location = useLocation();
  const { data: joystickData, handleHeadingChange, reset } = useJoystickData();

  return (
    <div className="h-[calc(100dvh-56px)] bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Desktop Layout (≥1024px): 3 columns - strict viewport fit, NO scrolling */}
      <main className="hidden lg:grid grid-cols-12 gap-1 p-1 h-full">
        
        {/* Left Column */}
        <div className="col-span-3 grid grid-rows-[2fr_3fr] gap-1 min-h-0">
          <div className="hud-panel p-1.5 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <SensorStatus sensors={data.sensors} systems={data.systems} />
            </ScrollArea>
          </div>
            
          <div className="hud-panel p-1.5 min-h-0 overflow-hidden">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
          </div>
        </div>

        {/* Center Column */}
        <div className="col-span-6 grid grid-rows-[auto_1fr] gap-1 min-h-0">
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
          </div>
             
          <div className="hud-panel min-h-0 overflow-hidden">
            <RoverLocationMap 
              height="100%"
              showUserLocation
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-3 grid grid-rows-[auto_auto_1fr] gap-1 min-h-0">
          <div className="hud-panel p-1.5 overflow-hidden">
            <PowerPanel power={data.power} />
          </div>
            
          <div className="hud-panel p-1">
            <div className="grid grid-cols-4 gap-0.5">
              <div className="bg-card/50 p-0.5 rounded border border-border text-center">
                <div className="text-[10px] font-mono text-foreground font-bold" data-testid="text-latitude">
                  {location.loading ? '--' : location.latitude?.toFixed(2) ?? '--'}
                </div>
                <div className="text-[5px] text-muted-foreground">LAT</div>
              </div>
              <div className="bg-card/50 p-0.5 rounded border border-border text-center">
                <div className="text-[10px] font-mono text-foreground font-bold" data-testid="text-longitude">
                  {location.loading ? '--' : location.longitude?.toFixed(2) ?? '--'}
                </div>
                <div className="text-[5px] text-muted-foreground">LNG</div>
              </div>
              <div className="bg-card/50 p-0.5 rounded border border-border text-center">
                <div className="text-[10px] font-mono text-foreground font-bold">{data.speed.toFixed(1)}</div>
                <div className="text-[5px] text-muted-foreground">KM/H</div>
              </div>
              <div className="bg-card/50 p-0.5 rounded border border-border text-center">
                <div className="text-[10px] font-mono text-primary font-bold">{data.heading.toFixed(0)}°</div>
                <div className="text-[5px] text-muted-foreground">HDG</div>
              </div>
            </div>
          </div>

          <div className="hud-panel navigation-control-panel p-1 min-h-0 overflow-hidden" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex flex-col h-full">
              <div className="flex justify-between items-center">
                <h3 className="text-[6px] font-display text-primary/50">NAV</h3>
                <div className="font-mono text-[6px] text-primary/80">
                  {joystickData.heading !== null ? `${joystickData.heading.toFixed(0)}°` : '---'}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <Joystick 
                  onMove={(x, y) => { if (x === 0 && y === 0) reset(); }} 
                  onHeadingChange={handleHeadingChange}
                  size="95%" 
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tablet Layout (640px - 1023px): 2 columns, scrollable */}
      <main className="hidden sm:grid lg:hidden grid-cols-2 gap-2 p-2 h-full overflow-y-auto">
        <div className="flex flex-col gap-2">
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
          </div>
          
          <div className="hud-panel p-2">
            <PowerPanel power={data.power} />
          </div>
            
          <div className="hud-panel navigation-control-panel p-2 aspect-square max-h-[35vh]" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex flex-col h-full">
              <div className="flex justify-between items-center pb-1">
                <h3 className="text-[9px] font-display text-primary/50">NAV</h3>
                <div className="font-mono text-[8px] text-primary/80">
                  {joystickData.heading !== null ? `${joystickData.heading.toFixed(0)}°` : '---'}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <Joystick 
                  onMove={(x, y) => { if (x === 0 && y === 0) reset(); }} 
                  onHeadingChange={handleHeadingChange}
                  size="90%" 
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="hud-panel h-[25vh] overflow-hidden">
            <RoverLocationMap height="100%" showUserLocation />
          </div>
            
          <div className="hud-panel p-2">
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="text-xs font-mono font-bold">{location.latitude?.toFixed(2) ?? '--'}</div>
                <div className="text-[6px] text-muted-foreground">LAT</div>
              </div>
              <div>
                <div className="text-xs font-mono font-bold">{location.longitude?.toFixed(2) ?? '--'}</div>
                <div className="text-[6px] text-muted-foreground">LNG</div>
              </div>
              <div>
                <div className="text-xs font-mono font-bold">{data.speed.toFixed(1)}</div>
                <div className="text-[6px] text-muted-foreground">KM/H</div>
              </div>
              <div>
                <div className="text-xs font-mono text-primary font-bold">{data.heading.toFixed(0)}°</div>
                <div className="text-[6px] text-muted-foreground">HDG</div>
              </div>
            </div>
          </div>
            
          <div className="hud-panel p-2 flex-1 min-h-[30vh] overflow-hidden">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
          </div>
            
          <div className="hud-panel p-2 max-h-[20vh] overflow-hidden">
            <ScrollArea className="h-full">
              <SensorStatus sensors={data.sensors} systems={data.systems} />
            </ScrollArea>
          </div>
        </div>
      </main>

      {/* Mobile Layout (<640px): Single column, scrollable */}
      <main className="sm:hidden flex flex-col gap-2 p-2 h-full overflow-y-auto">
        <div className="hud-panel overflow-hidden">
          <AspectRatio ratio={16 / 9}>
            <CameraFeed className="h-full" />
          </AspectRatio>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="hud-panel p-2 text-center">
            <div className="text-xl font-mono text-secondary font-bold">{data.power.batteryPercent.toFixed(0)}%</div>
            <div className="text-[7px] text-muted-foreground">BATTERY</div>
            <div className="text-sm font-mono mt-1">{data.power.estimatedRuntimeMin.toFixed(0)}min</div>
            <div className="text-[7px] text-muted-foreground">RUNTIME</div>
          </div>
          <div className="hud-panel p-2 text-center">
            <div className="text-sm font-mono font-bold">{location.latitude?.toFixed(3) ?? '---'}</div>
            <div className="text-[7px] text-muted-foreground">LAT</div>
            <div className="text-sm font-mono font-bold mt-1">{location.longitude?.toFixed(3) ?? '---'}</div>
            <div className="text-[7px] text-muted-foreground">LNG</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="hud-panel p-2 text-center">
            <div className="text-xl font-mono font-bold">{data.speed.toFixed(1)}</div>
            <div className="text-[7px] text-muted-foreground">KM/H</div>
          </div>
          <div className="hud-panel p-2 text-center">
            <div className="text-lg font-mono text-primary font-bold">{data.heading.toFixed(0)}°</div>
            <div className="text-[7px] text-muted-foreground">HEADING</div>
          </div>
        </div>
        
        <div className="hud-panel navigation-control-panel p-2 aspect-square" data-joystick-panel>
          <div className="map-background" aria-hidden="true"></div>
          <div className="panel-content flex flex-col h-full">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-[9px] font-display text-primary/50">NAVIGATION</h3>
              <div className="font-mono text-[9px] text-primary/80">
                {joystickData.heading !== null ? `${joystickData.heading.toFixed(0)}° ${joystickData.cardinalDirection}` : '---'}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <Joystick 
                onMove={(x, y) => { if (x === 0 && y === 0) reset(); }} 
                onHeadingChange={handleHeadingChange}
                size="95%" 
              />
            </div>
          </div>
        </div>
        
        <div className="hud-panel h-[25vh] overflow-hidden">
          <RoverLocationMap height="100%" showUserLocation />
        </div>
        
        <div className="hud-panel p-2 h-[35vh]">
          <RadarScanner 
            ultrasonicData={data.sensors.ultrasonic}
            lidarDistance={data.lidarDistance}
          />
        </div>
        
        <div className="hud-panel p-2">
          <SensorStatus sensors={data.sensors} systems={data.systems} />
        </div>
      </main>
    </div>
  );
}
