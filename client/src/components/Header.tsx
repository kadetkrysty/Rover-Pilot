import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Wifi, Settings, FileText, Power, Activity, Radio, Map,
  Gamepad2, Video, Cloud, Menu, X, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';
import { useDriveControl } from '@/lib/DriveControlProvider';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DriveControlPanel from '@/components/DriveControlPanel';
import { pageForDriveSource } from '@/lib/driveLifecycle';

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
  { path: '/security', label: 'PAIRED CLIENTS', icon: ShieldCheck },
  { path: '/settings/maps', label: 'MAP SETTINGS', icon: Settings },
];

export default function Header() {
  const [location, setLocation] = useLocation();
  const { isConnected } = useWebSocket();
  const { emergencyStop, status: driveStatus, demo } = useDriveControl();
  const [menuOpen, setMenuOpen] = useState(false);
  const [driveDialogOpen, setDriveDialogOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstNavRef = useRef<HTMLAnchorElement>(null);

  const isActive = (path: string) => path === '/' ? location === '/' : location.startsWith(path);

  useEffect(() => {
    if (!menuOpen) return;
    firstNavRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-2 backdrop-blur sm:px-4"
        data-testid="header-main"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 border border-border/60 p-0 focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'rover-navigation-drawer' : undefined}
            data-testid="button-menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Link href="/">
            <h1
              className="flex cursor-pointer items-center gap-2 text-base font-display font-bold tracking-widest text-primary transition-opacity hover:opacity-80 sm:text-lg"
              data-testid="link-logo"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'animate-pulse bg-primary shadow-[0_0_10px_var(--primary)]' : 'bg-destructive'}`} />
              ROVER<span className="text-foreground">OS</span>
            </h1>
          </Link>
          <div className="hidden items-center gap-2 text-xs font-mono text-secondary sm:flex">
            <Wifi className="h-3 w-3" />
            <span className="hidden md:inline">{isConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Dialog open={driveDialogOpen} onOpenChange={setDriveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-primary/40 px-2 font-mono text-[10px] tracking-wide text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary sm:px-3 sm:text-xs"
                aria-label="Open Drive Authority controls"
                data-testid="button-drive-authority"
              >
                <ShieldCheck className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">DRIVE AUTHORITY</span>
                <span className="sm:hidden">DRIVE</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto border-primary/30 bg-background p-3 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-6">
              <DialogHeader className="pr-8">
                <DialogTitle className="font-display text-primary">DRIVE AUTHORITY</DialogTitle>
                <DialogDescription>
                  Safe control access. Source selection never arms the rover; arming requires an explicit action.
                </DialogDescription>
              </DialogHeader>
              <DriveControlPanel onArmed={(source) => {
                setDriveDialogOpen(false);
                setLocation(pageForDriveSource(source));
              }} />
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            className={`h-9 px-2 font-mono text-[10px] sm:px-3 sm:text-xs ${driveStatus.estop ? 'animate-pulse' : ''}`}
            onClick={() => void emergencyStop()}
            disabled={demo}
            aria-label={demo ? 'E-STOP unavailable in Demo mode; rover controls are disabled' : driveStatus.estop ? 'E-STOP latched' : 'Latch E-STOP'}
            title={demo ? 'E-STOP is disabled in Demo mode; no rover is connected.' : undefined}
            data-testid="button-estop"
          >
            <Power className="h-4 w-4" />
            <span className="ml-1">E-STOP</span>
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation menu"
              className="fixed inset-x-0 bottom-0 top-14 z-40 cursor-default bg-background/35 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}
            />
            <motion.nav
              id="rover-navigation-drawer"
              aria-label="Main navigation"
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '-100%' }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-0 left-0 top-14 z-40 w-[min(19rem,calc(100vw-2rem))] overflow-y-auto border-r border-primary/25 bg-card p-3 shadow-2xl sm:bottom-auto sm:left-3 sm:top-[4.25rem] sm:max-h-[calc(100dvh-5.5rem)] sm:rounded-md sm:border"
              data-testid="dropdown-menu"
            >
              <div className="mb-3 -mx-[7px] -mt-[7px] border-b border-border/70 pb-[5px]">
                <img
                  src="/icons/roveros-app-icon-192.png"
                  alt="RoverOS rover app icon"
                  className="block h-auto w-full rounded-lg border border-primary/25 object-contain"
                  data-testid="menu-brand-icon"
                />
              </div>
              <div className="space-y-1">
                {navItems.map((item, index) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    ref={index === 0 ? firstNavRef : undefined}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                    className={`group flex min-h-11 items-center gap-3 rounded px-3 py-2 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      isActive(item.path)
                        ? 'border border-primary/30 bg-primary/10 text-primary'
                        : 'border border-transparent text-foreground/80 hover:border-border hover:bg-primary/5 hover:text-primary'
                    }`}
                    onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}
                    data-testid={`nav-${item.path.slice(1) || 'home'}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.path) && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  </Link>
                ))}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

    </>
  );
}
