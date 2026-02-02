# RoverOS Firmware v3.0.0

This directory contains the firmware for the RoverOS autonomous rover system.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ROVER CONTROL SYSTEM                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      USB Serial      ┌──────────────────┐
│    MINI PC       │◄────────────────────►│  ARDUINO MEGA    │
│  Intel Celeron   │    115200 baud       │     2560         │
│  Ubuntu 20.04    │                      │                  │
│                  │                      │  Sensors:        │
│  rover_controller│                      │  - TF Mini Pro   │
│  WebSocket API   │                      │  - MPU6050       │
│  SLAM/EKF        │                      │  - GPS Neo-6M    │
│  Web Dashboard   │                      │  - Ultrasonic x5 │
│                  │                      │  - HuskyLens     │
│  Port 5000       │                      │                  │
│                  │                      │  RC Control:     │
│                  │                      │  - iBUS Protocol │
└────────┬─────────┘                      └────────┬─────────┘
         │                                         │
         │  WebSocket                              │
         │  (pan/tilt cmds)                        │
         ▼                                         ▼
┌──────────────────┐                      ┌──────────────────┐
│  RASPBERRY PI    │                      │ FlySky FS-IA10B  │
│    3 B+          │                      │   10-Channel     │
│                  │                      │   iBUS Receiver  │
│  Camera Pan/Tilt │                      └──────────────────┘
│  Controller      │                               ▲
│                  │                               │
│  Port 5001       │                      ┌────────┴─────────┐
└────────┬─────────┘                      │ FlySky FS-I6x    │
         │                                │   Transmitter    │
         │  SPI                           │   2.4GHz         │
         ▼                                └──────────────────┘
┌──────────────────┐
│  SLUSHENGINE     │
│  Model X LT      │
│                  │
│  Motor 1: Pan    │──► Pan Stepper Motor (±180°)
│  Motor 2: Tilt   │──► Tilt Stepper Motor (±90°)
│                  │
│  12V Power       │
└──────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              MOTOR CONTROL SYSTEM                             │
└──────────────────────────────────────────────────────────────────────────────┘

Arduino Mega ──► UART (SoftwareSerial 10/11) ──► Hoverboard FOC Controller
                                                          │
                                                          ├──► Left Wheel Motor
                                                          └──► Right Wheel Motor

┌──────────────────────────────────────────────────────────────────────────────┐
│                              POWER DISTRIBUTION                               │
└──────────────────────────────────────────────────────────────────────────────┘

36V LiPo Battery ──┬──► Hoverboard Mainboard (36V direct)
                   │
                   └──► DC-DC Buck Converter (36V → 5V/5A)
                              │
                              ├──► Mini PC (USB-C PD)
                              ├──► Arduino Mega (USB)
                              ├──► Raspberry Pi 3 B+ (micro USB)
                              └──► All 5V sensors
