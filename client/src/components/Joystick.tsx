import { motion, useMotionValue, animate } from 'framer-motion';
import { useRef, useState, useEffect, type KeyboardEvent } from 'react';
import { fitJoystick } from '@/lib/joystickLayout';

interface JoystickProps {
  onMove?: (x: number, y: number) => void;
  onHeadingChange?: (heading: number, magnitude: number) => void;
  className?: string;
  size?: number | string;
  disabled?: boolean;
  onRelease?: () => void;
}

export interface JoystickData {
  heading: number | null;
  magnitude: number;
  cardinalDirection: string;
}

export default function Joystick({ onMove, onHeadingChange, className, size = 192, disabled = false, onRelease }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const { diameter: computedSize, outerSize: containerSize, labelOffset, labelScale } =
    fitJoystick(bounds.width, bounds.height, size);
  const [heading, setHeading] = useState<number | null>(null);
  const [magnitude, setMagnitude] = useState(0);
  const previousSizeRef = useRef(0);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      setBounds({ width: container.clientWidth, height: container.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    const releaseOnResize = () => onReleaseRef.current?.();
    window.addEventListener('resize', releaseOnResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', releaseOnResize);
      onReleaseRef.current?.();
    };
  }, []);

  const knobSize = Math.min(computedSize * 0.4, Math.max(computedSize * 0.15, 24));
  const maxDistance = (computedSize / 2) - (knobSize / 2);

  useEffect(() => {
    const previousSize = previousSizeRef.current;
    previousSizeRef.current = computedSize;
    x.set(0);
    y.set(0);
    setActive(false);
    setHeading(null);
    setMagnitude(0);
    if (previousSize > 0 && computedSize !== previousSize) onReleaseRef.current?.();
  }, [computedSize, x, y]);

  const handleDrag = () => {
    if (maxDistance <= 0) return;
    const currentX = x.get();
    const currentY = y.get();
    
    const distance = Math.sqrt(currentX * currentX + currentY * currentY);
    const clampedDistance = Math.min(distance, maxDistance);
    const normalizedMag = clampedDistance / maxDistance;
    
    let angle = Math.atan2(currentX, -currentY) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    
    setHeading(distance > 5 ? angle : null);
    setMagnitude(normalizedMag);
    
    const normalizedX = Math.max(-1, Math.min(1, currentX / maxDistance));
    const normalizedY = Math.max(-1, Math.min(1, -currentY / maxDistance));
    
    if (onMove) {
      onMove(normalizedX, normalizedY);
    }
    if (onHeadingChange && distance > 5) {
      onHeadingChange(angle, normalizedMag);
    }
  };

  const handleDragEnd = () => {
    setActive(false);
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 20 });
    setHeading(null);
    setMagnitude(0);
    if (onMove) onMove(0, 0);
    onRelease?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 0.2 : 0.08;
    let nextX = x.get();
    let nextY = y.get();
    if (event.key === 'ArrowLeft') nextX -= maxDistance * step;
    else if (event.key === 'ArrowRight') nextX += maxDistance * step;
    else if (event.key === 'ArrowUp') nextY -= maxDistance * step;
    else if (event.key === 'ArrowDown') nextY += maxDistance * step;
    else if (event.key === 'Escape' || event.key === ' ') {
      event.preventDefault();
      handleDragEnd();
      return;
    } else return;
    event.preventDefault();
    x.set(Math.max(-maxDistance, Math.min(maxDistance, nextX)));
    y.set(Math.max(-maxDistance, Math.min(maxDistance, nextY)));
    setActive(true);
    handleDrag();
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.startsWith('Arrow')) handleDragEnd();
  };

  const center = containerSize / 2;
  const labelRadius = computedSize / 2 + labelOffset / 2;

  const getRadialPosition = (angleDeg: number) => {
    const angleRad = (angleDeg - 90) * (Math.PI / 180);
    const posX = center + labelRadius * Math.cos(angleRad);
    const posY = center + labelRadius * Math.sin(angleRad);
    return {
      left: posX,
      top: posY,
      transform: 'translate(-50%, -50%)',
    };
  };

  return (
    <div ref={containerRef} className={`flex items-center justify-center w-full h-full min-w-0 min-h-0 ${className ?? ''}`}
      data-testid="navigation-joystick">
      <div 
        className="relative shrink-0"
        style={{ width: containerSize, height: containerSize, visibility: containerSize > 0 ? 'visible' : 'hidden' }}
        data-testid="navigation-compass"
      >
        {/* All cardinal point labels positioned radially */}
        <div className="absolute inset-0 pointer-events-none font-bold leading-none"
          style={{ fontSize: 14 * labelScale }}>
          <div className="absolute text-primary" style={getRadialPosition(0)}>FWD</div>
          <div className="absolute text-primary/50" style={{ ...getRadialPosition(45), fontSize: 12 * labelScale }}>FWD-R</div>
          <div className="absolute text-primary/60" style={getRadialPosition(90)}>RIGHT</div>
          <div className="absolute text-primary/50" style={{ ...getRadialPosition(135), fontSize: 12 * labelScale }}>REV-R</div>
          <div className="absolute text-primary/60" style={getRadialPosition(180)}>REV</div>
          <div className="absolute text-primary/50" style={{ ...getRadialPosition(225), fontSize: 12 * labelScale }}>REV-L</div>
          <div className="absolute text-primary/60" style={getRadialPosition(270)}>LEFT</div>
          <div className="absolute text-primary/50" style={{ ...getRadialPosition(315), fontSize: 12 * labelScale }}>FWD-L</div>
        </div>

        {/* Joystick circle container */}
        <div 
          ref={joystickRef}
          className="absolute rounded-full border-2 border-primary/30 bg-black/40 backdrop-blur-md"
          style={{ 
            width: computedSize, 
            height: computedSize,
            top: labelOffset,
            left: labelOffset,
          }}
        >
          {/* Compass tick marks - major (N, S, E, W) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-primary"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-primary/50"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-primary/50"></div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-primary/50"></div>
          </div>

          {/* Diagonal lines */}
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-15 pointer-events-none">
            <div 
              className="absolute bg-primary"
              style={{
                width: '1px',
                height: '141.4%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
              }}
            />
            <div 
              className="absolute bg-primary"
              style={{
                width: '1px',
                height: '141.4%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-45deg)',
              }}
            />
          </div>

          {/* Grid lines - cross */}
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-30 pointer-events-none">
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
            className="absolute rounded-full border border-primary/15 pointer-events-none"
            style={{
              top: '12.5%',
              left: '12.5%',
              right: '12.5%',
              bottom: '12.5%',
            }}
          />

          <motion.div
            drag={!disabled}
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
            onPointerCancel={handleDragEnd}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={() => { if (active) handleDragEnd(); }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(magnitude * 100)}
            aria-label="Rover-relative joystick. Arrow keys control throttle and steering; Space or Escape releases."
            aria-valuetext={heading === null ? 'Neutral' : `Requested rover-relative direction ${heading.toFixed(0)} degrees, ${Math.round(magnitude * 100)} percent`}
            style={{ x, y }}
            className={`absolute rounded-full touch-none
              bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] cursor-pointer
              flex items-center justify-center transition-colors duration-200
              ${active ? 'bg-primary/40 shadow-[0_0_30px_rgba(var(--primary),0.8)]' : ''}
              ${disabled ? 'cursor-not-allowed opacity-50' : ''}
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
    </div>
  );
}

export function useJoystickData() {
  const [data, setData] = useState<JoystickData>({
    heading: null,
    magnitude: 0,
    cardinalDirection: '---',
  });

  const handleHeadingChange = (heading: number, magnitude: number) => {
    const getCardinal = (deg: number): string => {
      if (deg >= 337.5 || deg < 22.5) return 'FWD';
      if (deg >= 22.5 && deg < 67.5) return 'FWD-R';
      if (deg >= 67.5 && deg < 112.5) return 'RIGHT';
      if (deg >= 112.5 && deg < 157.5) return 'REV-R';
      if (deg >= 157.5 && deg < 202.5) return 'REV';
      if (deg >= 202.5 && deg < 247.5) return 'REV-L';
      if (deg >= 247.5 && deg < 292.5) return 'LEFT';
      if (deg >= 292.5 && deg < 337.5) return 'FWD-L';
      return 'FWD';
    };
    
    setData({
      heading,
      magnitude,
      cardinalDirection: getCardinal(heading),
    });
  };

  const reset = () => {
    setData({
      heading: null,
      magnitude: 0,
      cardinalDirection: '---',
    });
  };

  return { data, handleHeadingChange, reset };
}
