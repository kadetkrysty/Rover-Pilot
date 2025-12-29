import { motion } from 'framer-motion';
import generatedImage from '@assets/generated_images/fpv_rover_camera_view_of_a_mars-like_rocky_terrain_with_hud_overlay_elements.png';

export default function CameraFeed() {
  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-primary/20 shadow-2xl">
      {/* Live Feed Placeholder */}
      <img 
        src={generatedImage} 
        alt="Rover Live Feed" 
        className="w-full h-full object-cover opacity-80"
      />
      
      {/* Glitch Overlay Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>
      
      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
        <div className="w-[200px] h-[200px] border border-primary/40 rounded-full flex items-center justify-center relative">
            <div className="w-1 h-4 bg-primary absolute top-0 -translate-y-1/2"></div>
            <div className="w-1 h-4 bg-primary absolute bottom-0 translate-y-1/2"></div>
            <div className="w-4 h-1 bg-primary absolute left-0 -translate-x-1/2"></div>
            <div className="w-4 h-1 bg-primary absolute right-0 translate-x-1/2"></div>
            <div className="w-2 h-2 bg-primary rounded-full"></div>
        </div>
      </div>

      {/* Camera Info Top Left */}
      <div className="absolute top-4 left-4 font-mono text-xs text-primary/80 bg-black/50 p-2 rounded backdrop-blur">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            REC 00:14:23
        </div>
        <div>CAM: HUSKY_LENS_AI_01</div>
        <div>RES: 1080p 60FPS</div>
      </div>

       {/* Object Detection Box (Simulated) */}
       <motion.div 
        animate={{ 
            x: [100, 120, 100], 
            y: [50, 60, 50],
            opacity: [0.5, 0.8, 0.5]
        }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-accent/70 rounded-sm pointer-events-none"
       >
           <div className="absolute -top-5 left-0 text-[10px] bg-accent text-accent-foreground px-1 font-mono font-bold">OBSTACLE_ROCK</div>
           <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white"></div>
           <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white"></div>
       </motion.div>
    </div>
  );
}
