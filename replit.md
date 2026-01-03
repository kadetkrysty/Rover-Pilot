# RoverOS - Autonomous Rover Control System

## Overview

RoverOS is a full-stack web application for controlling and monitoring an autonomous rover. The system provides a telemetry dashboard with live camera feed visualization, manual driving controls (gamepad and RC transmitter support), GPS waypoint navigation, and system diagnostics. The application runs on a Mini PC (Intel Celeron) as the master controller, communicating with an Arduino Mega for sensor fusion, while serving a React-based control interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Hardware Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROVER SYSTEM v3.0                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     USB Serial      ┌──────────────────┐  │
│  │   MINI PC       │◄──────────────────► │  ARDUINO MEGA    │  │
│  │  Intel Celeron  │     115200 baud     │     2560         │  │
│  │  8GB RAM        │                     │                  │  │
│  │  Ubuntu OS      │                     │  Sensors:        │  │
│  │                 │                     │  - TF Mini Pro   │  │
│  │  Runs:          │                     │  - MPU6050 IMU   │  │
│  │  - Web Server   │                     │  - Neo-6M GPS    │  │
│  │  - WebSocket    │                     │  - 5x Ultrasonic │  │
│  │  - SLAM/EKF     │                     │  - HuskyLens     │  │
│  │                 │                     │                  │  │
│  └────────┬────────┘                     │  RC Control:     │  │
│           │                              │  - iBUS (Serial1)│  │
│           │ WiFi                         └────────┬─────────┘  │
│           ▼                                       │            │
│  ┌─────────────────┐                     ┌────────▼─────────┐  │
│  │  WEB DASHBOARD  │                     │ FLYSKY FS-IA10B  │  │
│  │  React + Vite   │                     │  (iBUS Protocol) │  │
│  │  Mobile/Desktop │                     └──────────────────┘  │
│  └─────────────────┘                              ▲            │
│                                                   │ 2.4GHz     │
│  ┌─────────────────┐                     ┌────────┴─────────┐  │
│  │  HOVERBOARD     │◄── UART ── Arduino  │ FLYSKY FS-I6x    │  │
│  │  FOC Controller │                     │  Transmitter     │  │
│  └─────────────────┘                     └──────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom HUD-style theme (dark, military-tech aesthetic)
- **Animations**: Framer Motion for smooth UI transitions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend presents a heads-up display (HUD) style interface with telemetry panels, camera feed visualization, joystick controls, and navigation mapping via Google Maps integration.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx/esbuild
- **API Structure**: RESTful endpoints under `/api/` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Development**: Vite dev server with HMR proxied through Express

The Express server handles API routes for routes/waypoints management, telemetry logging, and rover configuration. In development, Vite middleware serves the frontend with hot module replacement.

### Hardware Integration Layer
Python modules in `firmware/raspberry_pi_master/` (runs on Mini PC):
- **rover_controller.py**: Flask-based REST API with WebSocket support, auto-detects Arduino via USB serial (115200 baud)
- **flysky_receiver.py**: iBUS protocol interface (Arduino handles decoding, module provides API compatibility)
- **pathfinding.py**: Waypoint navigation with Haversine distance calculations and bearing computation
- **google_maps_integration.py**: Route optimization via Google Maps Directions API

### Real-Time Communication (WebSocket)
- **Endpoint**: `/ws/telemetry` - WebSocket server for live telemetry streaming
- **Authentication**: Role-based (rover, operator, viewer) with token authentication
  - Tokens stored in `rover_config` table (`rover_auth_token`, `operator_auth_token`)
  - Only authenticated clients receive telemetry/SLAM broadcasts
  - Commands only accepted from authenticated operators
- **Protocol**: JSON messages with `type` field (auth, telemetry, command, lidar_scan, slam_update)
- **Client Hook**: `useWebSocket()` in `client/src/lib/useWebSocket.ts`

### Sensor Fusion & SLAM
- **Extended Kalman Filter (EKF)**: 5-state vector (x, y, θ, v, gyro_bias) for pose estimation
- **Occupancy Grid SLAM**: 200x200 grid, 5cm resolution, log-odds updates with Bresenham ray tracing
- **Frontend Component**: `SlamMapViewer.tsx` with Canvas rendering, rover position, uncertainty ellipse

### Data Flow
1. Sensors → Arduino Mega (I2C/Serial/Digital) → USB Serial → Mini PC
2. Mini PC Python controller → WebSocket/REST API (port 5000)
3. Web dashboard receives real-time telemetry via WebSocket
4. User commands flow back through WebSocket to authenticated rover clients

### Mobile/Native Support
- **Capacitor**: Configured for Android APK builds
- **PWA**: Service worker for offline support, manifest for installable web app

## Hardware Components

### Controller Boards
| Component | Description | Connection |
|-----------|-------------|------------|
| Mini PC (Intel Celeron) | Main controller, 8GB RAM, Ubuntu | USB to Arduino |
| Arduino Mega 2560 | Sensor hub, iBUS receiver | USB Serial 115200 |
| Raspberry Pi 3 B+ | Camera pan/tilt controller | WiFi to Mini PC (TCP 5002) |

### Camera Pan/Tilt System
| Component | Description | Connection |
|-----------|-------------|------------|
| SlushEngine Model X LT | 4-motor stepper driver HAT | GPIO 40-pin on RPi 3B+ |
| NEMA 17 Pan Motor | Horizontal rotation ±180° | SlushEngine Motor Port 1 |
| NEMA 17 Tilt Motor | Vertical rotation ±90° | SlushEngine Motor Port 2 |

