import { motion } from 'framer-motion';
import { useRef, useState } from 'react';

interface JoystickProps {
  onMove?: (x: number, y: number) => void;
  className?: string;
  size?: number;
}

export default function Joystick({ onMove, className, size = 192 }: JoystickProps) {
  const constraintsRef = useRef(null);
  const [active, setActive] = useState(false);

  return (
    <div className={`relative rounded-full border-2 border-primary/30 bg-black/40 backdrop-blur-md ${className}`} style={{ width: size, height: size }}>
      {/* Grid Lines */}
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
              // Normalize coordinates to -1 to 1
              const rect = (event.target as HTMLElement).parentElement?.getBoundingClientRect();
              if (rect) {
                const maxDist = rect.width / 2;
                 // Approximation logic for demo
                const x = info.point.x;
                const y = info.point.y; 
                // In a real implementation we'd calculate relative to center accurately
                // For this mockup, we'll just simulate the callback
                onMove(info.offset.x / 100, info.offset.y / 100);
              }
            }
          }}
          className={`absolute top-[calc(50%-2rem)] left-[calc(50%-2rem)] w-16 h-16 rounded-full 
            bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] cursor-pointer
            flex items-center justify-center transition-colors duration-200
            ${active ? 'bg-primary/40 shadow-[0_0_30px_rgba(var(--primary),0.8)]' : ''}
          `}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
            <div className="w-2 h-2 bg-primary rounded-full"></div>
        </motion.div>
      </motion.div>
    </div>
  );
}
