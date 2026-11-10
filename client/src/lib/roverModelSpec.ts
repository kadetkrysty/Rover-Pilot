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