```

## Directory Structure

```
firmware/
├── arduino_mega_sensor_controller/
│   └── arduino_mega_sensor_controller.ino  # Arduino firmware v3.0
├── mini_pc_master/                         # Runs on Mini PC (Intel Celeron)
│   ├── rover_controller.py                 # Main controller
│   ├── flysky_receiver.py                  # iBUS interface
│   ├── pathfinding.py                      # Navigation
│   └── google_maps_integration.py          # Route planning
├── raspberry_pi_camera_controller/         # Runs on Raspberry Pi 3 B+
│   ├── camera_pantilt_controller.py        # Pan/Tilt motor control
│   ├── install.sh                          # Setup script
│   └── requirements.txt                    # Python dependencies
└── README.md                               # This file
```

## Hardware Components

### Controller Boards
| Component | Description | Connection |
|-----------|-------------|------------|
| Mini PC (Intel Celeron) | Main controller, 8GB RAM, Ubuntu 20.04 | USB to Arduino, WebSocket to Raspberry Pi |
| Arduino Mega 2560 | Sensor hub, iBUS receiver | USB Serial 115200 to Mini PC |
| Raspberry Pi 3 B+ | Camera pan/tilt controller | WebSocket from Mini PC (port 5001) |
| SlushEngine Model X LT | Stepper motor driver HAT | SPI to Raspberry Pi GPIO |

### Sensors
| Sensor | Protocol | Arduino Pins | Purpose |
|--------|----------|--------------|---------|
| TF Mini Pro | Serial2 | 16/17 | LIDAR distance |
| MPU6050 | I2C | 20/21 | IMU (pitch/roll/heading) |
| Neo-6M | Serial3 | 14/15 | GPS location |
| HuskyLens | I2C | 20/21 | AI camera |
| HC-SR04 x5 | Digital | 22-31 | Ultrasonic array |

### RC Control
| Component | Protocol | Connection |
|-----------|----------|------------|
| FlySky FS-I6x | 2.4GHz | Transmitter |
| FlySky FS-IA10B | iBUS | Arduino Pin 19 |

### Motors
| Component | Interface | Connection |
|-----------|-----------|------------|
| Hoverboard Mainboard | UART | Arduino SoftwareSerial 10/11 |

---

## Arduino Firmware Setup

### Prerequisites

1. **Arduino IDE 2.x** - [Download](https://www.arduino.cc/en/software)
2. **Required Libraries** (install via Library Manager):
   - `IBusBM` by bmellink - FlySky iBUS decoder
   - Wire (built-in)
   - SoftwareSerial (built-in)

### Installation

1. Open `arduino_mega_sensor_controller.ino`
2. Select **Board**: Arduino Mega 2560
3. Select **Processor**: ATmega2560
4. Select **Port**: Your Arduino's COM port
5. Click **Upload**

### Verify Installation

Open Serial Monitor at 115200 baud:
```
{"event":"boot","version":"3.0.0","controller":"Arduino Mega 2560"}
{"event":"ready","ibus":true,"channels":10}
```

---

## Mini PC Host Setup

### Prerequisites

- Ubuntu 20.04+ or any Linux
- Python 3.8+

### Installation

```bash
cd firmware/mini_pc_master

# Install dependencies
pip install flask flask-cors flask-socketio pyserial

# Add user to dialout group (for serial access)
sudo usermod -aG dialout $USER

# Reboot or logout/login for group to take effect
```

### Running the Controller

```bash
python3 rover_controller.py
```

Expected output:
```
============================================================
  ROVER MASTER CONTROLLER v3.0.0
  Mini PC Host - Ubuntu / Intel Celeron
  RC: FlySky FS-I6x + FS-IA10B (iBUS Protocol)
============================================================

[OK] Connected to Arduino on /dev/ttyACM0
[INIT] Starting server on 0.0.0.0:5000
[INIT] Press Ctrl+C to stop
```

### Auto-Start on Boot

Create a systemd service:

```bash
sudo nano /etc/systemd/system/rover.service
```

```ini
[Unit]
Description=RoverOS Controller
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/firmware/mini_pc_master
ExecStart=/usr/bin/python3 rover_controller.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable rover
sudo systemctl start rover
```

---

## Raspberry Pi Camera Controller Setup

The Raspberry Pi 3 B+ controls the camera pan/tilt mechanism using the SlushEngine Model X LT stepper motor driver.

### Prerequisites

- Raspberry Pi 3 B+ (or newer)
- Raspbian OS / Raspberry Pi OS
- SlushEngine Model X LT HAT
- Python 3.7+

### Hardware Setup

1. **Mount SlushEngine HAT** onto the Raspberry Pi GPIO header
2. **Connect stepper motors**:
   - Motor 1 (Port 1): Pan motor
   - Motor 2 (Port 2): Tilt motor
3. **Power**: Connect 12V power supply to SlushEngine

### Installation

```bash
cd firmware/raspberry_pi_camera_controller

# Run the install script
chmod +x install.sh
./install.sh

# Or install manually:
pip3 install -r requirements.txt

# Enable SPI interface
sudo raspi-config
# Navigate to: Interface Options → SPI → Enable
```

### Running the Controller

```bash
python3 camera_pantilt_controller.py
```

Expected output:
```
============================================================
  CAMERA PAN/TILT CONTROLLER v1.0.0
  Raspberry Pi 3 B+ + SlushEngine Model X LT
============================================================

