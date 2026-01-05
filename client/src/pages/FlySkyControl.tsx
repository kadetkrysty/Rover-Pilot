import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wifi, WifiOff, AlertTriangle, Radio, RotateCcw, Zap } from 'lucide-react';
import { useFlySky, FlySkyInput } from '@/hooks/useFlySky';
import { useRoverData } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import CameraFeed from '@/components/CameraFeed';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const AVAILABLE_FUNCTIONS = [
  { value: 'steering', label: 'Steering' },
  { value: 'forward_back', label: 'Forward/Back' },
  { value: 'throttle', label: 'Throttle' },
  { value: 'yaw', label: 'Yaw Rotation' },
  { value: 'record', label: 'Record Toggle' },
  { value: 'mode', label: 'Mode Select' },
  { value: 'camera_pan', label: 'Camera Pan' },
  { value: 'camera_tilt', label: 'Camera Tilt' },
  { value: 'light', label: 'Light Control' },
  { value: 'horn', label: 'Horn' },
  { value: 'custom', label: 'Custom' },
  { value: 'none', label: 'Not Assigned' },
];

const DEFAULT_MAPPING: Record<number, string> = {
  1: 'steering',
  2: 'forward_back',
  3: 'throttle',
  4: 'yaw',
  5: 'record',
  6: 'mode',
  7: 'camera_pan',
  8: 'camera_tilt',
  9: 'light',
  10: 'horn',
};

