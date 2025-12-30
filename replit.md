# RoverOS - Autonomous Rover Control System

## Overview

RoverOS is a full-stack web application for controlling and monitoring an autonomous rover. The system provides a telemetry dashboard with live camera feed visualization, manual driving controls (gamepad and RC transmitter support), GPS waypoint navigation, and system diagnostics. The application is designed to run on a Raspberry Pi as the master controller, communicating with an Arduino Mega for sensor fusion, while serving a React-based control interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

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
Python modules in `firmware/raspberry_pi_master/` handle:
- **rover_controller.py**: Flask-based REST API running on the Raspberry Pi, communicating with Arduino via USB serial (115200 baud)
- **flysky_receiver.py** / **flybaby_receiver.py**: GPIO-based PWM reading for RC transmitter receivers (10-channel support)
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
1. Sensors → Arduino Mega (I2C/Serial/Digital) → USB Serial → Raspberry Pi
2. Raspberry Pi Python controller → WebSocket/REST API (port 5000)
3. Web dashboard receives real-time telemetry via WebSocket
4. User commands flow back through WebSocket to authenticated rover clients

### Mobile/Native Support
- **Capacitor**: Configured for Android APK builds
- **PWA**: Service worker for offline support, manifest for installable web app

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for routes, waypoints, telemetry logs, and rover configuration
- Connection via `DATABASE_URL` environment variable
- Schema managed with Drizzle Kit migrations

### Third-Party Services
- **Google Maps API**: Used for waypoint navigation, route visualization, and place search (Autocomplete)
  - Requires `GOOGLE_MAPS_API_KEY` environment variable (optional - graceful fallback if not configured)

### Hardware Sensors (Arduino Mega)
- HuskyLens AI Camera (I2C) - Object detection
- TF Mini Pro Lidar (Serial3) - Distance measurement
- MPU6050 IMU (I2C) - Orientation sensing
- Neo-6M GPS (Serial2) - Geolocation
- HC-SR04 Ultrasonic Array (5 sensors) - Obstacle detection
- Hoverboard Mainboard (UART) - Motor control via Emmanuel Feru FOC firmware

### RC Controller Support
- FlySky FS-I6x with FS-IA10B receiver (10 PWM channels via GPIO)
- Standard gamepad support via Web Gamepad API (PS4/Xbox controllers)

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management
- `@react-google-maps/api`: Google Maps React components
- `drizzle-orm` / `postgres`: Database connectivity
- `framer-motion`: Animation library
- `@radix-ui/*`: Accessible UI primitives
- `@capacitor/*`: Native mobile builds