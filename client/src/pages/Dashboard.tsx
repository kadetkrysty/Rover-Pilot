import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import SensorStatus from '@/components/SensorStatus';
import RadarScanner from '@/components/RadarScanner';
import PowerPanel from '@/components/PowerPanel';
import Joystick, { useJoystickData } from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import CameraPanTilt from '@/components/CameraPanTilt';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gauge, Compass, Activity } from 'lucide-react';

export default function Dashboard() {
  const data = useRoverData();
  const location = useLocation();
  const { data: joystickData, handleHeadingChange, reset } = useJoystickData();

  return (
    <div className="h-[calc(100dvh-56px)] bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Desktop Layout (≥1024px): 3 columns - strict viewport fit, NO scrolling */}
      <main className="hidden lg:grid grid-cols-12 gap-1.5 p-1.5 h-full">
        
        {/* Left Column - Core Systems, Camera Pan/Tilt, Camera Feed, Google Maps */}
        <div className="col-span-3 grid grid-rows-[auto_auto_auto_1fr] gap-1.5 min-h-0">
          {/* Core Systems */}
          <div className="hud-panel p-[10px] min-h-0 overflow-hidden max-h-[25vh]">
            <ScrollArea className="h-full w-full">
              <SensorStatus sensors={data.sensors} systems={data.systems} />
            </ScrollArea>
          </div>
          
          {/* Camera Pan/Tilt Panel - Moved under Core Systems */}
          <div className="hud-panel p-[10px]">
            <CameraPanTilt compact />
          </div>
          
          {/* Camera Feed */}
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
          </div>
          
          {/* Google Maps - Swapped from center */}
          <div className="hud-panel min-h-0 overflow-hidden">
            <RoverLocationMap 
              height="100%"
              showUserLocation
            />
          </div>
        </div>

        {/* Center Column - Proximity Radar */}
        <div className="col-span-6 min-h-0">
          {/* Proximity Radar */}
          <div className="hud-panel p-[10px] h-full overflow-hidden">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
          </div>
        </div>

        {/* Right Column - Power Status, Speed/Heading/Stability, GPS, Camera Pan/Tilt */}
        <div className="col-span-3 flex flex-col gap-1.5 min-h-0">
          {/* Power Status Panel - Full version with INA226 data */}
          <div className="hud-panel p-[10px] flex-shrink-0">
            <PowerPanel power={data.power} />
          </div>

          {/* Speed, Heading, Stability - 3 Column Layout */}
          <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
            {/* Speed Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Gauge className="w-3 h-3" /> SPD
              </div>
              <div className="text-center mt-1">
                <span className="text-xl font-mono font-bold text-foreground" data-testid="text-speed">{data.speed.toFixed(1)}</span>
                <div className="text-[8px] text-muted-foreground">KM/H</div>
              </div>
            </div>

            {/* Heading Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Compass className="w-3 h-3" /> HDG
              </div>
              <div className="text-center mt-1">
                <span className="text-xl font-mono font-bold text-foreground" data-testid="text-heading">{data.heading.toFixed(0)}°</span>
                <div className="text-[8px] text-muted-foreground">DEG</div>
              </div>
            </div>

            {/* Stability Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Activity className="w-3 h-3" /> STB
              </div>
              <div className="text-center mt-1">
                <div className="text-[9px] font-mono">
                  <span className="text-muted-foreground">P:</span>
                  <span className="text-foreground font-bold" data-testid="text-pitch">{data.pitch.toFixed(0)}°</span>
                </div>
                <div className="text-[9px] font-mono">
                  <span className="text-muted-foreground">R:</span>
                  <span className="text-foreground font-bold" data-testid="text-roll">{data.roll.toFixed(0)}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* GPS Localization Panel - Unchanged */}
          <div className="hud-panel p-[10px] flex-shrink-0">
            <h3 className="text-[10px] font-display text-primary/80 pb-2">GPS LOCALIZATION</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-card/50 border border-border rounded p-1.5">
                <div className="text-base font-mono text-foreground font-bold" data-testid="text-latitude">
                  {location.loading ? '---' : location.latitude?.toFixed(6) ?? '---'}
                </div>
                <div className="text-[8px] text-muted-foreground">LAT</div>
              </div>
              <div className="bg-card/50 border border-border rounded p-1.5">
                <div className="text-base font-mono text-foreground font-bold" data-testid="text-longitude">
                  {location.loading ? '---' : location.longitude?.toFixed(6) ?? '---'}
                </div>
                <div className="text-[8px] text-muted-foreground">LNG</div>
              </div>
            </div>
          </div>

          {/* Nav Control Panel - Moved from center column */}
          <div className="hud-panel navigation-control-panel p-[10px] flex-1 min-h-0" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex flex-col h-full">
              <div className="flex justify-between items-center pb-1">
                <h3 className="text-[10px] font-display text-primary/80">NAV CONTROL</h3>
                <div className="font-mono text-[10px] text-primary/80">
                  {joystickData.heading !== null ? `${joystickData.heading.toFixed(0)}° ${joystickData.cardinalDirection}` : '---'}
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
      </main>

      {/* Tablet Layout (640px - 1023px): 2 columns, scrollable */}
      <main className="hidden sm:grid lg:hidden grid-cols-2 gap-2 p-2 h-full overflow-y-auto">
        <div className="flex flex-col gap-2">
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
          </div>
          
          <div className="hud-panel p-[10px]">
            <PowerPanel power={data.power} />
          </div>
            
          <div className="hud-panel navigation-control-panel p-[10px] aspect-square max-h-[35vh]" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex flex-col h-full">
              <div className="flex justify-between items-center pb-1">
                <h3 className="text-[10px] font-display text-primary/80">NAV</h3>
                <div className="font-mono text-[10px] text-primary/80">
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
            
          <div className="hud-panel p-[10px]">
            <h3 className="text-[10px] font-display text-primary/80 pb-1">GPS / TELEMETRY</h3>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="text-xs font-mono font-bold">{location.latitude?.toFixed(4) ?? '--'}</div>
                <div className="text-[7px] text-muted-foreground">LAT</div>
              </div>
              <div>
                <div className="text-xs font-mono font-bold">{location.longitude?.toFixed(4) ?? '--'}</div>
                <div className="text-[7px] text-muted-foreground">LNG</div>
              </div>
              <div>
                <div className="text-xs font-mono font-bold">{data.speed.toFixed(1)}</div>
                <div className="text-[7px] text-muted-foreground">KM/H</div>
              </div>
              <div>
                <div className="text-xs font-mono text-primary font-bold">{data.heading.toFixed(0)}°</div>
                <div className="text-[7px] text-muted-foreground">HDG</div>
              </div>
            </div>
          </div>
            
          <div className="hud-panel p-[10px] flex-1 min-h-[30vh] overflow-hidden">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
          </div>
            
          <div className="hud-panel p-[10px] max-h-[20vh] overflow-hidden">
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
        
        <div className="hud-panel p-[10px]">
          <PowerPanel power={data.power} />
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="hud-panel p-[10px] text-center">
            <div className="text-xl font-mono font-bold">{data.speed.toFixed(1)}</div>
            <div className="text-[8px] text-muted-foreground">KM/H</div>
          </div>
          <div className="hud-panel p-[10px] text-center">
            <div className="text-lg font-mono text-primary font-bold">{data.heading.toFixed(0)}°</div>
            <div className="text-[8px] text-muted-foreground">HEADING</div>
          </div>
          <div className="hud-panel p-[10px] text-center">
            <div className="text-[10px] font-mono">P:{data.pitch.toFixed(0)}° R:{data.roll.toFixed(0)}°</div>
            <div className="text-[8px] text-muted-foreground">STABILITY</div>
          </div>
        </div>
        
        <div className="hud-panel p-[10px]">
          <h3 className="text-[10px] font-display text-primary/80 pb-1">GPS</h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-sm font-mono font-bold">{location.latitude?.toFixed(6) ?? '---'}</div>
              <div className="text-[8px] text-muted-foreground">LAT</div>
            </div>
            <div>
              <div className="text-sm font-mono font-bold">{location.longitude?.toFixed(6) ?? '---'}</div>
              <div className="text-[8px] text-muted-foreground">LNG</div>
            </div>
          </div>
        </div>
        
        <div className="hud-panel navigation-control-panel p-[10px] aspect-square" data-joystick-panel>
          <div className="map-background" aria-hidden="true"></div>
          <div className="panel-content flex flex-col h-full">
            <div className="flex justify-between items-center pb-1">
              <h3 className="text-[10px] font-display text-primary/80">NAVIGATION</h3>
              <div className="font-mono text-[10px] text-primary/80">
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
        
        <div className="hud-panel p-[10px] h-[35vh]">
          <RadarScanner 
            ultrasonicData={data.sensors.ultrasonic}
            lidarDistance={data.lidarDistance}
          />
        </div>
        
        <div className="hud-panel p-[10px]">
          <SensorStatus sensors={data.sensors} systems={data.systems} />
        </div>
      </main>
    </div>
  );
}
