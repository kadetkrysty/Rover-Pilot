import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ROVER_MODEL_SPEC } from "@/lib/roverModelSpec";
import {
  Box,
  Camera,
  ChevronDown,
  CircleDot,
  Compass,
  Eye,
  Focus,
  RotateCcw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import "./RoverModelViewer.css";

type PartId =
  | "shell"
  | "wheels"
  | "camera"
  | "mast"
  | "roof"
  | "range"
  | "arms"
  | "lights";

type ViewPreset = "front" | "side" | "top";

const mm = (value: number) => value / 1000;
const bodyLength = mm(ROVER_MODEL_SPEC.body.lengthMm);
const bodyWidth = mm(ROVER_MODEL_SPEC.body.widthMm);
const bodyHeight = mm(ROVER_MODEL_SPEC.body.heightMm);
const bodyBase = mm(ROVER_MODEL_SPEC.body.baseAboveGroundMm);
const innerShellHeight = bodyHeight - 0.006;
const wheelRadius = mm(ROVER_MODEL_SPEC.wheels.diameterMm / 2);
const wheelWidth = mm(ROVER_MODEL_SPEC.wheels.widthMm);
const wheelSideOffsets = ROVER_MODEL_SPEC.wheels.centerYMm.map((value) => mm(value));
const wheelSideSigns = [-1, 1] as const;
const wheelStations = ROVER_MODEL_SPEC.wheels.centerXMm.map(
  (value) => mm(ROVER_MODEL_SPEC.body.lengthMm / 2 - value),
);
const wheelCenterHeight = mm(ROVER_MODEL_SPEC.wheels.centerZMm);
const mastForwardPosition = mm(ROVER_MODEL_SPEC.body.lengthMm / 2 - 115);
const cameraHeadDimensions = ROVER_MODEL_SPEC.mast.headEnvelopeMm.map(mm);

const parts: {
  id: PartId;
  name: string;
  label: string;
  description: string;
  position: string;
  icon: typeof Box;
}[] = [
  {
    id: "shell",
    name: "Protective shell",
    label: "01 / CHASSIS",
    description:
      "A light, faceted cover sits over the navy equipment deck. The proportions follow a nominal 602 × 402 × 202 mm body envelope; panel edges and internal layout are illustrative.",
    position: "Upper body",
    icon: Box,
  },
  {
    id: "wheels",
    name: "Six-wheel assembly",
    label: "02 / MOBILITY",
    description:
      "Three wheels per side use a dark, segmented tread and cyan hub rings. Each wheel is shown at an approximate Ø165 × 50 mm; suspension and tread geometry are not engineering-exact.",
    position: "Left + right sides",
    icon: CircleDot,
  },
  {
    id: "camera",
    name: "Multi-lens camera head",
    label: "03 / PERCEPTION",
    description:
      "A raised front-facing camera cluster is represented with three lenses and cyan glass. Lens type, field of view, spacing, and mounting details are conceptual.",
    position: "Top of mast",
    icon: Camera,
  },
  {
    id: "mast",
    name: "Camera mast",
    label: "04 / ELEVATED MOUNT",
    description:
      "A short raised support lifts the camera head above the roofline for visibility. Its height and construction are approximate.",
    position: "Roof center, forward",
    icon: ScanLine,
  },
  {
    id: "roof",
    name: "Roof puck + antenna",
    label: "05 / ROOF HARDWARE",
    description:
      "A low scanning puck, GPS receiver, slim antenna, and red stop-control placeholder are shown as location cues. Verify the actual devices and mount locations.",
    position: "Upper deck",
    icon: Compass,
  },
  {
    id: "range",
    name: "Front range sensors",
    label: "06 / FRONT SENSING",
    description:
      "Small forward-facing sensor apertures are shown across the nose. The count, technology, and mounting dimensions are inferred from the concept reference.",
    position: "Front fascia",
    icon: Focus,
  },
  {
    id: "arms",
    name: "Articulated side arms",
    label: "07 / SUSPENSION CONCEPT",
    description:
      "Exposed side linkages suggest an articulated wheel arrangement. Joints and links are stylized rather than a validated suspension design.",
    position: "Both sides",
    icon: ChevronDown,
  },
  {
    id: "lights",
    name: "Front lamps + marker",
    label: "08 / LIGHTING",
    description:
      "Two cyan front lamps flank a red center marker, matching the visual reference. They are static graphics—not live indicators or controllable lights.",
    position: "Front fascia",
    icon: Eye,
  },
];

const initialView: Record<ViewPreset, [number, number, number]> = {
  front: [0, 0.82, 1.82],
  side: [1.9, 0.72, 0],
  top: [0.01, 2.35, 0.12],
};

function PartMaterial({
  selected,
  color,
  metalness = 0.25,
  roughness = 0.48,
}: {
  selected: boolean;
  color: string;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={selected ? "#79f4ff" : color}
      emissive={selected ? "#087c8a" : "#000000"}
      emissiveIntensity={selected ? 0.42 : 0}
      metalness={metalness}
      roughness={roughness}
    />
  );
}

function ScenePart({
  id,
  selected,
  onSelect,
  children,
  ...props
}: {
  id: PartId;
  selected: boolean;
  onSelect: (id: PartId) => void;
  children: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group
      {...props}
      userData={{ component: id, selected }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
    >
      {children}
    </group>
  );
}

function RoverScene({
  selected,
  onSelect,
  view,
  controlsRef,
  reduceMotion,
}: {
  selected: PartId;
  onSelect: (id: PartId) => void;
  view: ViewPreset;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  reduceMotion: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...initialView[view]);
    camera.lookAt(0, 0.35, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.35, 0);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, view]);

  const is = (id: PartId) => selected === id;
  const select = (id: PartId) => onSelect(id);

  return (
    <>
      <color attach="background" args={["#07111e"]} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 5, 4]} intensity={2.15} />
      <directionalLight position={[-3, 2, -4]} intensity={0.72} color="#39cde0" />
      <hemisphereLight args={["#b5efff", "#101d2c", 0.55]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#0a1725" roughness={0.96} />
      </mesh>
      <gridHelper args={[8, 32, "#164151", "#102637"]} position={[0, 0.002, 0]} />

      {/* Deep equipment deck beneath the protective shell. */}
      <ScenePart id="shell" selected={is("shell")} onSelect={select}>
        <mesh position={[0, bodyBase + innerShellHeight / 2, 0]} castShadow>
          <boxGeometry args={[bodyWidth, innerShellHeight, bodyLength]} />
          <PartMaterial selected={is("shell")} color="#142d47" metalness={0.62} roughness={0.4} />
        </mesh>
        <mesh position={[0, bodyBase + bodyHeight - 0.005, 0]} castShadow>
          <boxGeometry args={[bodyWidth - 0.027, 0.01, bodyLength - 0.027]} />
          <PartMaterial selected={is("shell")} color="#1c3a56" metalness={0.48} roughness={0.43} />
        </mesh>
        {/* Light grey segmented corner armor and upper rim. */}
        {[-1, 1].flatMap((side) =>
          [-1, 1].map((frontBack) => (
            <mesh
              key={`armor-${side}-${frontBack}`}
              position={[side * (bodyWidth / 2 - 0.07), bodyBase + bodyHeight - 0.001 - 0.036 / 2, frontBack * (bodyLength / 2 - 0.07)]}
              rotation={[0, side * frontBack * -0.12, 0]}
              castShadow
            >
              <boxGeometry args={[0.14, 0.036, 0.10]} />
              <PartMaterial selected={is("shell")} color="#becbd1" metalness={0.32} roughness={0.4} />
            </mesh>
          )),
        )}
        <mesh position={[0, bodyBase + bodyHeight - 0.019, -bodyLength / 2 + 0.034]} castShadow>
          <boxGeometry args={[bodyWidth - 0.18, 0.036, 0.06]} />
          <PartMaterial selected={is("shell")} color="#d2d9dc" metalness={0.23} roughness={0.43} />
        </mesh>
        <mesh position={[0, bodyBase + bodyHeight - 0.019, bodyLength / 2 - 0.034]} castShadow>
          <boxGeometry args={[bodyWidth - 0.18, 0.036, 0.06]} />
          <PartMaterial selected={is("shell")} color="#d2d9dc" metalness={0.23} roughness={0.43} />
        </mesh>
        {/* Subtle deck panel seams. */}
        {[-0.095, 0.095].map((x) => (
          <mesh key={`seam-${x}`} position={[x, bodyBase + bodyHeight + 0.001, 0]}>
            <boxGeometry args={[0.0025, 0.002, bodyLength - 0.11]} />
            <meshStandardMaterial color="#3f6078" roughness={0.6} />
          </mesh>
        ))}
      </ScenePart>

      {/* Three wheels on each side; cylinders are oriented along the axle. */}
      <ScenePart id="wheels" selected={is("wheels")} onSelect={select}>
        {wheelSideOffsets.flatMap((side) =>
          wheelStations.map((station, index) => (
            <group
              key={`wheel-${side}-${index}`}
              position={[side, wheelCenterHeight, station]}
              rotation={[0, 0, -Math.sign(side) * Math.PI / 2]}
            >
              <mesh castShadow>
                <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 20]} />
                <meshStandardMaterial color="#111923" roughness={0.94} />
              </mesh>
              {/* Tread ribs: small and low-count for mobile rendering. */}
              {Array.from({ length: 12 }, (_, index) => {
                const angle = (index / 12) * Math.PI * 2;
                return (
                  <mesh
                    key={index}
                    position={[Math.cos(angle) * (wheelRadius - 0.002), 0, Math.sin(angle) * (wheelRadius - 0.002)]}
                    rotation={[0, angle, 0]}
                  >
                    <boxGeometry args={[0.016, wheelWidth + 0.004, 0.012]} />
                    <meshStandardMaterial color="#252f38" roughness={0.88} />
                  </mesh>
                );
              })}
              <mesh position={[0, wheelWidth / 2 + 0.003, 0]}>
                <cylinderGeometry args={[wheelRadius * 0.56, wheelRadius * 0.56, 0.006, 20]} />
                <PartMaterial selected={is("wheels")} color="#203b4b" metalness={0.68} roughness={0.32} />
              </mesh>
              <mesh position={[0, wheelWidth / 2 + 0.007, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[wheelRadius * 0.41, 0.004, 6, 20]} />
                <meshStandardMaterial color={is("wheels") ? "#b1fbff" : "#20cee1"} emissive="#075c67" emissiveIntensity={0.52} />
              </mesh>
              <mesh position={[0, wheelWidth / 2 + 0.009, 0]}>
                <cylinderGeometry args={[wheelRadius * 0.17, wheelRadius * 0.17, 0.009, 12]} />
                <meshStandardMaterial color="#81aeb8" metalness={0.7} roughness={0.27} />
              </mesh>
            </group>
          )),
        )}
      </ScenePart>

      {/* Side linkages, shown as stylized upper and lower arms with joints. */}
      <ScenePart id="arms" selected={is("arms")} onSelect={select}>
        {wheelSideSigns.flatMap((side) =>
          wheelStations.map((station, index) => (
            <group key={`arm-${side}-${index}`} position={[side * 0.205, bodyBase + 0.04, station]}>
              <mesh position={[side * 0.072, -0.018, 0]} rotation={[0, 0, side * -0.23]} castShadow>
                <boxGeometry args={[0.18, 0.025, 0.034]} />
                <PartMaterial selected={is("arms")} color="#788c97" metalness={0.72} roughness={0.3} />
              </mesh>
              <mesh position={[side * 0.12, -0.079, 0]} rotation={[0, 0, side * 0.56]} castShadow>
                <boxGeometry args={[0.16, 0.022, 0.027]} />
                <PartMaterial selected={is("arms")} color="#526b79" metalness={0.7} roughness={0.35} />
              </mesh>
              {[0, 1].map((joint) => (
                <mesh key={joint} position={[side * (joint ? 0.17 : 0.018), joint ? -0.13 : -0.005, 0]} rotation={[0, 0, 0]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.048, 12]} />
                  <meshStandardMaterial color={is("arms") ? "#5ce9f2" : "#294b5a"} metalness={0.78} roughness={0.27} />
                </mesh>
              ))}
            </group>
          )),
        )}
      </ScenePart>

      {/* Forward lighting and small range-sensor apertures. */}
      <ScenePart id="lights" selected={is("lights")} onSelect={select}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.125, bodyBase + bodyHeight * 0.76, bodyLength / 2]} rotation={[0, 0, side * -0.1]}>
            <boxGeometry args={[0.105, 0.022, 0.016]} />
            <meshStandardMaterial color={is("lights") ? "#a7fbff" : "#20d7e5"} emissive="#12b7c6" emissiveIntensity={0.9} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, bodyBase + bodyHeight * 0.76, bodyLength / 2 + 0.003]}>
          <boxGeometry args={[0.048, 0.012, 0.014]} />
          <meshStandardMaterial color={is("lights") ? "#ff9b91" : "#d83940"} emissive="#a81923" emissiveIntensity={0.65} roughness={0.32} />
        </mesh>
      </ScenePart>

      <ScenePart id="range" selected={is("range")} onSelect={select}>
        {[-0.14, -0.07, 0, 0.07, 0.14].map((x) => (
          <group key={x} position={[x, bodyBase + bodyHeight * 0.48, bodyLength / 2]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.014, 12]} />
              <meshStandardMaterial color="#314955" metalness={0.65} roughness={0.36} />
            </mesh>
            <mesh position={[0, 0, 0.008]}>
              <circleGeometry args={[0.011, 12]} />
              <meshStandardMaterial color={is("range") ? "#83f4ff" : "#102b3b"} emissive="#08798a" emissiveIntensity={0.35} />
            </mesh>
          </group>
        ))}
      </ScenePart>

      {/* Roof hardware: puck and antenna */}
      <ScenePart id="roof" selected={is("roof")} onSelect={select}>
        <mesh position={[0.13, bodyBase + bodyHeight + 0.016, -0.13]} castShadow>
          <cylinderGeometry args={[0.052, 0.058, 0.032, 20]} />
          <PartMaterial selected={is("roof")} color="#233f52" metalness={0.66} roughness={0.34} />
        </mesh>
        <mesh position={[0.13, bodyBase + bodyHeight + 0.036, -0.13]}>
          <cylinderGeometry args={[0.031, 0.031, 0.008, 20]} />
          <meshStandardMaterial color={is("roof") ? "#a0f7ff" : "#22d4e2"} emissive="#0a6875" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.12, bodyBase + bodyHeight + 0.065, -0.055]} rotation={[0, 0, -0.08]} castShadow>
          <cylinderGeometry args={[0.004, 0.006, 0.13, 8]} />
          <PartMaterial selected={is("roof")} color="#778d99" metalness={0.74} roughness={0.27} />
        </mesh>
        <mesh position={[-0.12, bodyBase + bodyHeight + 0.132, -0.055]}>
          <sphereGeometry args={[0.009, 8, 6]} />
          <meshStandardMaterial color="#e45a54" />
        </mesh>
        <mesh position={[0.08, bodyBase + bodyHeight + 0.006, -0.209]} castShadow>
          <boxGeometry args={[0.05, 0.012, 0.04]} />
          <PartMaterial selected={is("roof")} color="#aebec5" metalness={0.32} roughness={0.42} />
        </mesh>
        <mesh position={[0.08, bodyBase + bodyHeight + 0.013, -0.209]}>
          <boxGeometry args={[0.036, 0.003, 0.026]} />
          <meshStandardMaterial color="#2d5267" metalness={0.4} roughness={0.32} />
        </mesh>
        <mesh position={[0.14, bodyBase + bodyHeight + 0.011, -0.264]} castShadow>
          <cylinderGeometry args={[0.014, 0.018, 0.022, 12]} />
          <meshStandardMaterial color={is("roof") ? "#ff948d" : "#d83d46"} emissive="#78151b" emissiveIntensity={0.35} />
        </mesh>
      </ScenePart>

      {/* Raised mast and three-lens camera cluster. */}
      <ScenePart id="mast" selected={is("mast")} onSelect={select}>
        <mesh position={[-0.045, bodyBase + bodyHeight + 0.11, mastForwardPosition]} castShadow>
          <boxGeometry args={[
            mm(ROVER_MODEL_SPEC.mast.tubeSectionMm[0]),
            mm(ROVER_MODEL_SPEC.mast.tubeHeightAboveRoofMm),
            mm(ROVER_MODEL_SPEC.mast.tubeSectionMm[1]),
          ]} />
          <PartMaterial selected={is("mast")} color="#a8b6be" metalness={0.47} roughness={0.39} />
        </mesh>
        <mesh position={[-0.045, bodyBase + bodyHeight + 0.012, mastForwardPosition]}>
          <cylinderGeometry args={[0.036, 0.04, 0.024, 16]} />
          <PartMaterial selected={is("mast")} color="#263f50" metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[-0.045, bodyBase + bodyHeight + mm(ROVER_MODEL_SPEC.mast.tubeHeightAboveRoofMm) + 0.008, mastForwardPosition]}>
          <boxGeometry args={[0.093, 0.018, 0.08]} />
          <PartMaterial selected={is("mast")} color="#637b89" metalness={0.55} roughness={0.35} />
        </mesh>
      </ScenePart>
      <ScenePart id="camera" selected={is("camera")} onSelect={select}>
        <mesh position={[-0.045, bodyBase + bodyHeight + mm(ROVER_MODEL_SPEC.mast.tubeHeightAboveRoofMm) + cameraHeadDimensions[1] / 2, mastForwardPosition + 0.03]} castShadow>
          <boxGeometry args={cameraHeadDimensions as [number, number, number]} />
          <PartMaterial selected={is("camera")} color="#d2d9dc" metalness={0.26} roughness={0.37} />
        </mesh>
        <mesh position={[-0.045, bodyBase + bodyHeight + mm(ROVER_MODEL_SPEC.mast.tubeHeightAboveRoofMm) + cameraHeadDimensions[1] / 2 - 0.006, mastForwardPosition + cameraHeadDimensions[2] + 0.002]}>
          <boxGeometry args={[cameraHeadDimensions[0] - 0.018, cameraHeadDimensions[1] - 0.02, 0.006]} />
          <meshStandardMaterial color="#172a38" metalness={0.42} roughness={0.24} />
        </mesh>
        {[-0.047, 0, 0.047].map((offset, index) => (
          <group key={offset} position={[-0.045 + offset, bodyBase + bodyHeight + mm(ROVER_MODEL_SPEC.mast.tubeHeightAboveRoofMm) + cameraHeadDimensions[1] / 2, mastForwardPosition + cameraHeadDimensions[2] + 0.007]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[index === 1 ? 0.011 : 0.008, index === 1 ? 0.011 : 0.008, 0.008, 16]} />
              <meshStandardMaterial color="#334a57" metalness={0.64} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.008]}>
              <circleGeometry args={[index === 1 ? 0.019 : 0.013, 16]} />
              <meshStandardMaterial color="#28d8e8" emissive="#087d91" emissiveIntensity={0.55} metalness={0.24} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.009]}>
              <circleGeometry args={[0.006, 12]} />
              <meshStandardMaterial color="#d5ffff" emissive="#8cefff" emissiveIntensity={0.38} />
            </mesh>
          </group>
        ))}
      </ScenePart>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.35, 0]}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        minDistance={0.85}
        maxDistance={3.6}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        enablePan={false}
      />
    </>
  );
}

