import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ROVER_MODEL_SPEC } from "@/lib/roverModelSpec";
import { MAX_LOCAL_GLB_BYTES, validateLocalGlb } from "@/lib/localGlb";
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
  Upload,
  X,
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
  | "lights"
  | "mini-pc"
  | "mega"
  | "imu"
  | "feru"
  | "battery"
  | "wiring";

type ViewPreset = "front" | "side" | "top";
type ViewMode = "exterior" | "internal";

type ImportedModelPart = {
  id: string;
  name: string;
  object: THREE.Object3D;
};

type ImportedRoverModel = {
  fileName: string;
  root: THREE.Group;
  parts: ImportedModelPart[];
  sourceSize: THREE.Vector3;
  partsTruncated: boolean;
};

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
const internalSpecIds = {
  "mini-pc": "mini-pc",
  mega: "mega-2560",
  imu: "mpu6050",
  feru: "feru-foc",
  battery: "battery-bms",
  wiring: "wiring",
} as const;

const MAX_IMPORTED_MESHES = 5000;
const MAX_IMPORTED_VERTICES = 1_500_000;
const MAX_IMPORTED_PARTS = 300;

function isUsefulPartName(name: string): boolean {
  const normalized = name.trim();
  if (!normalized) return false;
  return !/^(scene|root|rootnode|node|object|group|mesh|cube|armature)([._\s-]*\d+)?$/i.test(
    normalized,
  );
}

function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry?.isBufferGeometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material?.isMaterial) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

function buildImportedModel(scene: THREE.Object3D, fileName: string): ImportedRoverModel {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const sourceSize = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(sourceSize);
  bounds.getCenter(center);
  const largestDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);

  if (
    !Number.isFinite(largestDimension) ||
    largestDimension <= 1e-8 ||
    ![sourceSize.x, sourceSize.y, sourceSize.z, center.x, center.y, center.z].every(Number.isFinite)
  ) {
    throw new Error("The GLB has no usable 3D geometry or contains invalid coordinates.");
  }

  const meshes: THREE.Mesh[] = [];
  let vertexCount = 0;
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes.push(mesh);
    vertexCount += mesh.geometry?.getAttribute("position")?.count ?? 0;
  });

  if (meshes.length === 0) {
    throw new Error("The GLB does not contain any renderable mesh geometry.");
  }
  if (meshes.length > MAX_IMPORTED_MESHES || vertexCount > MAX_IMPORTED_VERTICES) {
    throw new Error(
      `This model is too detailed for the viewer (${meshes.length.toLocaleString()} meshes, ${vertexCount.toLocaleString()} vertices). Reduce it and export again.`,
    );
  }

  const selectable = new Set<THREE.Object3D>();
  for (const mesh of meshes) {
    let ancestor: THREE.Object3D | null = mesh;
    while (ancestor && ancestor !== scene) {
      if (isUsefulPartName(ancestor.name)) {
        selectable.add(ancestor);
        break;
      }
      ancestor = ancestor.parent;
    }
  }

  const root = new THREE.Group();
  root.name = "Imported GLB";
  root.add(scene);
  const scale = 1.25 / largestDimension;
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, 0.35 - center.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);

  const allParts = Array.from(selectable, (object, index) => ({
    id: `glb-part-${index}-${object.uuid}`,
    name: object.name.trim(),
    object,
  }));
  const partsTruncated = allParts.length > MAX_IMPORTED_PARTS;
  const parts = allParts.slice(0, MAX_IMPORTED_PARTS);
  if (parts.length === 0) {
    parts.push({
      id: `glb-model-${root.uuid}`,
      name: "Entire model",
      object: scene,
    });
  }

  return { fileName, root, parts, sourceSize, partsTruncated };
}

function parseLocalGlb(buffer: ArrayBuffer): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, "", resolve, reject);
  });
}

