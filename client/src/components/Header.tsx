import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { 
  Wifi, Settings, FileText, Power, Activity, Radio, Map, 
  Gamepad2, Video, Cloud, Menu, X, ChevronDown
} from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/', label: 'DASHBOARD', icon: Activity },
  { path: '/gamepad', label: 'GAMEPAD', icon: Gamepad2 },
  { path: '/flysky', label: 'FLYSKY', icon: Radio },
  { path: '/navigation', label: 'NAVIGATION', icon: Map },
  { path: '/mapping', label: 'SLAM MAP', icon: Map },
  { path: '/diagnostics', label: 'DIAGNOSTICS', icon: Activity },
  { path: '/docs', label: 'DOCS', icon: FileText },
  { path: '/recordings', label: 'RECORDINGS', icon: Video },
  { path: '/sync', label: 'CLOUD', icon: Cloud },
  { path: '/setup', label: 'CONFIG', icon: Settings },
];

export default function Header() {
  const [location] = useLocation();
  const { sendCommand, isConnected } = useWebSocket();
  const [eStopActive, setEStopActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const currentPage = navItems.find(item => isActive(item.path));

  return (
    <div ref={menuRef}>
      <header 
        className="h-14 border-b border-border bg-card/95 backdrop-blur px-4 flex items-center justify-between z-50 fixed top-0 left-0 right-0"
        data-testid="header-main"
      >
        <div className="flex items-center gap-3">
          <Link href="/">
            <h1 
              className="text-lg font-display font-bold tracking-widest text-primary flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              data-testid="link-logo"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-primary animate-pulse shadow-[0_0_10px_var(--primary)]' : 'bg-destructive'}`}></div>
              ROVER<span className="text-foreground">OS</span>
            </h1>
          </Link>
          
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-secondary">
            <Wifi className="w-3 h-3" />
            <span className="hidden md:inline">{isConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs flex items-center gap-2 border border-border/50 hover:border-primary/50"
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="button-menu"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">{currentPage?.label || 'MENU'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </Button>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className={`font-mono text-xs ${eStopActive ? 'animate-pulse' : ''}`}
            onClick={handleEStop}
            disabled={eStopActive}
            data-testid="button-estop"
          >
            <Power className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">{eStopActive ? 'STOP!' : 'E-STOP'}</span>
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-14 left-0 right-0 z-40 bg-card/95 backdrop-blur border-b border-border shadow-lg"
            data-testid="dropdown-menu"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 p-3">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start font-mono text-xs h-10 ${
                      isActive(item.path) 
                        ? 'text-primary bg-primary/10 border border-primary/30' 
                        : 'hover:bg-primary/5 hover:text-primary'
                    }`}
                    onClick={() => setMenuOpen(false)}
                    data-testid={`nav-${item.path.slice(1) || 'home'}`}
                  >
                    <item.icon className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