### Sensors
| Component | Interface | Arduino Pins |
|-----------|-----------|--------------|
| TF Mini Pro LIDAR | Serial | Serial2 (16/17) |
| MPU6050 IMU | I2C | SDA/SCL (20/21) |
| Neo-6M GPS | Serial | Serial3 (14/15) |
| HuskyLens AI Camera | I2C | SDA/SCL (20/21) |
| HC-SR04 Ultrasonic (×5) | Digital | 22-31 |

### RC Control
| Component | Protocol | Connection |
|-----------|----------|------------|
| FlySky FS-I6x Transmitter | 2.4GHz | Wireless to receiver |
| FlySky FS-IA10B Receiver | iBUS | Arduino Pin 19 (RX1) |

### Motors
| Component | Interface | Connection |
|-----------|-----------|------------|
| Hoverboard Mainboard | UART | Arduino SoftwareSerial (10/11) |

## Wiring Diagrams

### Arduino Mega Pin Mapping
```
Arduino Mega 2560 Pin Assignment
================================

USB ─────────────────────── Mini PC (Serial 115200)

Serial1 (iBUS):
  Pin 19 (RX1) ─────────── FS-IA10B iBUS Signal
  
Serial2 (LIDAR):
  Pin 16 (TX2) ─────────── TF Mini Pro RX
  Pin 17 (RX2) ─────────── TF Mini Pro TX

Serial3 (GPS):
  Pin 14 (TX3) ─────────── Neo-6M RX
  Pin 15 (RX3) ─────────── Neo-6M TX

I2C:
  Pin 20 (SDA) ─────────── MPU6050 SDA, HuskyLens SDA
  Pin 21 (SCL) ─────────── MPU6050 SCL, HuskyLens SCL

Hoverboard (SoftwareSerial):
  Pin 10 (RX) ──────────── Hoverboard TX
  Pin 11 (TX) ──────────── Hoverboard RX

Ultrasonic Sensors:
  Pin 22 (TRIG1) ───────── HC-SR04 #1 Trigger
  Pin 23 (ECHO1) ───────── HC-SR04 #1 Echo
  Pin 24 (TRIG2) ───────── HC-SR04 #2 Trigger
  Pin 25 (ECHO2) ───────── HC-SR04 #2 Echo
  Pin 26 (TRIG3) ───────── HC-SR04 #3 Trigger
  Pin 27 (ECHO3) ───────── HC-SR04 #3 Echo
  Pin 28 (TRIG4) ───────── HC-SR04 #4 Trigger
  Pin 29 (ECHO4) ───────── HC-SR04 #4 Echo
  Pin 30 (TRIG5) ───────── HC-SR04 #5 Trigger
  Pin 31 (ECHO5) ───────── HC-SR04 #5 Echo

Power:
  5V ───────────────────── Sensors, FS-IA10B
  GND ──────────────────── All grounds
```

### FlySky iBUS Wiring
```
FlySky FS-IA10B (iBUS Mode)
===========================

FS-IA10B Receiver          Arduino Mega
-----------------          ------------
iBUS Pin ─────────────────► Pin 19 (RX1)
VCC (5V) ─────────────────► 5V
GND ──────────────────────► GND

Note: Set transmitter output mode to "iBUS" in settings.
Only 1 signal wire needed for all 10 channels!
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for routes, waypoints, telemetry logs, and rover configuration
- Connection via `DATABASE_URL` environment variable
- Schema managed with Drizzle Kit migrations

### Third-Party Services
- **Google Maps API**: Used for waypoint navigation, route visualization, and place search (Autocomplete)
  - Requires `GOOGLE_MAPS_API_KEY` environment variable (optional - graceful fallback if not configured)

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management
- `@react-google-maps/api`: Google Maps React components
- `drizzle-orm` / `postgres`: Database connectivity
- `framer-motion`: Animation library
- `@radix-ui/*`: Accessible UI primitives
- `@capacitor/*`: Native mobile builds
- `ws`: WebSocket server

### Arduino Libraries
- `IBusBM`: FlySky iBUS protocol decoder
- `Wire`: I2C communication
- `SoftwareSerial`: Additional serial ports

## Recent Changes

### v3.1.0 (2026-01-03)
- Added Camera Pan/Tilt System with Raspberry Pi 3 B+ and SlushEngine Model X LT
- Pan motor (Motor 1): ±180° horizontal rotation
- Tilt motor (Motor 2): ±90° vertical rotation
- TCP server on port 5002 for camera control commands
- Integrated with PS4 controller left stick for camera control
- Added Three.js 3D simulation with HuskyLens-style object detection overlay
- Documentation tab with wiring diagrams and installation guides

### v3.0.0 (2025-01-02)
- Migrated from Raspberry Pi 3B+ to Mini PC (Intel Celeron)
- Changed FlySky receiver from GPIO PWM to Arduino iBUS protocol
- Single-wire connection for all 10 RC channels
- Auto-detection of Arduino USB port
- Improved sensor fusion with proper EKF covariance updates
- Added WebSocket authentication for secure telemetry

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   │   └── ThreeRoverSimulation.tsx  # 3D rover simulation
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities, API, sensor fusion
├── server/                # Express backend
│   ├── routes.ts          # API endpoints + WebSocket
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry
├── shared/                # Shared types
│   └── schema.ts          # Drizzle ORM schema
├── firmware/              # Hardware code
│   ├── arduino_mega_sensor_controller/
│   │   └── *.ino          # Arduino firmware
│   ├── raspberry_pi_master/  # Runs on Mini PC
│   │   ├── rover_controller.py
│   │   ├── flysky_receiver.py
│   │   └── pathfinding.py
│   └── raspberry_pi_camera_controller/  # Runs on RPi 3B+
│       ├── camera_pantilt_controller.py  # SlushEngine control
│       ├── requirements.txt
│       └── install.sh      # Installation script
└── docs/                  # Documentation
```
