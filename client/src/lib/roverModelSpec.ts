export type ModelEvidence =
  | "user-dimension"
  | "image-visible"
  | "concept-estimate"
  | "project-hardware";

export interface RoverModelPart {
  id: string;
  name: string;
  description: string;
  evidence: ModelEvidence;
  dimensionsMm?: readonly number[];
}

export interface RoverInternalComponent {
  id: string;
  name: string;
  role: string;
  placementMm: {
    fromFrontMm: number;
    lateralMm: number;
    aboveGroundMm: number;
  };
  visualEnvelopeMm: readonly [number, number, number];
  connections: readonly {
    targetId: string;
    label: string;
  }[];
}

export const ROVER_MODEL_SPEC = {
  units: "mm",
  coordinateSystem: {
    x: "forward from front face toward rear",
    y: "left/right from body centreline",
    z: "up from ground",
  },
  minimumBodyEnvelopeMm: [600, 400, 200],
  body: {
    lengthMm: 602,
    widthMm: 402,
    heightMm: 202,
    baseAboveGroundMm: 200,
    evidence: "concept-estimate",
  },
  wheels: {
    count: 6,
    diameterMm: 165,
    widthMm: 50,
    centerXMm: [45, 301, 557],
    centerYMm: [-260, 260],
    centerZMm: 82.5,
    evidence: "concept-estimate",
  },
  suspension: {
    visibleLinkCount: 6,
    nominalLinkCenterToCenterMm: 177,
    evidence: "concept-estimate",
  },
  mast: {
    tubeHeightAboveRoofMm: 220,
    tubeSectionMm: [30, 30],
    headEnvelopeMm: [140, 70, 60],
    totalStackAboveRoofMm: 290,
    evidence: "concept-estimate",
  },
  internalHardware: {
    placementEvidence: "concept-estimate",
    dimensionsEvidence: "concept-estimate",
    coordinateSystem: "fromFrontMm follows model X; lateralMm is model Y; aboveGroundMm is model Z.",
    components: [
      {
        id: "mini-pc",
        name: "ACEPC AK1 Mini PC",
        role: "RoverOS host computer for high-level processing and system services.",
        placementMm: { fromFrontMm: 421, lateralMm: -105, aboveGroundMm: 570 },
        visualEnvelopeMm: [205, 183, 83],
        connections: [
          { targetId: "mega-2560", label: "USB serial link (conceptual)" },
          { targetId: "feru-foc", label: "Drive-control data path (conceptual)" },
          { targetId: "battery-bms", label: "Power supply path (conceptual)" },
        ],
      },
      {
        id: "mega-2560",
        name: "Mega 2560",
        role: "Microcontroller for low-level rover I/O and hardware interfaces.",
        placementMm: { fromFrontMm: 256, lateralMm: 75, aboveGroundMm: 535 },
        visualEnvelopeMm: [225, 124, 32],
        connections: [
          { targetId: "mini-pc", label: "USB serial link (conceptual)" },
          { targetId: "mpu6050", label: "Sensor bus (conceptual)" },
          { targetId: "feru-foc", label: "Control / status signals (conceptual)" },
          { targetId: "battery-bms", label: "Low-voltage supply path (conceptual)" },
        ],
      },
      {
        id: "mpu6050",
        name: "MPU6050 / IMU6050",
        role: "Inertial measurement for rover orientation and motion sensing.",
        placementMm: { fromFrontMm: 131, lateralMm: -15, aboveGroundMm: 670 },
        visualEnvelopeMm: [81, 72, 25],
        connections: [
          { targetId: "mega-2560", label: "Sensor bus (conceptual)" },
        ],
      },
      {
        id: "feru-foc",
        name: "Feru FOC controller",
        role: "Hoverboard drive controller running Feru FOC firmware.",
        placementMm: { fromFrontMm: 491, lateralMm: 115, aboveGroundMm: 575 },
        visualEnvelopeMm: [210, 170, 93],
        connections: [
          { targetId: "mini-pc", label: "Drive-control data path (conceptual)" },
          { targetId: "mega-2560", label: "Control / status signals (conceptual)" },
          { targetId: "battery-bms", label: "Battery power path (conceptual)" },
        ],
      },
      {
        id: "battery-bms",
        name: "Battery + BMS",
        role: "Battery pack and battery-management system; chemistry and ratings are unverified.",
        placementMm: { fromFrontMm: 181, lateralMm: -106, aboveGroundMm: 490 },
        visualEnvelopeMm: [290, 189, 93],
        connections: [
          { targetId: "mini-pc", label: "Power supply path (conceptual)" },
          { targetId: "mega-2560", label: "Low-voltage supply path (conceptual)" },
          { targetId: "feru-foc", label: "Battery power path (conceptual)" },
        ],
      },
      {
        id: "wiring",
        name: "Interconnect wiring",
        role: "Simplified cable paths between the depicted controller, computer, sensor, and power components.",
        placementMm: { fromFrontMm: 301, lateralMm: 0, aboveGroundMm: 570 },
        visualEnvelopeMm: [0, 0, 0],
        connections: [
          { targetId: "mini-pc", label: "Conceptual harness route" },
          { targetId: "mega-2560", label: "Conceptual harness route" },
          { targetId: "mpu6050", label: "Conceptual sensor lead" },
          { targetId: "feru-foc", label: "Conceptual drive harness" },
          { targetId: "battery-bms", label: "Conceptual power harness" },
        ],
      },
    ] satisfies readonly RoverInternalComponent[],
  },
  parts: [
    {
      id: "chassis",
      name: "Main chassis",
      description: "Low rectangular body with protective perimeter and segmented dark roof deck.",
      evidence: "image-visible",
      dimensionsMm: [602, 402, 202],
    },
    {
      id: "wheel-assemblies",
      name: "Six-wheel running gear",
      description: "Three large treaded wheels on each side with cyan hub accents.",
      evidence: "image-visible",
      dimensionsMm: [165, 50],
    },
    {
      id: "suspension-links",
      name: "Articulated wheel links",
      description: "Exposed metallic swing/link arms between the body and wheel stations.",
      evidence: "image-visible",
      dimensionsMm: [177],
    },
    {
      id: "camera-mast",
      name: "Camera mast",
      description: "Raised central post supporting the forward sensor head.",
      evidence: "image-visible",
      dimensionsMm: [30, 30, 220],
    },
    {
      id: "camera-head",
      name: "Three-aperture camera head",
      description: "Forward-facing central camera with two side apertures; exact optics unknown.",
      evidence: "image-visible",
      dimensionsMm: [140, 70, 60],
    },
    {
      id: "front-lights",
      name: "Front lighting",
      description: "Two cyan lamps and a red centre marker on the front face.",
      evidence: "image-visible",
    },
    {
      id: "range-sensors",
      name: "Front range-sensor placeholders",
      description: "Five front-facing sensor positions; match the installed sensor board before drilling.",
      evidence: "project-hardware",
    },
    {
      id: "roof-sensors",
      name: "Roof sensor placeholders",
      description: "Low-profile scanning puck, GPS receiver/antenna, and a physical stop control.",
      evidence: "image-visible",
    },
  ] satisfies readonly RoverModelPart[],
} as const;

export function getRoverModelPart(id: string): RoverModelPart | undefined {
  return ROVER_MODEL_SPEC.parts.find((part) => part.id === id);
}
