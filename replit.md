# RoverOS - Autonomous Rover Control System

## Overview

RoverOS is a full-stack web application designed for the control and monitoring of an autonomous rover. It provides a comprehensive telemetry dashboard, live camera feed visualization, and diverse control options including manual driving (gamepad and RC transmitter support) and GPS waypoint navigation. The system also offers advanced features like real-time system diagnostics, sensor fusion, and Simultaneous Localization and Mapping (SLAM). The primary goal is to provide a robust, intuitive, and secure interface for operating autonomous ground vehicles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is a React 18 application with TypeScript, utilizing Wouter for routing and TanStack React Query for server state management. UI components are built with shadcn/ui (based on Radix UI) and styled using Tailwind CSS v4, featuring a distinct HUD-style, dark, military-tech aesthetic. Framer Motion is integrated for smooth UI transitions, and the entire interface is optimized for both mobile and desktop use, including PWA support and Capacitor for native Android builds.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS v4, Framer Motion, Vite.
- **Backend**: Node.js with Express, TypeScript (compiled with `tsx`/`esbuild`), providing RESTful APIs and WebSocket services.
- **Hardware Integration**: Python modules running on a Mini PC (Intel Celeron) manage communication with an Arduino Mega (sensor hub) and other peripherals. This includes a Flask-based REST API with WebSocket support, iBUS protocol handling, and pathfinding algorithms.
- **Real-time Communication**: A WebSocket server (`/ws/telemetry`) streams live telemetry and SLAM data. It implements role-based authentication (rover, operator, viewer) using tokens stored in the `rover_config` table to secure data and commands.
- **Sensor Fusion & SLAM**: An Extended Kalman Filter (EKF) with a 5-state vector (x, y, θ, v, gyro_bias) is used for robust pose estimation. Occupancy Grid SLAM (200x200 grid, 5cm resolution) employs log-odds updates and Bresenham ray tracing for environmental mapping.
- **Mobile/Native Support**: Capacitor is configured for Android APK builds, and a service worker enables PWA functionality for offline support and installability.

### Feature Specifications
- **Telemetry Dashboard**: Displays live sensor data, rover status, and system diagnostics.
- **Camera Feed**: Live visualization with pan/tilt control (Raspberry Pi 3 B+ based).
- **Control Interfaces**: Manual driving via gamepad and RC transmitter (FlySky FS-I6x via iBUS protocol), and GPS waypoint navigation.
- **SLAM Map Viewer**: Frontend component (`SlamMapViewer.tsx`) visualizes the occupancy grid, rover position, and uncertainty ellipse with real LIDAR data.
- **360° Radar Scanner**: RadarScanner.tsx displays full 360° LIDAR point cloud with intensity-based coloring.
- **LIDAR Obstacle Avoidance**: Integrated into RC control loop - automatically adjusts throttle/steering to avoid obstacles detected by 360° LIDAR.
- **3D Simulation**: Three.js-based simulation with object detection overlay.

### LIDAR API Endpoints
- `/api/lidar/scan` - Full 360° point cloud data (angle, distance, intensity)
- `/api/lidar/sectors` - Sector-based obstacle map (8 directional zones)
- `/api/lidar/closest` - Nearest obstacle detection
- `/api/lidar/obstacles` - Obstacles within specified range/angle

### System Design Choices
- **Master Controller**: Mini PC (Intel Celeron) running Ubuntu, hosting the web server, WebSocket, and SLAM/EKF processes.
- **Sensor Hub**: Arduino Mega 2560 handles sensor data acquisition (IMU, GPS, Ultrasonic, HuskyLens) and RC receiver input, communicating with the Mini PC via USB Serial.
- **360° LIDAR**: YDLIDAR T-mini Plus connected directly to Mini PC via USB (CP2102 chip, 230400 baud). Driver module (`ydlidar_driver.py`) handles full 360° scan parsing with XOR checksum validation, obstacle detection in 8 directional sectors, and real-time streaming via WebSocket.
- **Motor Control**: Hoverboard FOC Controller connected via UART to the Arduino.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for routes, waypoints, telemetry logs, and rover configuration. Managed with Drizzle ORM and Drizzle Kit migrations.

### Third-Party Services
- **Google Maps API**: Utilized for waypoint navigation, route visualization, and place search (Autocomplete).

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management.
- `@react-google-maps/api`: Google Maps React components.
- `drizzle-orm` / `postgres`: Database connectivity.
- `framer-motion`: Animation library.
- `@radix-ui/*`: Accessible UI primitives.
- `@capacitor/*`: Native mobile builds.
- `ws`: WebSocket server.

### Arduino Libraries
- `IBusBM`: FlySky iBUS protocol decoder.
- `Wire`: I2C communication.
- `SoftwareSerial`: Additional serial ports.