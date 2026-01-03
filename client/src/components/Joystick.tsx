import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onMove?: (x: number, y: number) => void;
  className?: string;
  size?: number | string;
}

export default function Joystick({ onMove, className, size = 192 }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [computedSize, setComputedSize] = useState<number>(typeof size === 'number' ? size : 192);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    if (typeof size === 'string' && size.endsWith('%') && containerRef.current) {
      const updateSize = () => {
        const parent = containerRef.current?.parentElement;
        if (parent) {
          const parentWidth = parent.clientWidth;
          const percentage = parseFloat(size) / 100;
          const newSize = parentWidth * percentage;
          setComputedSize(newSize);
        }
      };
      
      updateSize();
      const observer = new ResizeObserver(updateSize);
      if (containerRef.current?.parentElement) {
        observer.observe(containerRef.current.parentElement);
      }
      return () => observer.disconnect();
    } else if (typeof size === 'number') {
      setComputedSize(size);
    }
  }, [size]);

  const knobSize = Math.max(computedSize * 0.15, 24);
  const maxDistance = (computedSize - knobSize) / 2;

  const handleDrag = () => {
    const currentX = x.get();
    const currentY = y.get();
    
    const normalizedX = Math.max(-1, Math.min(1, currentX / maxDistance));
    const normalizedY = Math.max(-1, Math.min(1, -currentY / maxDistance));
    
    setCoordinates({ x: normalizedX, y: normalizedY });
    if (onMove) {
      onMove(normalizedX, normalizedY);
    }
  };

  const handleDragEnd = () => {
    setActive(false);
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 20 });
    setCoordinates({ x: 0, y: 0 });
    if (onMove) onMove(0, 0);
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="font-mono text-xs text-primary/80 bg-black/40 px-3 py-1 rounded border border-primary/20">
        X: {coordinates.x.toFixed(2)} | Y: {coordinates.y.toFixed(2)}
      </div>
      
      <div 
        ref={containerRef}
        className="relative rounded-full border-2 border-primary/30 bg-black/40 backdrop-blur-md"
        style={{ width: computedSize, height: computedSize }}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary"></div>
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-primary"></div>
          <div className="absolute top-1/4 left-0 w-full h-[1px] bg-primary/50"></div>
          <div className="absolute top-3/4 left-0 w-full h-[1px] bg-primary/50"></div>
          <div className="absolute left-1/4 top-0 h-full w-[1px] bg-primary/50"></div>
          <div className="absolute left-3/4 top-0 h-full w-[1px] bg-primary/50"></div>
        </div>

        <div 
          ref={constraintsRef}
          className="absolute rounded-full"
          style={{
            top: knobSize / 2,
            left: knobSize / 2,
            right: knobSize / 2,
            bottom: knobSize / 2,
          }}
        />

        <motion.div
          drag
          dragConstraints={constraintsRef}
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