function internalPosition(id: keyof typeof internalSpecIds): [number, number, number] {
  const componentId = internalSpecIds[id];
  const component = ROVER_MODEL_SPEC.internalHardware.components.find((part) => part.id === componentId);
  if (!component) throw new Error(`Missing internal rover model component: ${componentId}`);
  return [
    mm(component.placementMm.lateralMm),
    mm(component.placementMm.aboveGroundMm),
    bodyLength / 2 - mm(component.placementMm.fromFrontMm),
  ];
}

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

const internalParts: typeof parts = [
  {
    id: "mini-pc",
    name: "ACEPC AK1 Mini PC",
    label: "09 / COMPUTE",
    description:
      "Approximate generic enclosure representing the project-listed ACEPC AK1 Mini PC. Conceptual role: host computer for higher-level software and operator-facing processes. Conceptual connection points: power input and USB/network links toward the Mega 2560 and other peripherals; exact ports, routes, and placement are not verified.",
    position: "Conceptual upper deck position",
    icon: Box,
  },
  {
    id: "mega",
    name: "Mega 2560",
    label: "10 / MAIN CONTROLLER",
    description:
      "Approximate board-shaped representation of a Mega 2560. Conceptual role: central microcontroller interface for rover sensors and control signals. Conceptual connection points: USB/serial toward the mini PC, sensor headers toward the IMU, and signal wiring toward the drive controller; connector assignments and harness routing are not verified.",
    position: "Conceptual center deck position",
    icon: ScanLine,
  },
  {
    id: "imu",
    name: "MPU6050 / IMU6050",
    label: "11 / MOTION SENSOR",
    description:
      "Small approximate sensor-board marker for the MPU6050/IMU6050 listed in the project. Conceptual role: inertial motion and orientation sensing. Conceptual connection points: low-voltage power and I²C signal leads toward the Mega 2560; exact connector orientation, mounting plane, and position are not measured.",
    position: "Conceptual forward-center position",
    icon: Compass,
  },
  {
    id: "feru",
    name: "Feru FOC controller",
    label: "12 / DRIVE CONTROL",
    description:
      "Approximate controller enclosure representing the hoverboard drive controller running Feru FOC firmware. Conceptual role: motor-drive control. Conceptual connection points: battery supply, motor phase outputs, and a low-voltage command/signal harness toward the Mega 2560; actual connector locations and wiring are unverified.",
    position: "Conceptual rear deck position",
    icon: Focus,
  },
  {
    id: "battery",
    name: "Battery + BMS",
    label: "13 / POWER",
    description:
      "Approximate battery pack and BMS representation; chemistry, capacity, voltage, and dimensions are not specified here. Conceptual role: stored energy and pack protection. Conceptual connection points: protected power output toward the drive controller and a low-voltage branch toward onboard electronics; polarity, fuse details, connector type, and physical position must be verified on the machine.",
    position: "Conceptual lower deck position",
    icon: ShieldAlert,
  },
  {
    id: "wiring",
    name: "Power + signal wiring",
    label: "14 / HARNESS",
    description:
      "Colored lines are a simplified conceptual harness, not a wiring diagram. Conceptual role: show likely relationships between battery/BMS, drive controller, Mega 2560, mini PC, and IMU. Connection points are illustrative endpoints only: confirm every pin, voltage, polarity, fuse, cable gauge, and route against the actual rover before servicing.",
    position: "Conceptual routes between modules",
    icon: ChevronDown,
  },
];

