import { useRoverData } from '@/lib/mockData';
import CameraFeed from '@/components/CameraFeed';
import TelemetryPanel from '@/components/TelemetryPanel';
import SensorStatus from '@/components/SensorStatus';
import Joystick from '@/components/Joystick';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wifi, Settings, FileText, Power, Activity } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const data = useRoverData();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden relative">
      <div className="scanline"></div>
      
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur px-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-display font-bold tracking-widest text-primary flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_var(--primary)]"></div>
                ROVER<span className="text-foreground">OS</span> v2.4
            </h1>
            <div className="h-6 w-[1px] bg-border mx-2"></div>
            <div className="flex items-center gap-2 text-xs font-mono text-secondary">
                <Wifi className="w-3 h-3" />
                CONNECTED: ROVER-AP-5G
            </div>
        </div>
        
        <nav className="flex items-center gap-2">
            <Link href="/gamepad">
                <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary hover:bg-primary/10">
                    <FileText className="w-4 h-4 mr-2" /> GAMEPAD
                </Button>
            </Link>
            <Link href="/navigation">
                <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary hover:bg-primary/10">
                    <FileText className="w-4 h-4 mr-2" /> NAVIGATION
                </Button>
            </Link>
            <Link href="/diagnostics">
                <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary hover:bg-primary/10">
                    <Activity className="w-4 h-4 mr-2" /> DIAGNOSTICS
                </Button>
            </Link>
            <Link href="/docs">
                <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary hover:bg-primary/10">
                    <FileText className="w-4 h-4 mr-2" /> SYSTEM_DOCS
                </Button>
            </Link>
            <Link href="/setup">
                <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary hover:bg-primary/10">
                    <Settings className="w-4 h-4 mr-2" /> CONFIG
                </Button>
            </Link>
             <Button variant="destructive" size="sm" className="font-mono text-xs opacity-80 hover:opacity-100">
                <Power className="w-4 h-4 mr-2" /> E-STOP
            </Button>
        </nav>
      </header>

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