export default function RoverModelViewer() {
  const [selected, setSelected] = useState<PartId>("camera");
  const [view, setView] = useState<ViewPreset>("front");
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const detail = parts.find((part) => part.id === selected) ?? parts[0];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  const resetView = () => {
    setView("front");
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.35, 0);
      controlsRef.current.object.position.set(...initialView.front);
      controlsRef.current.update();
    }
  };

  return (
    <section className="rover-model" aria-labelledby="rover-model-title">
      <header className="rover-model__header">
        <div>
          <div className="rover-model__eyebrow">
            <span className="rover-model__eyebrow-mark" aria-hidden="true" />
            ROVEROS / MODEL EXPLORER
          </div>
          <h1 id="rover-model-title">Rover concept viewer</h1>
          <p className="rover-model__intro">
            Explore the exterior layout and the systems shown in the concept.
          </p>
        </div>
        <div className="rover-model__status" aria-label="Static concept model">
          <span className="rover-model__status-dot" aria-hidden="true" />
          STATIC CONCEPT
        </div>
      </header>

      <div className="rover-model__notice" role="note">
        <ShieldAlert size={17} aria-hidden="true" />
        <p>
          <strong>Visual concept only.</strong> Shapes and component locations are
          inferred and approximate—not an exact CAD model, telemetry display, or
          rover control interface.
        </p>
      </div>

      <div className="rover-model__workspace">
        <div className="rover-model__viewer-column">
          <div className="rover-model__canvas-wrap">
          <div className="rover-model__canvas-label" aria-hidden="true">
              <span>ROVER / EXTERIOR</span>
              <span>{ROVER_MODEL_SPEC.body.lengthMm} × {ROVER_MODEL_SPEC.body.widthMm} × {ROVER_MODEL_SPEC.body.heightMm} MM NOMINAL</span>
            </div>
            <div className="rover-model__canvas" role="img" aria-label="Interactive 3D visual concept of a six-wheel rover. Drag to rotate, use the controls for standard views.">
              <Canvas
                camera={{ position: initialView.front, fov: 34, near: 0.1, far: 30 }}
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
                onCreated={({ gl }) => {
                  gl.setClearColor("#07111e");
                }}
              >
                <RoverScene
                  selected={selected}
                  onSelect={setSelected}
                  view={view}
                  controlsRef={controlsRef}
                  reduceMotion={reduceMotion}
                />
              </Canvas>
              <div className="rover-model__axis" aria-hidden="true">
                <span>FRONT</span>
                <i />
              </div>
              <div className="rover-model__drag-hint">
                <span className="rover-model__drag-icon" aria-hidden="true">↗</span>
                Drag to orbit <span aria-hidden="true">·</span> Scroll to zoom
              </div>
            </div>
            <div className="rover-model__viewbar">
              <div className="rover-model__presets" role="group" aria-label="Choose model orientation">
                {(["front", "side", "top"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setView(preset)}
                    className={view === preset ? "is-active" : ""}
                    aria-pressed={view === preset}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <button type="button" className="rover-model__reset" onClick={resetView}>
                <RotateCcw size={14} aria-hidden="true" />
                Reset view
              </button>
            </div>
          </div>
          <div className="rover-model__dimensions" aria-label="Approximate exterior dimensions">
            <span><b>BODY ENVELOPE</b> {ROVER_MODEL_SPEC.body.lengthMm} × {ROVER_MODEL_SPEC.body.widthMm} × {ROVER_MODEL_SPEC.body.heightMm} mm</span>
            <span><b>WHEEL Ø</b> ~{ROVER_MODEL_SPEC.wheels.diameterMm} mm</span>
            <span><b>WHEEL WIDTH</b> ~{ROVER_MODEL_SPEC.wheels.widthMm} mm</span>
            <span className="rover-model__approx">ALL DIMENSIONS APPROXIMATE</span>
          </div>
        </div>

        <aside className="rover-model__sidebar" aria-label="Rover components">
          <div className="rover-model__side-heading">
            <div>
              <span className="rover-model__section-kicker">SYSTEM MAP</span>
              <h2>Major components</h2>
            </div>
            <span className="rover-model__count">08</span>
          </div>

          <div className="rover-model__part-list" aria-label="Select a component">
            {parts.map((part, index) => {
              const Icon = part.icon;
              return (
                <button
                  key={part.id}
                  type="button"
                  className={`rover-model__part ${selected === part.id ? "is-selected" : ""}`}
                  aria-pressed={selected === part.id}
                  onClick={() => setSelected(part.id)}
                >
                  <span className="rover-model__part-number">{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={16} aria-hidden="true" />
                  <span className="rover-model__part-name">{part.name}</span>
                  <span className="rover-model__part-indicator" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <section className="rover-model__detail" aria-live="polite" aria-atomic="true">
            <div className="rover-model__detail-topline">
              <span>{detail.label}</span>
              <span className="rover-model__approx-tag">INFERRED</span>
            </div>
            <h3>{detail.name}</h3>
            <p>{detail.description}</p>
            <div className="rover-model__location">
              <span>LOCATION</span>
              <strong>{detail.position}</strong>
            </div>
          </section>
          <div className="rover-model__footnote">
            <ShieldAlert size={14} aria-hidden="true" />
            <span>Selection highlights a visual element only. No live rover data.</span>
          </div>
        </aside>
      </div>
      <p className="rover-model__sr-hint" aria-live="polite">
        Selected component: {detail.name}. Use the component list to inspect another part.
      </p>
    </section>
  );
}