const initialView: Record<ViewPreset, [number, number, number]> = {
  front: [0, 0.82, 1.82],
  side: [1.9, 0.72, 0],
  top: [0.01, 2.35, 0.12],
};
const internalViews: Record<ViewPreset, [number, number, number]> = {
  front: [0.05, 0.87, 1.2],
  side: [1.23, 0.78, 0.04],
  top: [0.02, 1.72, 0.08],
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

function ImportedSelectionOutline({ object }: { object: THREE.Object3D }) {
  const helper = useMemo(() => new THREE.BoxHelper(object, new THREE.Color("#48d7e7")), [object]);

  useFrame(() => helper.update());
  useEffect(
    () => () => {
      helper.geometry.dispose();
      const material = helper.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    },
    [helper],
  );

  return <primitive object={helper} dispose={null} />;
}

function ImportedModelScene({
  model,
  selectedPartId,
  onSelectPart,
}: {
  model: ImportedRoverModel;
  selectedPartId: string;
  onSelectPart: (id: string) => void;
}) {
  const selectedPart = model.parts.find((part) => part.id === selectedPartId) ?? model.parts[0];

  return (
    <>
      <primitive
        object={model.root}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          let object: THREE.Object3D | null = event.object;
          while (object) {
            const part = model.parts.find((candidate) => candidate.object === object);
            if (part) {
              onSelectPart(part.id);
              return;
            }
            object = object.parent;
          }
          if (model.parts[0]) onSelectPart(model.parts[0].id);
        }}
      />
      {selectedPart && <ImportedSelectionOutline object={selectedPart.object} />}
    </>
  );
}

