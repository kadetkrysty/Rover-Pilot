import { motion } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onMove?: (x: number, y: number) => void;
  className?: string;
  size?: number | string;
}

export default function Joystick({ onMove, className, size = 192 }: JoystickProps) {
  const constraintsRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [computedSize, setComputedSize] = useState<number>(typeof size === 'number' ? size : 192);

  useEffect(() => {
    if (typeof size === 'string' && size.endsWith('%') && containerRef.current) {
      const updateSize = () => {
        const parent = containerRef.current?.parentElement;
        if (parent) {
          const parentWidth = parent.clientWidth;
          const percentage = parseFloat(size) / 100;
          const newSize = Math.min(parentWidth * percentage, parent.clientHeight * 0.9);
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

  const knobSize = Math.max(computedSize * 0.35, 40);

  return (
    <div 
      ref={containerRef}
      className={`relative rounded-full border-2 border-primary/30 bg-black/40 backdrop-blur-md ${className}`} 
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

      <motion.div
        ref={constraintsRef}
        className="w-full h-full rounded-full"
      >
        <motion.div
          drag
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          dragMomentum={false}
          onDragStart={() => setActive(true)}
          onDragEnd={() => {
            setActive(false);
            if (onMove) onMove(0, 0);
          }}
          onDrag={(event, info) => {
            if (onMove) {
              const rect = (event.target as HTMLElement).parentElement?.getBoundingClientRect();
              if (rect) {
                onMove(info.offset.x / 100, info.offset.y / 100);
              }
            }
          }}
          className={`absolute rounded-full 
            bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] cursor-pointer
            flex items-center justify-center transition-colors duration-200
            ${active ? 'bg-primary/40 shadow-[0_0_30px_rgba(var(--primary),0.8)]' : ''}
          `}
          style={{
            width: knobSize,
            height: knobSize,
            top: `calc(50% - ${knobSize / 2}px)`,
            left: `calc(50% - ${knobSize / 2}px)`,
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-2 h-2 bg-primary rounded-full"></div>
        </motion.div>
      </motion.div>
    </div>
  );
}
