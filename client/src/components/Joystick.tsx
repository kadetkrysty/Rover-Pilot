import { motion, useMotionValue, animate } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onMove?: (x: number, y: number) => void;
  onHeadingChange?: (heading: number) => void;
  className?: string;
  size?: number | string;
}

export default function Joystick({ onMove, onHeadingChange, className, size = 192 }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [computedSize, setComputedSize] = useState<number>(typeof size === 'number' ? size : 192);
  const [heading, setHeading] = useState<number | null>(null);
  const [magnitude, setMagnitude] = useState(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    if (typeof size === 'string' && size.endsWith('%')) {
      const updateSize = () => {
        const panel = containerRef.current?.closest('[data-joystick-panel]') as HTMLElement;
        if (panel) {
          const panelWidth = panel.clientWidth - 24;
          const percentage = parseFloat(size) / 100;
          const newSize = panelWidth * percentage;
          setComputedSize(newSize);
        }
      };
      
      updateSize();
      window.addEventListener('resize', updateSize);
      
      const observer = new ResizeObserver(updateSize);
      const panel = containerRef.current?.closest('[data-joystick-panel]') as HTMLElement;
      if (panel) {
        observer.observe(panel);
      }
      
      return () => {
        window.removeEventListener('resize', updateSize);
        observer.disconnect();
      };
    } else if (typeof size === 'number') {
      setComputedSize(size);
    }
  }, [size]);

  const knobSize = Math.max(computedSize * 0.15, 24);
  const maxDistance = (computedSize / 2) - (knobSize / 2);

  const handleDrag = () => {
    const currentX = x.get();
    const currentY = y.get();
    
    const distance = Math.sqrt(currentX * currentX + currentY * currentY);
    const clampedDistance = Math.min(distance, maxDistance);
    const normalizedMag = clampedDistance / maxDistance;
    
    let angle = Math.atan2(-currentX, currentY) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    
    setHeading(distance > 5 ? angle : null);
    setMagnitude(normalizedMag);
    
    const normalizedX = Math.max(-1, Math.min(1, currentX / maxDistance));
    const normalizedY = Math.max(-1, Math.min(1, -currentY / maxDistance));
    
    if (onMove) {
      onMove(normalizedX, normalizedY);
    }
    if (onHeadingChange && distance > 5) {
      onHeadingChange(angle);
    }
  };

  const handleDragEnd = () => {
    setActive(false);
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 20 });
    setHeading(null);
    setMagnitude(0);
    if (onMove) onMove(0, 0);
  };

  const getCardinalDirection = (deg: number): string => {
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    if (deg >= 292.5 && deg < 337.5) return 'NW';
    return 'N';
  };

  return (
    <div ref={containerRef} className={`flex flex-col items-center gap-2 w-full ${className}`}>
      <div className="font-mono text-xs text-primary/80 bg-black/40 px-3 py-1 rounded border border-primary/20">
        {heading !== null ? (
          <>HDG: {heading.toFixed(0)}° {getCardinalDirection(heading)} | MAG: {(magnitude * 100).toFixed(0)}%</>
        ) : (
          <>HDG: ---° | MAG: 0%</>
        )}
      </div>
      
      <div 
        ref={joystickRef}
        className="relative rounded-full border-2 border-primary/30 bg-black/40 backdrop-blur-md"
        style={{ width: computedSize, height: computedSize }}
      >
        {/* Compass cardinal points */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-primary">N</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold text-primary/60">S</div>
          <div className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-bold text-primary/60">W</div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-primary/60">E</div>
          
          {/* Compass tick marks */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-primary"></div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-primary/50"></div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-primary/50"></div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-primary/50"></div>
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary"></div>
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-primary"></div>
        </div>
        
        {/* Concentric circles */}
        <div 
          className="absolute rounded-full border border-primary/20 pointer-events-none"
          style={{
            top: '25%',
            left: '25%',
            right: '25%',
            bottom: '25%',
          }}
        />
        <div 
          className="absolute rounded-full border border-primary/10 pointer-events-none"
          style={{
            top: '12.5%',
            left: '12.5%',
            right: '12.5%',
            bottom: '12.5%',
          }}
        />

        <motion.div
          drag
          dragConstraints={{ 
            top: -maxDistance, 
            left: -maxDistance, 
            right: maxDistance, 
            bottom: maxDistance 
          }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={() => setActive(true)}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          style={{ x, y }}
          className={`absolute rounded-full 
            bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] cursor-pointer
            flex items-center justify-center transition-colors duration-200
            ${active ? 'bg-primary/40 shadow-[0_0_30px_rgba(var(--primary),0.8)]' : ''}
          `}
          initial={{
            top: `calc(50% - ${knobSize / 2}px)`,
            left: `calc(50% - ${knobSize / 2}px)`,
            width: knobSize,
            height: knobSize,
          }}
          animate={{
            width: knobSize,
            height: knobSize,
            top: `calc(50% - ${knobSize / 2}px)`,
            left: `calc(50% - ${knobSize / 2}px)`,
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
        </motion.div>
      </div>
    </div>
  );
}
