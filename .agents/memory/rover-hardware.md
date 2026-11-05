---
name: Rover hardware
description: User-confirmed rover orientation sensor and driving inputs.
---

The user confirms: “the rover has an IMU6050” and lists gamepad, joystick and
FlySky as ways to drive it. They want the rover IMU integrated for orientation.
The current project calls that sensor MPU6050.
The user also confirms the wheel controller uses Hoverboard with Feru FOC
firmware.

**Why:** these are user-confirmed physical hardware requirements, not merely
devices supported by the source code.

**How to apply:** use actual rover sensor telemetry when presenting orientation.
Do not substitute the Android/Windows device's orientation for the rover's.
