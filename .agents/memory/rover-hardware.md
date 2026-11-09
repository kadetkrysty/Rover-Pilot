---
name: Rover hardware
description: User-confirmed rover orientation sensor and driving inputs.
---

The user confirms: “the rover has an IMU6050” and lists gamepad, joystick and
FlySky as ways to drive it. They want the rover IMU integrated for orientation.
The current project calls that sensor MPU6050.
The user also confirms the wheel controller uses Hoverboard with Feru FOC
firmware.

The main body must be at least 600 mm long, 400 mm wide, and 200 mm high.

**Why:** these are user-confirmed physical hardware requirements, not merely
devices supported by the source code.

**How to apply:** use actual rover sensor telemetry when presenting orientation.
Do not substitute the Android/Windows device's orientation for the rover's.
Keep the finished body envelope at or above the stated minimum in mechanical
layouts and fabrication drawings.