export default function FlySkyControl() {
  const flySky = useFlySky();
  const data = useRoverData();
  const location = useLocation();
  
  const [channelMapping, setChannelMapping] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('flySkyChannelMapping');
    return saved ? JSON.parse(saved) : DEFAULT_MAPPING;
  });
  
  const [activeChannels, setActiveChannels] = useState<Set<number>>(new Set());
  const previousValuesRef = useRef<number[]>([1500, 1500, 1000, 1500, 1000, 1000, 1500, 1500, 1500, 1500]);
  const activityTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});

  useEffect(() => {
    localStorage.setItem('flySkyChannelMapping', JSON.stringify(channelMapping));
  }, [channelMapping]);

  useEffect(() => {
    const currentValues = [
      flySky.channel1, flySky.channel2, flySky.channel3, flySky.channel4, flySky.channel5,
      flySky.channel6, flySky.channel7, flySky.channel8, flySky.channel9, flySky.channel10
    ];

    currentValues.forEach((value, index) => {
      const channelNum = index + 1;
      const previousValue = previousValuesRef.current[index];
      const delta = Math.abs(value - previousValue);
      
      if (delta > 50) {
        setActiveChannels(prev => new Set(Array.from(prev).concat(channelNum)));
        
        if (activityTimeoutRef.current[channelNum]) {
          clearTimeout(activityTimeoutRef.current[channelNum]);
        }
        
        activityTimeoutRef.current[channelNum] = setTimeout(() => {
          setActiveChannels(prev => {
            const newSet = new Set(prev);
            newSet.delete(channelNum);
            return newSet;
          });
        }, 500);
      }
    });

    previousValuesRef.current = currentValues;
  }, [flySky]);

  const handleMappingChange = (channel: number, value: string) => {
    setChannelMapping(prev => ({ ...prev, [channel]: value }));
  };

  const resetToDefault = () => {
    setChannelMapping(DEFAULT_MAPPING);
  };

  const getSignalColor = (strength: number) => {
    if (strength > 75) return 'text-secondary';
    if (strength > 50) return 'text-accent';
    if (strength > 25) return 'text-accent/50';
    return 'text-destructive';
  };

  const getSignalBars = (strength: number) => {
    if (strength === 0) return 0;
    if (strength < 25) return 1;
    if (strength < 50) return 2;
    if (strength < 75) return 3;
    return 4;
  };

  const getChannelValue = (ch: number): number => {
    const values: Record<number, number> = {
      1: flySky.channel1, 2: flySky.channel2, 3: flySky.channel3, 4: flySky.channel4,
      5: flySky.channel5, 6: flySky.channel6, 7: flySky.channel7, 8: flySky.channel8,
      9: flySky.channel9, 10: flySky.channel10
    };
    return values[ch] || 1500;
  };

  const ChannelMappingRow = memo(({ channel, value, isActive, assignedFunction, onMappingChange }: { 
    channel: number; 
    value: number; 
    isActive: boolean; 
    assignedFunction: string;
    onMappingChange: (channel: number, value: string) => void;
  }) => {
    const position = ((value - 1000) / 1000) * 100;
    
    return (
      <div 
        className={`flex items-center gap-3 p-2.5 rounded border transition-all ${
          isActive 
            ? 'border-secondary bg-secondary/20' 
            : 'border-border/30 bg-black/20'
        }`}
        data-testid={`channel-mapping-row-${channel}`}
      >
        <div className="flex items-center gap-1.5 min-w-[55px]">
          {isActive && <Zap className="w-4 h-4 text-secondary animate-pulse" />}
          <span className={`text-sm font-mono font-bold ${isActive ? 'text-secondary' : 'text-primary'}`}>
            CH{channel}
          </span>
        </div>
        
        <div className="flex-1 min-w-[70px]">
          <div className="text-xs font-mono text-white/80 mb-1">{value.toFixed(0)}µs</div>
          <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
            <div 
              className={`h-full transition-all duration-75 ${isActive ? 'bg-secondary' : 'bg-primary/50'}`}
              style={{ width: `${position}%` }}
            />
          </div>
        </div>

        <select
          value={assignedFunction}
          onChange={(e) => onMappingChange(channel, e.target.value)}
          className="w-[130px] h-8 px-2 text-xs font-mono font-semibold bg-[#0a0f18] border border-primary/50 text-white rounded cursor-pointer hover:bg-[#1a2535] focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2300ffff' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center'
          }}
          data-testid={`select-channel-${channel}`}
        >
          {AVAILABLE_FUNCTIONS.map(fn => (
            <option 
              key={fn.value} 
              value={fn.value}
              className="bg-[#0a0f18] text-white"
            >
              {fn.label}
            </option>
          ))}
        </select>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-flysky-control">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary" data-testid="text-flysky-title">FLYSKY RECEIVER CONTROL</h1>
        <p className="text-muted-foreground font-mono mt-1">FS-I6x / FS-IA10B 10-Channel Remote Control (iBUS)</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel: Camera Feed */}
        <div className="col-span-8 space-y-4">
          {/* Connection Status */}
          <div className={`hud-panel p-4 border-2 transition-all ${
            flySky.isConnected 
              ? 'border-secondary/50 bg-secondary/5' 
              : 'border-destructive/50 bg-destructive/5'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {flySky.isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-secondary animate-pulse" />
                    <span className="font-bold text-secondary">FS-I6x CONNECTED</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-destructive" />
                    <span className="font-bold text-destructive">NO RECEIVER DETECTED</span>
                  </>
                )}
              </div>
              
              {flySky.isConnected && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-1 h-3 rounded-sm transition-all ${
                          i < getSignalBars(flySky.signalStrength)
                            ? `bg-secondary`
                            : `bg-border/30`
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-mono ${getSignalColor(flySky.signalStrength)}`}>
                    {Math.round(flySky.signalStrength)}%
                  </span>
                </div>
              )}
            </div>

            {flySky.failsafeActive && (
              <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                FAILSAFE ACTIVE - Signal lost for more than 1 second
              </div>
            )}
          </div>

          {/* Camera Feed with HUD Overlay */}
          <div className="hud-panel overflow-hidden">
            <AspectRatio ratio={16 / 9}>
              <CameraFeed 
                className="h-full" 
                showCameraControl={true} 
                latitude={location.latitude ?? 34.0522} 
                longitude={location.longitude ?? -118.2437}
                showDetectedObjects={false}
              />
            </AspectRatio>
          </div>

          {/* No Connection Message */}
          {!flySky.isConnected && (
            <div className="hud-panel p-8 text-center">
              <Radio className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <div className="text-muted-foreground/70">
                <div className="text-lg font-display mb-2">FlySky Receiver Not Detected</div>
                <div className="text-sm font-mono">
                  Check iBUS wiring to Arduino Pin 19 and ensure rover controller is running
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Receiver Info & Channel Mapping */}
        <div className="col-span-4 space-y-4">
          {/* Receiver Info */}
          <div className="hud-panel p-4">
            <h3 className="text-xs font-display text-primary/70 mb-3">RECEIVER INFO</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transmitter</span>
                <span className="text-foreground font-bold">FlySky FS-I6x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receiver</span>
                <span className="text-foreground font-bold">FS-IA10B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protocol</span>
                <span className="text-foreground font-bold text-green-400">iBUS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channels</span>
                <span className="text-foreground font-bold">10 CH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Update Rate</span>
                <span className="text-foreground font-bold">~143Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection</span>
                <span className="text-foreground font-bold">Arduino Pin 19</span>
              </div>
            </div>
          </div>

          {/* Channel Mapping */}
          <div className="hud-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-display text-primary/70">CHANNEL MAPPING</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetToDefault}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary"
                data-testid="button-reset-mapping"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
            
            <div className="text-[9px] text-muted-foreground mb-2 italic">
              Move a stick or flip a switch to detect the channel
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ch => (
                <ChannelMappingRow 
                  key={ch} 
                  channel={ch} 
                  value={getChannelValue(ch)}
                  isActive={activeChannels.has(ch)}
                  assignedFunction={channelMapping[ch] || 'none'}
                  onMappingChange={handleMappingChange}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
