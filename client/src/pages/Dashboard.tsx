import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import SensorStatus from '@/components/SensorStatus';
import RadarScanner from '@/components/RadarScanner';
import Joystick, { useJoystickData } from '@/components/Joystick';
import RoverLocationMap from '@/components/RoverLocationMap';
import CameraPanTilt from '@/components/CameraPanTilt';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gauge, Compass, Activity, Battery, Zap, Clock, Route } from 'lucide-react';

export default function Dashboard() {
  const data = useRoverData();
  const location = useLocation();
  const { data: joystickData, handleHeadingChange, reset } = useJoystickData();

  return (
    <div className="h-[calc(100dvh-56px)] bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative" data-testid="page-dashboard">
      <div className="scanline"></div>

      {/* Desktop Layout (≥1024px): 3 columns - strict viewport fit, NO scrolling */}
      <main className="hidden lg:grid grid-cols-12 gap-1.5 p-1.5 h-full">
        
        {/* Left Column - Core Systems + Camera Feed */}
        <div className="col-span-3 grid grid-rows-[auto_1fr_auto] gap-1.5 min-h-0">
          <div className="hud-panel p-[10px] min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <SensorStatus sensors={data.sensors} systems={data.systems} />
            </ScrollArea>
          </div>
          
          {/* Camera Feed - Moved under Core Systems */}
          <div className="hud-panel overflow-hidden min-h-0">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed className="h-full" />
            </AspectRatio>
          </div>
          
          {/* Camera Pan/Tilt */}
          <div className="hud-panel p-[10px]">
            <CameraPanTilt compact />
          </div>
        </div>

        {/* Center Column - Google Maps (swapped) */}
        <div className="col-span-6 grid grid-rows-[1fr_auto] gap-1.5 min-h-0">
          <div className="hud-panel min-h-0 overflow-hidden">
            <RoverLocationMap 
              height="100%"
              showUserLocation
            />
          </div>
             
          {/* Nav Control Panel */}
          <div className="hud-panel navigation-control-panel p-[10px] h-[120px]" data-joystick-panel>
            <div className="map-background" aria-hidden="true"></div>
            <div className="panel-content flex h-full gap-4">
              <div className="flex-1 flex items-center justify-center">
                <Joystick 
                  onMove={(x, y) => { if (x === 0 && y === 0) reset(); }} 
                  onHeadingChange={handleHeadingChange}
                  size="100px" 
                />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-[10px] font-display text-primary/80 mb-1">NAV CONTROL</h3>
                <div className="font-mono text-lg text-primary font-bold">
                  {joystickData.heading !== null ? `${joystickData.heading.toFixed(0)}°` : '---'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {joystickData.cardinalDirection || '---'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Power, Telemetry, Radar (swapped) */}
        <div className="col-span-3 flex flex-col gap-1.5 min-h-0">
          
          {/* Power Status Panel - INA226 Integration */}
          <div className="hud-panel p-[10px] flex-shrink-0">
            <h3 className="text-[10px] font-display text-primary/80 pb-2 flex items-center gap-1">
              <Battery className="w-3 h-3" /> POWER STATUS
            </h3>
            <div className="flex items-center gap-3 mb-2">
              {/* Battery Indicator */}
              <div className="relative w-12 h-20 border-2 border-primary/50 rounded-sm bg-black/30">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-1.5 bg-primary/50 rounded-t-sm"></div>
                <div 
                  className="absolute bottom-0.5 left-0.5 right-0.5 bg-gradient-to-t from-secondary to-secondary/60 rounded-sm transition-all"
                  style={{ height: `${Math.min(100, data.power.batteryPercent)}%` }}
                ></div>
              </div>
              {/* Battery Percentage */}
              <div>
                <div className="text-3xl font-mono font-bold text-secondary" data-testid="text-battery-percent">
                  {data.power.batteryPercent.toFixed(0)}%
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  {data.power.batteryVoltage.toFixed(1)}V / 6S
                </div>
              </div>
            </div>
            {/* INA226 Metrics */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-card/50 border border-border rounded p-1.5 text-center">
                <div className="flex items-center justify-center gap-0.5 text-primary/60 mb-0.5">
                  <Zap className="w-2.5 h-2.5" />
                </div>
                <div className="text-sm font-mono font-bold text-foreground" data-testid="text-power-watts">
                  {data.power.powerConsumptionW.toFixed(0)}W
                </div>
                <div className="text-[7px] text-muted-foreground uppercase">Power</div>
              </div>
              <div className="bg-card/50 border border-border rounded p-1.5 text-center">
                <div className="flex items-center justify-center gap-0.5 text-primary/60 mb-0.5">
                  <Zap className="w-2.5 h-2.5" />
                </div>
                <div className="text-sm font-mono font-bold text-foreground" data-testid="text-current-amps">
                  {data.power.batteryCurrent.toFixed(1)}A
                </div>
                <div className="text-[7px] text-muted-foreground uppercase">Current</div>
              </div>
              <div className="bg-card/50 border border-border rounded p-1.5 text-center">
                <div className="flex items-center justify-center gap-0.5 text-primary/60 mb-0.5">
                  <Route className="w-2.5 h-2.5" />
                </div>
                <div className="text-sm font-mono font-bold text-foreground" data-testid="text-distance">
                  {data.power.estimatedRangeKm.toFixed(1)}km
                </div>
                <div className="text-[7px] text-muted-foreground uppercase">Range</div>
              </div>
            </div>
            {/* Runtime */}
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>EST. RUNTIME</span>
              </div>
              <span className="text-secondary font-bold" data-testid="text-runtime">
                {Math.floor(data.power.estimatedRuntimeMin / 60)}h {(data.power.estimatedRuntimeMin % 60).toFixed(0)}m
              </span>
            </div>
          </div>

          {/* Speed, Heading, Stability - 3 Column Layout */}
          <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
            {/* Speed Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Gauge className="w-3 h-3" />
              </div>
              <div className="text-center mt-1">
                <span className="text-xl font-mono font-bold text-foreground" data-testid="text-speed">{data.speed.toFixed(1)}</span>
                <div className="text-[8px] text-muted-foreground">KM/H</div>
              </div>
            </div>

            {/* Heading Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Compass className="w-3 h-3" />
              </div>
              <div className="text-center mt-1">
                <span className="text-xl font-mono font-bold text-foreground" data-testid="text-heading">{data.heading.toFixed(0)}°</span>
                <div className="text-[8px] text-muted-foreground">HDG</div>
              </div>
            </div>

            {/* Stability Panel */}
            <div className="hud-panel p-[10px] flex flex-col justify-between group hover:border-primary/60 transition-colors">
              <div className="flex items-center gap-1 text-primary/80 uppercase tracking-wider font-display text-[9px]">
                <Activity className="w-3 h-3" />
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

          {/* GPS Localization Panel */}
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

          {/* Proximity Radar - Swapped position */}
          <div className="hud-panel p-[10px] flex-1 min-h-0 overflow-hidden">
            <RadarScanner 
              ultrasonicData={data.sensors.ultrasonic}
              lidarDistance={data.lidarDistance}
            />
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
            <h3 className="text-[10px] font-display text-primary/80 pb-2 flex items-center gap-1">
              <Battery className="w-3 h-3" /> POWER STATUS
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-10 h-16 border-2 border-primary/50 rounded-sm bg-black/30">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-primary/50 rounded-t-sm"></div>
                <div 
                  className="absolute bottom-0.5 left-0.5 right-0.5 bg-gradient-to-t from-secondary to-secondary/60 rounded-sm"
                  style={{ height: `${Math.min(100, data.power.batteryPercent)}%` }}
                ></div>
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-secondary">{data.power.batteryPercent.toFixed(0)}%</div>
                <div className="text-[9px] text-muted-foreground font-mono">{data.power.batteryVoltage.toFixed(1)}V</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-mono">
              <div><span className="text-foreground font-bold">{data.power.powerConsumptionW.toFixed(0)}W</span></div>
              <div><span className="text-foreground font-bold">{data.power.batteryCurrent.toFixed(1)}A</span></div>
              <div><span className="text-secondary font-bold">{data.power.estimatedRuntimeMin.toFixed(0)}m</span></div>
            </div>
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
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-10 h-16 border-2 border-primary/50 rounded-sm bg-black/30">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-primary/50 rounded-t-sm"></div>
              <div 
                className="absolute bottom-0.5 left-0.5 right-0.5 bg-gradient-to-t from-secondary to-secondary/60 rounded-sm"
                style={{ height: `${Math.min(100, data.power.batteryPercent)}%` }}
              ></div>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-mono font-bold text-secondary">{data.power.batteryPercent.toFixed(0)}%</div>
              <div className="text-[9px] text-muted-foreground font-mono">{data.power.batteryVoltage.toFixed(1)}V / 6S</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-foreground">{data.power.powerConsumptionW.toFixed(0)}W</div>
              <div className="text-[9px] text-muted-foreground">{data.power.batteryCurrent.toFixed(1)}A</div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>EST. RUNTIME</span>
            <span className="text-secondary font-bold">{data.power.estimatedRuntimeMin.toFixed(0)}min</span>
          </div>
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