[OK] SlushEngine initialized
[OK] Motor 1 (Pan) ready - Range: ±180°
[OK] Motor 2 (Tilt) ready - Range: ±90°
[INIT] Starting WebSocket server on 0.0.0.0:5001
[INIT] Waiting for commands from Mini PC...
```

### Auto-Start on Boot

```bash
sudo nano /etc/systemd/system/camera-pantilt.service
```

```ini
[Unit]
Description=RoverOS Camera Pan/Tilt Controller
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/firmware/raspberry_pi_camera_controller
ExecStart=/usr/bin/python3 camera_pantilt_controller.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable camera-pantilt
sudo systemctl start camera-pantilt
```

### Network Configuration

The camera controller listens on port 5001 for WebSocket commands from the Mini PC:

| Command | Description | Parameters |
|---------|-------------|------------|
| `pan` | Rotate camera horizontally | `angle: -180 to 180` |
| `tilt` | Rotate camera vertically | `angle: -90 to 90` |
| `home` | Return to center position | None |
| `stop` | Stop all motors | None |

---

## Wiring Diagrams

### Arduino Mega Pin Assignment

```
Arduino Mega 2560 Pin Assignment v3.0
=====================================

USB ─────────────────────── Mini PC (Serial 115200)

Serial1 (iBUS - FlySky Receiver):
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
  Pin 10 (RX) ──────────── Hoverboard TX (via level shifter!)
  Pin 11 (TX) ──────────── Hoverboard RX (via level shifter!)

Ultrasonic Sensors:
  Pin 22/23 ────────────── HC-SR04 #1 (Front Center)
  Pin 24/25 ────────────── HC-SR04 #2 (Front Left)
  Pin 26/27 ────────────── HC-SR04 #3 (Front Right)
  Pin 28/29 ────────────── HC-SR04 #4 (Rear Left)
  Pin 30/31 ────────────── HC-SR04 #5 (Rear Right)

Status LED:
  Pin 13 ───────────────── Built-in LED (heartbeat)

Power:
  5V ───────────────────── All sensors, FS-IA10B receiver
  GND ──────────────────── Common ground
```

### FlySky iBUS Wiring

```
FlySky FS-IA10B to Arduino Mega (iBUS Protocol)
================================================

    FS-IA10B Receiver              Arduino Mega
    -----------------              ------------
    iBUS Pin ───────────────────► Pin 19 (RX1)
    VCC (5V) ───────────────────► 5V
    GND ────────────────────────► GND

Benefits of iBUS vs PWM:
✓ Single wire for all 10 channels (vs 10 wires for PWM)
✓ Digital signal - more accurate than PWM
✓ ~143 Hz update rate
✓ Built-in failsafe detection

Transmitter Setup:
1. Power on FS-I6x while holding "BIND KEY"
2. Go to System → Output Mode → Set to "iBUS"
3. Save and power cycle
```

### Power Distribution

```
Power Wiring Diagram
====================

[36V LiPo Battery]
       │
       ├──────────────────────► Hoverboard Mainboard
       │                              │
       │                              ├──► Left Motor
       │                              └──► Right Motor
       │
       └──► [DC-DC Buck Converter 36V → 5V/5A]
                     │
                     ├──► Mini PC (USB-C PD or barrel jack)
                     │
                     └──► Arduino Mega (VIN or USB)
                               │
                               ├──► TF Mini Pro (5V)
                               ├──► MPU6050 (3.3V from Arduino)
                               ├──► Neo-6M GPS (3.3V-5V)
                               ├──► HuskyLens (5V)
                               ├──► HC-SR04 x5 (5V)
                               └──► FS-IA10B Receiver (5V)