function RoverScene({
  selected,
  onSelect,
  importedModel,
  selectedImportedPart,
  onSelectImportedPart,
  view,
  mode,
  controlsRef,
  reduceMotion,
}: {
  selected: PartId;
  onSelect: (id: PartId) => void;
  importedModel: ImportedRoverModel | null;
  selectedImportedPart: string;
  onSelectImportedPart: (id: string) => void;
  view: ViewPreset;
  mode: ViewMode;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  reduceMotion: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const position: [number, number, number] = !importedModel && mode === "internal"
      ? internalViews[view]
      : initialView[view];
    const target: [number, number, number] = !importedModel && mode === "internal"
      ? [0, 0.55, 0]
      : [0, 0.35, 0];
    camera.position.set(...position);
    camera.lookAt(...target);
    if (controlsRef.current) {
      controlsRef.current.target.set(...target);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, importedModel, mode, view]);

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

      {importedModel ? (
        <ImportedModelScene
          model={importedModel}
          selectedPartId={selectedImportedPart}
          onSelectPart={onSelectImportedPart}
        />
      ) : mode === "exterior" ? (
      <>
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
      </>
      ) : (
      <>
        {/* Internal modules are intentionally exploded and not dimensionally located. */}
        <mesh position={[0, 0.405, 0]} receiveShadow>
          <boxGeometry args={[bodyWidth - 0.05, 0.018, bodyLength - 0.06]} />
          <meshStandardMaterial color="#203c50" metalness={0.48} roughness={0.62} />
        </mesh>
        <mesh position={[0, 0.418, 0]}>
          <boxGeometry args={[bodyWidth - 0.075, 0.002, bodyLength - 0.085]} />
          <meshStandardMaterial color="#142a3b" roughness={0.8} />
        </mesh>
        {/* ACEPC AK1: compact ribbed mini-computer enclosure. */}
        <ScenePart id="mini-pc" selected={is("mini-pc")} onSelect={select} position={internalPosition("mini-pc")}>
          <mesh castShadow>
            <boxGeometry args={[0.17, 0.075, 0.205]} />
            <PartMaterial selected={is("mini-pc")} color="#82929a" metalness={0.68} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0.039, 0]}>
            <boxGeometry args={[0.14, 0.006, 0.17]} />
            <meshStandardMaterial color="#263b48" metalness={0.5} roughness={0.4} />
          </mesh>
          {[-0.065, -0.035, -0.005, 0.025, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.043, 0]}>
              <boxGeometry args={[0.003, 0.002, 0.14]} />
              <meshStandardMaterial color="#a9bbc0" metalness={0.55} roughness={0.38} />
            </mesh>
          ))}
          <mesh position={[0.088, 0, 0.045]}>
            <boxGeometry args={[0.008, 0.022, 0.035]} />
            <meshStandardMaterial color="#d2a35d" metalness={0.25} roughness={0.48} />
          </mesh>
          <mesh position={[0.088, 0, -0.035]}>
            <boxGeometry args={[0.008, 0.022, 0.035]} />
            <meshStandardMaterial color="#5c7d91" metalness={0.38} roughness={0.42} />
          </mesh>
          <mesh position={[0.09, 0.02, 0.046]}>
            <sphereGeometry args={[0.008, 10, 8]} />
            <meshStandardMaterial color="#8cebf0" emissive="#1b6670" emissiveIntensity={0.35} />
          </mesh>
        </ScenePart>

        {/* Mega 2560: long PCB, headers, and representative chips. */}
        <ScenePart id="mega" selected={is("mega")} onSelect={select} position={internalPosition("mega")}>
          <mesh castShadow>
            <boxGeometry args={[0.105, 0.018, 0.225]} />
            <PartMaterial selected={is("mega")} color="#21865c" metalness={0.18} roughness={0.62} />
          </mesh>
          {[-0.045, 0.045].flatMap((x) =>
            [-0.085, -0.055, -0.025, 0.005, 0.035, 0.065, 0.095].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.012, z]}>
                <boxGeometry args={[0.008, 0.008, 0.008]} />
                <meshStandardMaterial color="#d1ad65" metalness={0.72} roughness={0.3} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.014, 0.012]}>
            <boxGeometry args={[0.047, 0.015, 0.054]} />
            <meshStandardMaterial color="#252f35" metalness={0.36} roughness={0.48} />
          </mesh>
          <mesh position={[0, 0.015, -0.067]}>
            <boxGeometry args={[0.042, 0.016, 0.037]} />
            <meshStandardMaterial color="#252f35" metalness={0.36} roughness={0.48} />
          </mesh>
          <mesh position={[0.055, 0.002, -0.09]}>
            <boxGeometry args={[0.014, 0.025, 0.036]} />
            <meshStandardMaterial color="#73838a" metalness={0.64} roughness={0.3} />
          </mesh>
        </ScenePart>

        {/* MPU6050: compact board and inertial-sensor package. */}
        <ScenePart id="imu" selected={is("imu")} onSelect={select} position={internalPosition("imu")}>
          <mesh castShadow>
            <boxGeometry args={[0.072, 0.014, 0.07]} />
            <PartMaterial selected={is("imu")} color="#246f53" metalness={0.18} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.011, -0.004]}>
            <boxGeometry args={[0.027, 0.013, 0.032]} />
            <meshStandardMaterial color="#222b31" metalness={0.38} roughness={0.46} />
          </mesh>
          {[-0.025, 0, 0.025].map((x) => (
            <mesh key={x} position={[x, 0.005, 0.036]}>
              <boxGeometry args={[0.006, 0.009, 0.009]} />
              <meshStandardMaterial color="#d4b36d" metalness={0.64} roughness={0.32} />
            </mesh>
          ))}
        </ScenePart>

        {/* Feru controller: finned drive-control enclosure with conceptual terminals. */}
        <ScenePart id="feru" selected={is("feru")} onSelect={select} position={internalPosition("feru")}>
          <mesh castShadow>
            <boxGeometry args={[0.17, 0.085, 0.19]} />
            <PartMaterial selected={is("feru")} color="#465966" metalness={0.76} roughness={0.31} />
          </mesh>
          {[-0.065, -0.035, -0.005, 0.025, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.045, 0]}>
              <boxGeometry args={[0.008, 0.012, 0.15]} />
              <meshStandardMaterial color="#9cabb0" metalness={0.72} roughness={0.28} />
            </mesh>
          ))}
          {[-0.055, 0, 0.055].map((x) => (
            <mesh key={x} position={[x, -0.01, 0.099]}>
              <boxGeometry args={[0.025, 0.025, 0.012]} />
              <meshStandardMaterial color="#d0a255" metalness={0.48} roughness={0.38} />
            </mesh>
          ))}
        </ScenePart>

        {/* Battery/BMS: pack volume and separate conceptual protection board. */}
        <ScenePart id="battery" selected={is("battery")} onSelect={select} position={internalPosition("battery")}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.075, 0.29]} />
            <PartMaterial selected={is("battery")} color="#435565" metalness={0.45} roughness={0.48} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.15, 0.008, 0.25]} />
            <meshStandardMaterial color="#c6c5b2" metalness={0.2} roughness={0.56} />
          </mesh>
          <mesh position={[0.055, 0.048, -0.115]}>
            <boxGeometry args={[0.065, 0.014, 0.048]} />
            <meshStandardMaterial color="#367a5d" metalness={0.2} roughness={0.58} />
          </mesh>
          <mesh position={[0.09, 0.043, -0.105]}>
            <sphereGeometry args={[0.009, 10, 8]} />
            <meshStandardMaterial color="#d7b15f" metalness={0.48} roughness={0.38} />
          </mesh>
        </ScenePart>

        {/* Conceptual connection runs: endpoints and paths are not a wiring diagram. */}
        <ScenePart id="wiring" selected={is("wiring")} onSelect={select}>
          {[
            { a: internalPosition("mini-pc"), b: internalPosition("mega"), color: "#e6b856" },
            { a: internalPosition("imu"), b: internalPosition("mega"), color: "#51d4c3" },
            { a: internalPosition("battery"), b: internalPosition("feru"), color: "#d76b55" },
            { a: internalPosition("mini-pc"), b: internalPosition("feru"), color: "#7c9ed0" },
            { a: internalPosition("battery"), b: internalPosition("mega"), color: "#d9b94e" },
          ].map(({ a, b, color }, index) => {
            const start = new THREE.Vector3(a[0], a[1], a[2]);
            const end = new THREE.Vector3(b[0], b[1], b[2]);
            const delta = end.clone().sub(start);
            const center = start.clone().add(end).multiplyScalar(0.5);
            return (
              <group key={index}>
                <mesh
                  position={center.toArray()}
                  quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize())}
                >
                  <cylinderGeometry args={[is("wiring") ? 0.005 : 0.003, is("wiring") ? 0.005 : 0.003, delta.length(), 7]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={is("wiring") ? 0.16 : 0.03} />
                </mesh>
                {[start, end].map((point, endpoint) => (
                  <mesh key={endpoint} position={point.toArray()}>
                    <sphereGeometry args={[0.009, 8, 6]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.16} />
                  </mesh>
                ))}
              </group>
            );
          })}
        </ScenePart>
      </>
      )}

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
  const [mode, setMode] = useState<ViewMode>("exterior");
  const [importedModel, setImportedModel] = useState<ImportedRoverModel | null>(null);
  const [selectedImportedPart, setSelectedImportedPart] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  const importRequestRef = useRef(0);
  const visibleParts = mode === "exterior" ? parts : internalParts;
  const detail = visibleParts.find((part) => part.id === selected) ?? visibleParts[0];
  const importedDetail = importedModel?.parts.find((part) => part.id === selectedImportedPart)
    ?? importedModel?.parts[0];
  const filteredImportedParts = importedModel?.parts.filter((part) =>
    part.name.toLocaleLowerCase().includes(partFilter.trim().toLocaleLowerCase()),
  ) ?? [];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!importedModel) return;
    return () => disposeObjectTree(importedModel.root);
  }, [importedModel]);

  const importGlb = async (file: File) => {
    const requestId = ++importRequestRef.current;
    let parsedScene: THREE.Object3D | null = null;
    setImportError("");
    setImportStatus("");
    setIsImporting(true);

    try {
      if (!file.name.toLocaleLowerCase().endsWith(".glb")) {
        throw new Error("Choose a .glb file. Other formats are not accepted by this importer.");
      }
      if (file.size > MAX_LOCAL_GLB_BYTES) {
        throw new Error("GLB files must be 50 MB or smaller.");
      }
      if (file.size === 0) {
        throw new Error("The selected GLB file is empty.");
      }

      const buffer = await file.arrayBuffer();
      if (requestId !== importRequestRef.current) return;
      validateLocalGlb(buffer);
      setImportStatus("Reading the local model…");

      const gltf = await parseLocalGlb(buffer);
      parsedScene = gltf.scene;
      const model = buildImportedModel(gltf.scene, file.name);
      parsedScene = null;
      if (requestId !== importRequestRef.current) {
        disposeObjectTree(model.root);
        return;
      }

      setImportedModel(model);
      setSelectedImportedPart(model.parts[0]?.id ?? "");
      setPartFilter("");
      setMode("exterior");
      setView("front");
      setImportStatus(
        `Loaded ${file.name}. Display is fitted to the viewer; original model units are not assumed.${model.partsTruncated ? " Only the first 300 named parts are listed." : ""}`,
      );
    } catch (error) {
      if (parsedScene) disposeObjectTree(parsedScene);
      if (requestId === importRequestRef.current) {
        setImportError(error instanceof Error ? error.message : "The GLB could not be loaded.");
      }
    } finally {
      if (requestId === importRequestRef.current) setIsImporting(false);
    }
  };

  const clearImportedModel = () => {
    importRequestRef.current += 1;
    setImportedModel(null);
    setSelectedImportedPart("");
    setPartFilter("");
    setIsImporting(false);
    setImportError("");
    setImportStatus("Showing the built-in rover concept.");
    setMode("exterior");
    setSelected("camera");
    setView("front");
  };

  const resetView = () => {
    setView("front");
    if (controlsRef.current) {
      controlsRef.current.target.set(0, mode === "internal" ? 0.55 : 0.35, 0);
      controlsRef.current.object.position.set(...(mode === "internal" ? internalViews.front : initialView.front));
      controlsRef.current.update();
    }
  };

  const changeMode = (nextMode: ViewMode) => {
    setMode(nextMode);
    setSelected(nextMode === "exterior" ? "camera" : "mini-pc");
    setView("front");
  };

  return (
    <section className="rover-model" aria-labelledby="rover-model-title">
      <header className="rover-model__header">
        <div>
          <div className="rover-model__eyebrow">
            <span className="rover-model__eyebrow-mark" aria-hidden="true" />
            ROVEROS / MODEL EXPLORER
          </div>
          <h1 id="rover-model-title">{importedModel ? "Imported rover model" : "Rover concept viewer"}</h1>
          <p className="rover-model__intro">
            {importedModel
              ? "Inspect the imported model and select named parts."
              : "Explore the exterior layout and the systems shown in the concept."}
          </p>
        </div>
        <div className="rover-model__status" aria-label={importedModel ? "Local GLB model loaded" : "Static concept model"}>
          <span className="rover-model__status-dot" aria-hidden="true" />
          {importedModel ? "IMPORTED GLB" : "STATIC CONCEPT"}
        </div>
      </header>

      <div className="rover-model__notice" role="note">
        <ShieldAlert size={17} aria-hidden="true" />
        <p>
          {importedModel ? (
            <>
              <strong>Local file only.</strong> The GLB is parsed in this browser and is not uploaded.
              The display is normalized to fit; its original units and engineering accuracy are not assumed.
            </>
          ) : (
            <>
              <strong>Visual concept only.</strong> Shapes and component locations are
              inferred and approximate—not an exact CAD model, telemetry display, or
              rover control interface.
            </>
          )}
        </p>
      </div>

      <div className="rover-model__workspace">
        <div className="rover-model__viewer-column">
          <div className={`rover-model__canvas-wrap ${!importedModel && mode === "internal" ? "is-internal" : ""}`}>
          <div className="rover-model__canvas-label" aria-hidden="true">
              <span>ROVER / {importedModel ? "IMPORTED MODEL" : mode === "exterior" ? "EXTERIOR" : "INTERNAL SYSTEMS"}</span>
              <span>{importedModel ? "FIT TO VIEWER / SOURCE UNITS UNKNOWN" : mode === "exterior" ? `${ROVER_MODEL_SPEC.body.lengthMm} × ${ROVER_MODEL_SPEC.body.widthMm} × ${ROVER_MODEL_SPEC.body.heightMm} MM NOMINAL` : "EXPLODED / CONCEPTUAL ARRANGEMENT"}</span>
            </div>
            <div className="rover-model__canvas" role="img" aria-label={importedModel ? "Interactive 3D view of the locally imported rover model. Drag to rotate. Select named parts to highlight them." : mode === "exterior" ? "Interactive 3D visual concept of the rover exterior. Drag to rotate, use the controls for standard views." : "Interactive 3D conceptual exploded view of internal rover modules and illustrative wiring. Drag to rotate, use the controls for standard views."}>
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
                  importedModel={importedModel}
                  selectedImportedPart={selectedImportedPart}
                  onSelectImportedPart={setSelectedImportedPart}
                  view={view}
                  mode={mode}
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
              {!importedModel && (
                <div className="rover-model__mode-toggle" role="group" aria-label="Choose rover model view">
                  <button type="button" onClick={() => changeMode("exterior")} aria-pressed={mode === "exterior"} className={mode === "exterior" ? "is-active" : ""}>
                    Exterior
                  </button>
                  <button type="button" onClick={() => changeMode("internal")} aria-pressed={mode === "internal"} className={mode === "internal" ? "is-active" : ""}>
                    Internal / exploded
                  </button>
                </div>
              )}
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
              <button
                type="button"
                className="rover-model__import"
                onClick={() => glbInputRef.current?.click()}
                disabled={isImporting}
                aria-describedby="rover-model-import-help"
              >
                <Upload size={14} aria-hidden="true" />
                {isImporting ? "Loading…" : importedModel ? "Replace GLB" : "Import GLB"}
              </button>
              {importedModel && (
                <button type="button" className="rover-model__clear-import" onClick={clearImportedModel}>
                  <X size={14} aria-hidden="true" />
                  Use concept
                </button>
              )}
            </div>
          </div>
          <input
            ref={glbInputRef}
            className="rover-model__file-input"
            type="file"
            accept=".glb,model/gltf-binary"
            aria-label="Choose a local GLB file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void importGlb(file);
            }}
          />
          <div className="rover-model__import-feedback">
            <p id="rover-model-import-help">
              GLB 2.0 only · maximum 50 MB · local to this browser · external file links are rejected.
            </p>
            {importStatus && <p role="status" aria-live="polite">{importStatus}</p>}
            {importError && <p className="is-error" role="alert">{importError}</p>}
          </div>
          <div className="rover-model__dimensions" aria-label={importedModel ? "Imported model display note" : mode === "exterior" ? "Approximate exterior dimensions" : "Conceptual internal layout caveat"}>
            {importedModel ? (
              <>
                <span><b>MODEL</b> {importedModel.fileName}</span>
                <span><b>SCALE</b> Fit to viewer</span>
                <span className="rover-model__approx">SOURCE UNITS UNKNOWN</span>
              </>
            ) : mode === "exterior" ? (
              <>
                <span><b>BODY ENVELOPE</b> {ROVER_MODEL_SPEC.body.lengthMm} × {ROVER_MODEL_SPEC.body.widthMm} × {ROVER_MODEL_SPEC.body.heightMm} mm</span>
                <span><b>WHEEL Ø</b> ~{ROVER_MODEL_SPEC.wheels.diameterMm} mm</span>
                <span><b>WHEEL WIDTH</b> ~{ROVER_MODEL_SPEC.wheels.widthMm} mm</span>
                <span className="rover-model__approx">ALL DIMENSIONS APPROXIMATE</span>
              </>
            ) : (
              <span className="rover-model__approx">MODULE PLACEMENTS + CONNECTION POINTS ARE INDIVIDUALLY CONCEPTUAL — VERIFY ON MACHINE</span>
            )}
          </div>
        </div>

        <aside className="rover-model__sidebar" aria-label="Rover components">
          <div className="rover-model__side-heading">
            <div>
              <span className="rover-model__section-kicker">{importedModel ? "IMPORTED MODEL" : "SYSTEM MAP"}</span>
              <h2>{importedModel ? "Named parts" : mode === "exterior" ? "Major components" : "Internal systems"}</h2>
            </div>
            <span className="rover-model__count">
              {String(importedModel ? importedModel.parts.length : visibleParts.length).padStart(2, "0")}
            </span>
          </div>

          {importedModel ? (
            <>
              <label className="rover-model__part-search">
                <span>Filter named parts</span>
                <input
                  type="search"
                  value={partFilter}
                  onChange={(event) => setPartFilter(event.currentTarget.value)}
                  placeholder="Search part names"
                />
              </label>
              <div className="rover-model__part-list is-imported" aria-label="Select an imported model part">
                {filteredImportedParts.map((part, index) => (
                  <button
                    key={part.id}
                    type="button"
                    className={`rover-model__part ${selectedImportedPart === part.id ? "is-selected" : ""}`}
                    aria-pressed={selectedImportedPart === part.id}
                    onClick={() => setSelectedImportedPart(part.id)}
                  >
                    <span className="rover-model__part-number">{String(index + 1).padStart(2, "0")}</span>
                    <Box size={16} aria-hidden="true" />
                    <span className="rover-model__part-name">{part.name}</span>
                    <span className="rover-model__part-indicator" aria-hidden="true" />
                  </button>
                ))}
                {filteredImportedParts.length === 0 && (
                  <p className="rover-model__empty-parts">No named parts match this search.</p>
                )}
              </div>
              <section className="rover-model__detail" aria-live="polite" aria-atomic="true">
                <div className="rover-model__detail-topline">
                  <span>GLB / SELECTED PART</span>
                  <span className="rover-model__approx-tag">LOCAL FILE</span>
                </div>
                <h3>{importedDetail?.name ?? "No part selected"}</h3>
                <p>
                  {importedDetail
                    ? "Part name comes from the GLB node. The cyan outline marks its approximate bounds; it does not indicate a verified physical dimension."
                    : "Try another search or clear the filter to see the imported part names."}
                </p>
                {importedDetail && (
                  <div className="rover-model__location">
                    <span>NODE TYPE</span>
                    <strong>{importedDetail.object.type}</strong>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="rover-model__part-list" aria-label="Select a component">
                {visibleParts.map((part, index) => {
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
                  <span className="rover-model__approx-tag">{mode === "internal" ? "CONCEPTUAL / APPROX." : "INFERRED"}</span>
                </div>
                <h3>{detail.name}</h3>
                <p>{detail.description}</p>
                <div className="rover-model__location">
                  <span>{mode === "internal" ? "CONCEPTUAL PLACEMENT" : "LOCATION"}</span>
                  <strong>{detail.position}</strong>
                </div>
              </section>
            </>
          )}
          <div className="rover-model__footnote">
            <ShieldAlert size={14} aria-hidden="true" />
            <span>
              {importedModel
                ? "Imported geometry is displayed locally. Part selection uses names embedded in the GLB."
                : "Selection highlights a visual element only. No live rover data."}
            </span>
          </div>
        </aside>
      </div>
      <p className="rover-model__sr-hint" aria-live="polite">
        {importedModel
          ? `Selected imported part: ${importedDetail?.name ?? "none"}. Use the named-parts list to inspect another part.`
          : `Selected component: ${detail.name}. Use the component list to inspect another part.`}
      </p>
    </section>
  );
}
