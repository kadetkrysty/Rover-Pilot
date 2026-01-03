import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface SimulationProps {
  throttle: number;
  direction: 'FORWARD' | 'REVERSE' | 'NEUTRAL';
  steering: number;
  cameraPan: number;
  cameraTilt: number;
  zoom: number;
}

interface ObstacleData {
  id: number;
  position: [number, number, number];
  scale: number;
  type: 'rock' | 'boulder';
}

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, 64, 64);
    const positions = geo.attributes.position.array as Float32Array;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const noise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2 +
                   Math.sin(x * 0.1 + y * 0.1) * 0.5 +
                   Math.random() * 0.3;
      positions[i + 2] = noise;
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#b5651d" roughness={0.9} />
    </mesh>
  );
}

function Obstacle({ position, scale, type }: { position: [number, number, number]; scale: number; type: 'rock' | 'boulder' }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  return (
    <mesh ref={meshRef} position={position} castShadow>
      {type === 'boulder' ? (
        <dodecahedronGeometry args={[scale, 1]} />
      ) : (
        <coneGeometry args={[scale * 0.8, scale * 1.5, 5]} />
      )}
      <meshStandardMaterial color={type === 'boulder' ? '#4a3728' : '#3d2b1f'} roughness={0.95} />
    </mesh>
  );
}

function Rover({ 
  throttle, 
  direction, 
  steering, 
  cameraPan, 
  cameraTilt,
  zoom,
  obstacles,
  onDetectedObstacles
}: SimulationProps & { 
  obstacles: ObstacleData[];
  onDetectedObstacles: (detected: { id: number; screenPos: { x: number; y: number; width: number; height: number } }[]) => void;
}) {
  const roverRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const velocityRef = useRef(0);
  const rotationRef = useRef(0);
  const { size } = useThree();
  
  useFrame((_, delta) => {
    if (!roverRef.current) return;
    
    const maxSpeed = 15;
    const acceleration = 20;
    const friction = 8;
    const turnSpeed = 2;
    
    let targetVelocity = 0;
    if (direction === 'FORWARD') {
      targetVelocity = (throttle / 100) * maxSpeed;
    } else if (direction === 'REVERSE') {
      targetVelocity = -(throttle / 100) * maxSpeed;
    }
    
    if (targetVelocity !== 0) {
      velocityRef.current += (targetVelocity - velocityRef.current) * acceleration * delta;
    } else {
      velocityRef.current *= (1 - friction * delta);
      if (Math.abs(velocityRef.current) < 0.01) velocityRef.current = 0;
    }
    
    if (Math.abs(velocityRef.current) > 0.1) {
      const steerAmount = (steering / 100) * turnSpeed * delta;
      rotationRef.current -= steerAmount * Math.sign(velocityRef.current);
    }
    
    roverRef.current.rotation.y = rotationRef.current;
    
    const moveX = Math.sin(rotationRef.current) * velocityRef.current * delta;
    const moveZ = Math.cos(rotationRef.current) * velocityRef.current * delta;
    
    roverRef.current.position.x += moveX;
    roverRef.current.position.z += moveZ;
    
    roverRef.current.position.x = Math.max(-90, Math.min(90, roverRef.current.position.x));
    roverRef.current.position.z = Math.max(-90, Math.min(90, roverRef.current.position.z));
    
    if (cameraRef.current) {
      const baseFov = 75;
      const zoomedFov = baseFov / zoom;
      cameraRef.current.fov = Math.max(20, Math.min(120, zoomedFov));
      cameraRef.current.updateProjectionMatrix();
      
      const panRad = (cameraPan / 90) * (Math.PI / 4);
      const tiltRad = (cameraTilt / 45) * (Math.PI / 6);
      
      cameraRef.current.rotation.order = 'YXZ';
      cameraRef.current.rotation.y = Math.PI + panRad;
      cameraRef.current.rotation.x = tiltRad;
    }
    
    const detected: { id: number; screenPos: { x: number; y: number; width: number; height: number } }[] = [];
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    
    if (cameraRef.current) {
      cameraRef.current.updateMatrixWorld();
      projScreenMatrix.multiplyMatrices(cameraRef.current.projectionMatrix, cameraRef.current.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
      
      obstacles.forEach(obs => {
        const worldPos = new THREE.Vector3(obs.position[0], obs.position[1], obs.position[2]);
        const distance = worldPos.distanceTo(roverRef.current!.position);
        
        if (distance < 30 && frustum.containsPoint(worldPos)) {
          const screenPos = worldPos.clone().project(cameraRef.current!);
          
          const x = (screenPos.x + 1) / 2 * size.width;
          const y = (-screenPos.y + 1) / 2 * size.height;
          const boxSize = Math.max(30, (obs.scale * 80) / distance);
          
          detected.push({
            id: obs.id,
            screenPos: {
              x: x - boxSize / 2,
              y: y - boxSize / 2,
              width: boxSize,
              height: boxSize
            }
          });
        }
      });
    }
    
    onDetectedObstacles(detected);
  });

  return (
    <group ref={roverRef} position={[0, 0.5, 0]}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.4, 2]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      
      <mesh position={[0, 0.6, 0.3]}>
        <boxGeometry args={[0.8, 0.3, 0.6]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {[[-0.7, 0, 0.6], [0.7, 0, 0.6], [-0.7, 0, -0.6], [0.7, 0, -0.6]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>
      ))}
      
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 1.2, 0.5]}
        fov={75}
        near={0.1}
        far={1000}
      />
    </group>
  );
}