```

---

## iBUS Protocol Details

### What is iBUS?

iBUS (Intelligent Bus) is FlySky's digital serial protocol that sends all RC channels on a single wire at 115200 baud. The Arduino IBusBM library decodes this into individual channel values.

### Channel Mapping

| Channel | FlySky FS-I6x Control | PWM Range | Use Case |
|---------|----------------------|-----------|----------|
| CH1 | Right Stick Horizontal | 1000-2000 | Steering |
| CH2 | Right Stick Vertical | 1000-2000 | (Unused) |
| CH3 | Left Stick Vertical | 1000-2000 | Throttle |
| CH4 | Left Stick Horizontal | 1000-2000 | (Unused) |
| CH5 | Switch A (SwA) | 1000/2000 | Mode select |
| CH6 | Switch B (SwB) | 1000/2000 | Lights/Horn |
| CH7 | Switch C (SwC) | 1000/1500/2000 | Speed limit |
| CH8 | Switch D (SwD) | 1000/2000 | E-Stop |
| CH9 | Variable Dial A | 1000-2000 | Fine adjust |
| CH10 | Variable Dial B | 1000-2000 | Fine adjust |

### Telemetry Format

Arduino sends JSON at 20Hz:

```json
{
  "t": 123456,
  "gps": {"lat": 34.0522, "lng": -118.2437, "spd": 0, "acc": 5},
  "imu": {"hdg": 45.0, "pitch": 1.2, "roll": -0.5, "ax": 0, "ay": 0, "az": 1},
  "lidar": 150,
  "ultra": [50, 45, 60, 55, 48],
  "ibus": {"con": true, "ch": [1500,1500,1000,1500,1000,1000,1500,1000,1500,1500]},
  "bat": 85.0
}
```

---

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry` | GET | Current sensor data |
| `/api/control` | POST | `{throttle, steering}` |
| `/api/stop` | POST | Emergency stop |
| `/api/mode` | POST | `{mode: "MANUAL"/"RC"/"AUTONOMOUS"}` |
| `/api/ibus` | GET | RC channel values |
| `/api/status` | GET | Connection status |
| `/api/system/info` | GET | System information |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `telemetry` | Server→Client | Full sensor data |
| `command` | Client→Server | `{type, throttle, steering}` |
| `status` | Server→Client | Connection updates |

---

## Troubleshooting

### Arduino Not Detected

```bash
# Check if Arduino is connected
ls /dev/ttyACM* /dev/ttyUSB*

# Add user to dialout group
sudo usermod -aG dialout $USER
# Then logout and login again

# Check USB cable is data-capable (not charge-only)
```

### iBUS Not Working

1. Verify receiver is bound (solid LED, not blinking)
2. Check iBUS wire is connected to Pin 19 (RX1)
3. Verify transmitter is set to iBUS output mode
4. Power cycle the receiver

### No GPS Lock

- GPS needs clear sky view
- First fix takes 5-10 minutes
- Check antenna connection
- Verify Serial3 wiring (pins 14/15)

### I2C Sensors Not Responding

```bash
# On Arduino, run I2C scanner sketch
# Expected addresses:
# - MPU6050: 0x68 or 0x69
# - HuskyLens: 0x32
```

### Hoverboard Not Responding

- Use logic level shifter (Arduino 5V ↔ Hoverboard 3.3V)
- Verify SoftwareSerial pins (10/11)
- Check baud rate is 115200
- Test with hoverboard's native Bluetooth app first

---

## Version History

### v3.0.0 (2025-01-02)
- **Major**: Migrated from Raspberry Pi 3B+ to Mini PC (Intel Celeron)
- **Major**: Added iBUS protocol support (replaces 10-wire GPIO PWM)
- Single-wire RC connection for all 10 channels
- Auto-detection of Arduino USB port
- Improved GPS NMEA parsing with decimal degree output
- Enhanced JSON telemetry format
- WebSocket support with Flask-SocketIO

### v2.4.0 (2024-12-29)
- Added HuskyLens AI camera support
- Improved ultrasonic sensor timing
- Added waypoint navigation API

### v2.0.0 (2024-12-01)
- Initial sensor fusion implementation
- Added EKF for position estimation

---

## References

- [IBusBM Library](https://github.com/bmellink/IBusBM)
- [Emmanuel Feru FOC Firmware](https://github.com/EmanuelFeru/hoverboard-firmware-hack-FOC)
- [TF Mini Pro Datasheet](https://www.sparkfun.com/products/14588)
- [HuskyLens Wiki](https://wiki.dfrobot.com/HUSKYLENS_V1.0_SKU_SEN0305_SEN0336)
- [MPU6050 Register Map](https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf)

---

Last Updated: January 2, 2025
