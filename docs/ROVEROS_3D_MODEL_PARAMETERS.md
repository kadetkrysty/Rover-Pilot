# RoverOS image-derived 3D model parameters

## What the reference image tells us

The 505 × 649 px image is a cropped, perspective concept render. It shows a
low six-wheel rover, three wheels per side, articulated exposed wheel links,
a broad rectangular body, a raised camera mast, a three-aperture head, cyan
front lamps with a red centre marker, and several roof-mounted accessories.
The image contains no scale reference, orthographic views, part drawings, or
camera calibration. Pixel measurements cannot establish real component
dimensions or hidden geometry.

## Model coordinate system

- **X:** forward from the front face toward the rear.
- **Y:** lateral distance from the body centreline.
- **Z:** height above ground.
- All dimensions below are millimetres.

The interactive viewer maps this physical convention into its 3D scene. Drag
or touch-drag to orbit; selecting a component highlights it and opens its
description. The viewer is a visual concept, not a CAD release, rover-control
surface, or live telemetry view.

## Importing an external 3D model

The viewer accepts one self-contained **GLB 2.0** file up to 50 MB. The model
is parsed locally in the browser; it is not uploaded or saved by RoverOS.
External buffer and image links are rejected. Export textures and geometry
inside the GLB file before importing.

The viewer scales the model to fit the viewport. This is for display only:
original units, measurements, orientation, and engineering accuracy are not
preserved as verified facts. Named nodes in the GLB appear in the part list and
can be outlined; useful part selection depends on meaningful names in the
source model. The “Use concept” control returns to the built-in exterior and
internal views.

Other formats could be supported with Three.js loaders, but are not accepted by
the current importer. STL is useful for individual CAD parts but often lacks
materials and assembly hierarchy. OBJ commonly depends on separate material and
texture files. glTF JSON can also reference sidecar resources. Those formats
need additional multi-file handling and validation before they can be imported
safely and reliably.

## Internal / exploded-view hardware

The internal view is an explanatory layout, not a measured assembly drawing.
The project identifies an ACEPC AK1 Mini PC, Mega 2560, MPU6050/IMU6050, a
Hoverboard drive controller using Feru FOC firmware, and a battery/BMS. Their
actual installation, battery chemistry and ratings, mounting positions,
dimensions, connector locations, and pin assignments have not been verified.

The following coordinates and display envelopes are **approximate visual
placeholders only**. Coordinates use X from the front face toward the rear, Y
across the rover centreline, and Z above ground. Display envelopes are ordered
X × Y × Z. They must not be used for fabrication, installation, clearance, or
electrical work.

| Component | Approximate display centre X / Y / Z (mm) | Schematic display envelope X × Y × Z (mm) | Role |
| --- | ---: | ---: | --- |
| ACEPC AK1 Mini PC | 421 / −105 / 570 | 205 × 183 × 83 | RoverOS host computer |
| Mega 2560 | 256 / 75 / 535 | 225 × 124 × 32 | Low-level I/O and hardware interfaces |
| MPU6050 / IMU6050 | 131 / −15 / 670 | 81 × 72 × 25 | Inertial orientation and motion sensing |
| Feru FOC controller | 491 / 115 / 575 | 210 × 170 × 93 | Hoverboard drive controller |
| Battery + BMS | 181 / −106 / 490 | 290 × 189 × 93 | Battery pack and battery management |
| Interconnect wiring | 301 / 0 / 570 | No enclosure | Simplified harness routes |

The view can indicate conceptual paths such as USB serial between the Mini PC
and Mega 2560, a sensor bus between the MPU6050 and Mega 2560, and power/data
paths involving the battery/BMS and drive controller. These labels describe
system roles only. The displayed points and routes are not verified terminals,
connectors, pinouts, cable gauges, or wiring instructions; confirm all of them
against the actual equipment and wiring before servicing.

## Parameter schedule

| Feature | Initial model value | Evidence / confidence |
| --- | --- | --- |
| Main body envelope | 602 × 402 × 202 mm | User-confirmed minimum is 600 × 400 × 200 mm; nominal value is only 2 mm above each limit |
| Wheel count | 6; 3 per side | Directly visible in the render |
| Wheel locations | X = 45, 301, 557; Y = ±260; centre Z = 82.5 | Concept layout estimate, not measurable from the perspective image |
| Wheel envelope | Ø165 × 50 mm | Placeholder from the previous concept drawing; verify actual tires and hubs |
| Visible suspension links | 6 simplified links | Visual interpretation; pivot and drive arrangement are unknown |
| Link length | 177 mm centre-to-centre | Placeholder from the previous concept drawing |
| Mast above roof | 220 mm post plus 70 mm head height; 290 mm total | Concept estimate; image has no scale |
| Mast section | 30 × 30 mm square | Placeholder; material and wall thickness are not established by the image |
| Camera head envelope | 140 × 70 × 60 mm | Approximate placeholder; optics, apertures, and camera models are unknown |
| Camera apertures | 3 forward-facing positions | Directly visible; exact lens sizes and sensor functions are unknown |
| Front lamps | 2 cyan lamps and 1 red centre marker | Directly visible; electrical ratings and actual lamp dimensions are unknown |
| Front range-sensor positions | 5 placeholders | Informed by the project's listed sensor inventory; exact arrangement must match the real modules |
| Roof accessories | Scanning puck, GPS/antenna, physical stop control | Visible concept placeholders; exact hardware and locations require confirmation |

## Project hardware to represent

The project records an ACEPC AK1 Mini PC with 8 GB RAM, a Mega 2560 controller,
an MPU6050/IMU6050, and a hoverboard drive controller using Feru FOC firmware.
The internal view represents these devices, a battery/BMS, and simplified
wiring as individually selectable schematic placeholders. Component
placements, display envelopes, and connection points are all concept estimates,
not measured hardware data.
Other listed/previously discussed devices include HUSKYLENS, HC-SR04 modules,
TF Mini Pro, NEO-6M GPS, FlySky receiver, camera, and lights. Their presence in
the software inventory does not confirm that each has been physically
installed. The 3D view uses generic selectable markers where exact device
dimensions or mounting details are not confirmed.

## Confidence classes

- **User dimension:** explicit size requirement from the user.
- **Image visible:** count or broad form can be observed in the render.
- **Project hardware:** hardware listed for the project, not necessarily verified as installed.
- **Concept estimate:** a working visual-model value that needs physical measurement.

## Required measurements before fabrication

Measure the actual tires, motor hubs, axle and pivot locations, complete body
outline, mast and camera package, sensor boards, connector clearance, battery,
and service access. Replace estimates with measured values before creating
fabrication or load-bearing drawings. This image alone cannot establish
material, wall thickness, suspension travel, payload, strength, braking, or
waterproofing.