function Scene(props: SimulationProps & { onDetectedObstacles: (detected: any[]) => void }) {
  const obstacles = useMemo<ObstacleData[]>(() => {
    const obs: ObstacleData[] = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 80;
      obs.push({
        id: i,
        position: [
          Math.cos(angle) * distance,
          0.5 + Math.random() * 0.5,
          Math.sin(angle) * distance
        ],
        scale: 0.5 + Math.random() * 1.5,
        type: Math.random() > 0.5 ? 'boulder' : 'rock'
      });
    }
    return obs;
  }, []);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[50, 50, 25]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      <fog attach="fog" args={['#c4956a', 30, 150]} />
      <color attach="background" args={['#d4a574']} />
      
      <Terrain />
      
      {obstacles.map(obs => (
        <Obstacle key={obs.id} position={obs.position} scale={obs.scale} type={obs.type} />
      ))}
      
      <Rover {...props} obstacles={obstacles} />
    </>
  );
}

export default function ThreeRoverSimulation(props: SimulationProps) {
  const [detectedObstacles, setDetectedObstacles] = useState<{ id: number; screenPos: { x: number; y: number; width: number; height: number } }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene {...props} onDetectedObstacles={setDetectedObstacles} />
      </Canvas>
      
      <div className="absolute inset-0 pointer-events-none">
        {detectedObstacles.map(obs => (
          <div
            key={obs.id}
            className="absolute border-2 border-green-400"
            style={{
              left: obs.screenPos.x,
              top: obs.screenPos.y,
              width: obs.screenPos.width,
              height: obs.screenPos.height,
            }}
          >
            <div className="absolute -top-5 left-0 bg-green-400/80 px-1 text-[10px] font-mono text-black">
              OBSTACLE
            </div>
          </div>
        ))}
        
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[120px] h-[120px] border border-cyan-400/40 rounded-full relative">
            <div className="w-1 h-3 bg-cyan-400 absolute top-0 left-1/2 -translate-x-1/2"></div>
            <div className="w-1 h-3 bg-cyan-400 absolute bottom-0 left-1/2 -translate-x-1/2"></div>
            <div className="w-3 h-1 bg-cyan-400 absolute top-1/2 left-0 -translate-y-1/2"></div>
            <div className="w-3 h-1 bg-cyan-400 absolute top-1/2 right-0 -translate-y-1/2"></div>
          </div>
        </div>
        
        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-2 rounded text-xs font-mono space-y-1">
          <div className="text-cyan-400">HUSKY LENS AI</div>
          <div className="text-muted-foreground">OBJECTS: {detectedObstacles.length}</div>
          <div className="text-green-400">TRACKING ACTIVE</div>
        </div>
      </div>
    </div>
  );
}
