# Autonomous Rover Firmware & Control System

This directory contains the firmware and control software for the SLAM-enabled autonomous rover.

## Directory Structure

```
firmware/
├── arduino_mega_sensor_controller/
│   └── arduino_mega_sensor_controller.ino    # Arduino Mega controller sketch
├── raspberry_pi_master/
│   └── rover_controller.py                   # Raspberry Pi master controller
└── README.md                                 # This file
```

## Hardware Stack

### Master Controller
- **Raspberry Pi 3 B+** - Main computer running Python web server
- Communicates with Arduino via USB serial (115200 baud)
- Serves REST API to web dashboard on port 8080

### Sensor Controller
- **Arduino Mega 2560** - Sensor fusion and hoverboard control
- Reads all sensors and sends telemetry to Pi
- Receives movement commands from Pi

### Actuators
- **Hoverboard Mainboard (Emmanuel Feru FOC firmware)** - Drive motors
- **UART connection** to Arduino (pins 18/19)

### Sensors

| Sensor | Protocol | Arduino Pin | Purpose |
|--------|----------|-------------|---------|
| HuskyLens AI Camera | I2C | 20/21 | Object detection, obstacle avoidance |
| TF Mini Pro Lidar | Serial3 | 16/17 | Distance measurement for navigation |
| MPU6050 IMU | I2C | 20/21 | Pitch, roll, heading (6-axis) |
| Neo-6M GPS | Serial2 | 14/15 | Geolocation tracking |
| HC-SR04 x5 | Digital I/O | 22-31 | Ultrasonic array for obstacle detection |

## Installation & Setup

### Arduino Setup (Windows/Mac/Linux)

1. **Download Arduino IDE**: https://www.arduino.cc/en/software
2. **Install Board Support**:
   - Board: Arduino Mega or Mega 2560
   - Processor: ATmega2560
3. **Install Libraries**:
   ```
   - HuskyLens (from Library Manager)
   - MPU6050 (by I2C DevicesElectronics)
   - SoftwareSerial (built-in)
   ```
4. **Upload**:
   - Open `arduino_mega_sensor_controller.ino`
   - Select Board: Arduino Mega 2560
   - Select Port: COM port where Mega is connected
   - Click Upload

5. **Serial Monitor**:
   - Set baud to 115200
   - You should see: `[SYSTEM] Arduino Mega Sensor Controller READY`

### Raspberry Pi Setup

1. **SSH into Pi**:
   ```bash
   ssh pi@raspberrypi.local
   ```

2. **Update system**:
   ```bash
   sudo apt update && sudo apt upgrade
   ```

3. **Install Python dependencies**:
   ```bash
   sudo apt install python3-pip
   pip3 install flask flask-cors pyserial
   ```

4. **Upload Python script**:
   ```bash
   # Copy rover_controller.py to Pi
   scp rover_controller.py pi@raspberrypi.local:/home/pi/
   ```

5. **Run the controller**:
   ```bash
   python3 /home/pi/rover_controller.py
   ```

6. **Verify connection**:
   - You should see: `[OK] Connected to Arduino on /dev/ttyACM0`
   - The Pi web server starts on port 8080

## Wiring Diagram

### Power Distribution
```
[36V Battery]
   ├──> Hoverboard Mainboard (36V direct)
   │    └──> Motors (left/right)
   │
   └──> DC-DC Converter 36V → 5V/5A
        ├──> Raspberry Pi (USB power)
        │    └──> USB Camera
        │
        └──> Arduino Mega (VIN pin)
             ├──> Sensors (5V rail)
             └──> HuskyLens (5V)
```

### Communication Lines
```
Raspberry Pi (USB) ←→ Arduino Mega (UART)
                           ├─ Serial1 (pins 18/19) ←→ Hoverboard (TX/RX with level shifter!)
                           ├─ Serial2 (pins 14/15) ←→ GPS Module
                           ├─ Serial3 (pins 16/17) ←→ Lidar TF Mini
                           ├─ I2C (pins 20/21)     ←→ HuskyLens
                           ├─ I2C (pins 20/21)     ←→ MPU6050
                           └─ Digital I/O          ←→ Ultrasonic Array (5x)
```

### Level Shifting (Critical!)
The Hoverboard TX/RX operates at **3.3V**, but Arduino pins are **5V**. Use a level shifter:
- TXO (Hoverboard 3.3V) → Level Shifter → RX1 (Arduino 5V)
- TX1 (Arduino 5V) → Level Shifter → RXI (Hoverboard 3.3V)

Recommended: **TC4427** or **74LVC245** level shifter IC

## API Endpoints

### Telemetry
```
GET /api/telemetry
Returns: {speed, battery, heading, pitch, roll, lidar, ultrasonic[], gps, mode, log}
```

### Control
```
POST /api/control
Body: {"throttle": -100..100, "steering": -100..100}
Example: {"throttle": 50, "steering": -20}  # Forward-left
```

### Stop
```
POST /api/stop
Emergency stop (sets throttle/steering to 0)
```

### Status
```
GET /api/status
Returns: {arduino_connected, mode, timestamp}
```

## Command Protocol (Arduino ↔ Pi)

### Telemetry (Pi ← Arduino) - JSON per line
```json
{"spd":5.2,"bat":82.0,"hdg":45.0,"pitch":2.1,"roll":-1.5,"lidar":120,"ultra":[150,200,45,180,190]}
```

### Commands (Pi → Arduino) - Text per line
```
MOVE:100,50      # throttle=100, steering=50
STOP             # Emergency stop
PING             # Test connection
```

## Autonomous SLAM Integration

The rover is ready for SLAM (Simultaneous Localization and Mapping):
- **Lidar**: TF Mini Pro provides range data
- **IMU**: MPU6050 tracks heading changes
- **GPS**: Neo-6M provides coarse positioning
- **Camera**: HuskyLens detects obstacles

To implement:
1. Use `robot_localization` package (ROS) or `g2o` (C++)
2. Feed lidar + IMU data into EKF
3. Output navigation commands to `/api/control`

## Troubleshooting

### Arduino not detected on Pi
```bash
ls /dev/ttyACM*
# Should show /dev/ttyACM0 or similar
```

### Hoverboard not responding
- Check level shifter connections (very common issue!)
- Verify baud rate is 115200
- Test with hoverboard's native app first

### GPS not acquiring fix
- Needs clear sky view (requires ~5-10 minutes first fix)
- Check antenna connection
- Verify Serial2 (pins 14/15) connections

### Sensor readings wrong
- Verify I2C pull-up resistors (4.7kΩ typical)
- Check Wire.begin() is called
- Try different I2C address (default 0x68 for MPU6050, 0x32 for HuskyLens)

## Next Steps

1. ✅ Sensor reading & telemetry
2. ✅ Manual joystick control
3. 🔄 Implement SLAM navigation
4. 🔄 Add waypoint following
5. 🔄 Integrate with dashboard for autonomous mission planning

## References

- Emmanuel Feru Hoverboard: https://github.com/EmanuelFeru/hoverboard-firmware-hack-FOC
- TF Mini Pro: https://www.sparkfun.com/products/14588
- HuskyLens: https://www.dfrobot.com/product-1922.html
- MPU6050: https://invensense.tdk.com/products/motion-tracking/6-axis/mpu-6050/

---

Last Updated: December 29, 2025
