import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { 
  Wifi, Settings, FileText, Power, Activity, Radio, Map, 
  Gamepad2, Video, Cloud, Menu 
} from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { path: '/gamepad', label: 'GAMEPAD', icon: Gamepad2 },
  { path: '/flysky', label: 'FLYSKY', icon: Radio },
  { path: '/navigation', label: 'NAVIGATION', icon: Map },
  { path: '/mapping', label: 'SLAM MAP', icon: Map },
  { path: '/diagnostics', label: 'DIAGNOSTICS', icon: Activity },
  { path: '/docs', label: 'SYSTEM_DOCS', icon: FileText },
  { path: '/recordings', label: 'RECORDINGS', icon: Video },
  { path: '/sync', label: 'CLOUD SYNC', icon: Cloud },
  { path: '/setup', label: 'CONFIG', icon: Settings },
];

export default function Header() {
  const [location] = useLocation();
  const { sendCommand, isConnected } = useWebSocket();
  const [eStopActive, setEStopActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleEStop = () => {
    setEStopActive(true);
    sendCommand({ type: 'command', action: 'ESTOP', timestamp: Date.now() });
    
    setTimeout(() => {
      setEStopActive(false);
    }, 3000);
  };

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  return (
    <header 
      className="h-14 border-b border-border bg-card/50 backdrop-blur px-4 flex items-center justify-between z-50 fixed top-0 left-0 right-0"
      data-testid="header-main"
    >
      <div className="flex items-center gap-4">
        <Link href="/">
          <h1 
            className="text-xl font-display font-bold tracking-widest text-primary flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            data-testid="link-logo"
          >
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-primary animate-pulse shadow-[0_0_10px_var(--primary)]' : 'bg-destructive'}`}></div>
            ROVER<span className="text-foreground">OS</span> V3.0
          </h1>
        </Link>
        <div className="h-6 w-[1px] bg-border mx-2 hidden md:block"></div>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-secondary">
          <Wifi className="w-3 h-3" />
          {isConnected ? 'CONNECTED: ROVER-AP-5G' : 'DISCONNECTED'}
        </div>
      </div>
      
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-1">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`font-mono text-xs hover:text-primary hover:bg-primary/10 ${
                isActive(item.path) ? 'text-primary bg-primary/10' : ''
              }`}
              data-testid={`nav-${item.path.slice(1) || 'home'}`}
            >
              <item.icon className="w-4 h-4 mr-1" /> {item.label}
            </Button>
          </Link>
        ))}
        <Button 
          variant="destructive" 
          size="sm" 
          className={`font-mono text-xs ml-2 ${eStopActive ? 'animate-pulse' : ''}`}
          onClick={handleEStop}
          disabled={eStopActive}
          data-testid="button-estop"
        >
          <Power className="w-4 h-4 mr-1" /> {eStopActive ? 'STOPPING...' : 'E-STOP'}
        </Button>
      </nav>

      {/* Mobile Navigation */}
      <div className="flex lg:hidden items-center gap-2">
        <Button 
          variant="destructive" 
          size="sm" 
          className={`font-mono text-xs ${eStopActive ? 'animate-pulse' : ''}`}
          onClick={handleEStop}
          disabled={eStopActive}
          data-testid="button-estop-mobile"
        >
          <Power className="w-4 h-4" />
        </Button>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="button-menu-mobile">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-card border-border">
            <SheetHeader>
              <SheetTitle className="text-primary font-display">NAVIGATION</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2 mt-6">
              <Link href="/">
                <Button 
                  variant="ghost" 
                  className={`w-full justify-start font-mono text-sm ${isActive('/') && location === '/' ? 'text-primary bg-primary/10' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="nav-mobile-home"
                >
                  <Activity className="w-4 h-4 mr-2" /> DASHBOARD
                </Button>
              </Link>
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start font-mono text-sm ${isActive(item.path) ? 'text-primary bg-primary/10' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`nav-mobile-${item.path.slice(1)}`}
                  >
                    <item.icon className="w-4 h-4 mr-2" /> {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
