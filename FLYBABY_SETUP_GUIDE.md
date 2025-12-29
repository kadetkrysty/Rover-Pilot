# FlyBaby FS-I6x / FS-IA10B Rover Control Setup Guide

## Overview

This guide explains how to set up and use the FlyBaby FS-I6x 2.4GHz radio transmitter with your autonomous rover using the RoverOS dashboard.

## Hardware Required

### Radio Transmitter
- **FlyBaby FS-I6x** 2.4GHz Radio Controller
  - 6-channel transmitter
  - High sensitivity receiver (FS-IA10B)
  - 500m range (open field)
  - Two 3.7V LiPo batteries or AA batteries

### Receiver Module
- **FS-IA10B** PWM Receiver
  - 10 channels (using 6 for rover control)
  - 3.3V-5V compatible
  - PPM & PWM output modes

### Wiring (Raspberry Pi ↔ Receiver)

```
FS-IA10B Receiver Pins → Raspberry Pi GPIO (BCM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Channel 1 (Roll)      → GPIO 17 (Pin 11)
Channel 2 (Pitch)     → GPIO 27 (Pin 13)
Channel 3 (Throttle)  → GPIO 22 (Pin 15)
Channel 4 (Yaw)       → GPIO 23 (Pin 16)
Channel 5 (Switch A)  → GPIO 24 (Pin 18)
Channel 6 (Switch B)  → GPIO 25 (Pin 22)

GND (Black)           → GND (Pin 6, 9, 14, 20, 30, 34, 39)
VCC (Red)             → 5V (Pin 2 or 4)

⚠️ IMPORTANT: Use a 3.3V level shifter between receiver (3.3V) and GPIO pins!
```

## Receiver Wiring Diagram

```
       FS-IA10B Receiver
    ┌─────────────────────┐
    │  CH1  CH2  CH3  CH4 │
    │  CH5  CH6  GND  VCC │
    └─────────────────────┘
    
Each channel outputs PWM signal:
- 1000µs = Full Left/Minimum
- 1500µs = Center
- 2000µs = Full Right/Maximum
```

## Installation Steps

### 1. Install Python GPIO Library

```bash
ssh pi@raspberrypi.local
sudo apt install python3-rpi.gpio
sudo apt install python3-pip
pip3 install RPi.GPIO
```

### 2. Copy FlyBaby Module

```bash
scp flybaby_receiver.py pi@raspberrypi.local:/home/pi/
```

### 3. Update Rover Controller

Add to `rover_controller.py`:

```python
from flybaby_receiver import initialize_flybaby, receiver

# In __main__:
initialize_flybaby()

# Add routes:
@app.route('/api/flybaby/input', methods=['GET'])
def get_flybaby_input():
    if receiver is None:
        return jsonify({'connected': False}), 503
    return jsonify(receiver.get_status())

@app.route('/api/flybaby/control', methods=['POST'])
def flybaby_control():
    if receiver is None:
        return jsonify({'error': 'FlyBaby not available'}), 503
    
    status = receiver.get_status()
    throttle = (status['channel3'] - 1000) / 1000 * 100
    steering = (status['channel1'] - 1500) / 500 * 100
    
    drive_rover(throttle, steering)
    return jsonify({'status': 'ok'})
```

### 4. Enable GPIO Access

```bash
sudo usermod -a -G gpio pi
# Log out and back in
```

## FlyBaby Transmitter Setup

### Binding Receiver to Transmitter

1. **Power on transmitter** (FS-I6x) - sticks will center automatically
2. **Hold receiver bind button** while powering on
3. **Release button** when LED starts blinking
4. **Press bind button on transmitter**
5. **LED turns solid** = Binding successful

### Transmitter Configuration

#### Model Setup
1. Press **SYS** button
2. Select **Transmitter Setup**
3. Set: Model Type = **Acro** (for manual rover control)

#### Channel Assignment
```
Stick Left   → Channel 1 (Roll/Steering)
Stick Up     → Channel 2 (Pitch - optional)
Throttle     → Channel 3 (Forward/Reverse)
Stick Right  → Channel 4 (Yaw Rotation)
Switch L     → Channel 5 (Record/Camera)
Switch R     → Channel 6 (Mode: Manual/Autonomous)
```

#### Switch Configuration
1. Go to **Function Setup**
2. Assign switches:
   - **Switch A** (L): 0 = OFF, 1 = ON
   - **Switch B** (R): 0 = Manual, 1 = Autonomous

#### Calibration
1. Press **SYS** → **Calibration**
2. Move all sticks to extremes
3. Center all sticks
4. Press **SAVE**

## Using FlyBaby in RoverOS

### 1. Connect to Dashboard

- Open RoverOS app
- Click **FLYBABY** button in navigation
- Check **Connection Status**
- Wait for signal strength bar to appear (green)

### 2. Manual Driving

- **Left Stick (Horizontal)** → Steer left/right
- **Left Stick (Vertical)** → Forward/reverse throttle
- **Right Stick** → Secondary controls (camera)
- **Switch A** → Toggle features
- **Switch B** → Switch modes

### 3. Mode Selection

**Switch B OFF** = Manual Mode
- Full joystick control
- Direct throttle from stick
- Steering proportional to stick angle

**Switch B ON** = Autonomous Mode
- Follows waypoints
- Speed controlled by throttle
- Auto-heading correction

### 4. Emergency Stop

- **Throttle Stick DOWN** → Immediate stop
- **Failsafe (>1sec signal loss)** → Auto-stop & return home

## Web Dashboard Controls

### FlyBaby Control Page

```
┌────────────────────────────────────────┐
│  FLYBABY RECEIVER CONTROL              │
│  FS-I6x / FS-IA10B Manual & Auto      │
├────────────────────────────────────────┤
│                                        │
│  Connection: ✓ CONNECTED              │
│  Signal: ████ 92%                     │
│                                        │
│  Channel Display Grid:                 │
│  ┌─────────────┬─────────────┐        │
│  │ CH1 - Roll  │ CH2 - Pitch │        │
│  │ 1523µs      │ 1489µs      │        │
│  │ Steering: 0.15            │        │
│  └─────────────┴─────────────┘        │
│                                        │
│  ┌─────────────┬─────────────┐        │
│  │ CH3 - THR   │ CH4 - Yaw   │        │
│  │ 1200µs      │ 1500µs      │        │
│  │ Power: 20%  │ Rotation: 0 │        │
│  └─────────────┴─────────────┘        │
│                                        │
│  ┌─────────────┬─────────────┐        │
│  │ CH5 - SW A  │ CH6 - SW B  │        │
│  │ 1800µs      │ 2100µs      │        │
│  │ ● ON        │ ● ON        │        │
│  └─────────────┴─────────────┘        │
│                                        │
└────────────────────────────────────────┘
```

### Real-Time Monitoring

- **PWM Values** (1000-2000µs) update at 50Hz
- **Signal Strength** shows receiver quality (0-100%)
- **Failsafe Status** alerts if signal is lost
- **Frame Rate** displays input frequency (should be ~50Hz)

## Advanced Setup

### Multiple Receiver Binding

Use with multiple vehicles:

```bash
# List transmitter models
# Create new model per vehicle
# Bind separate FS-IA10B to each model
# Switch models on transmitter
```

### Range Testing

1. Power on rover with receiver
2. Open **FlyBaby Control** page
3. Walk away slowly
4. Watch signal strength bar
5. Note maximum range before failsafe activates

### Fail-Safe Configuration

On receiver (FS-IA10B):

1. Bind transmitter
2. Set each channel to desired failsafe position:
   - CH1 (Steering) → 1500µs (center)
   - CH3 (Throttle) → 1000µs (off)
   - CH6 (Mode) → 1000µs (manual)
3. Power off transmitter (signal loss simulation)
4. Receiver should hold those PWM values

## Troubleshooting

### No Connection

**Problem**: "FlyBaby Receiver Not Detected"

**Solutions**:
```bash
# Check GPIO pins connected
gpio readall

# Test GPIO directly
python3 -c "import RPi.GPIO as GPIO; GPIO.setmode(GPIO.BCM); GPIO.setup(17, GPIO.IN); print(GPIO.input(17))"

# Check receiver power (multimeter on VCC/GND)
# Should show 5V

# Verify level shifter if using 3.3V
```

### Weak Signal

**Problem**: Signal strength < 50%

**Solutions**:
- Move closer to rover (2-3 meters)
- Remove obstacles between transmitter and receiver
- Check antenna is not damaged
- Verify 5V power to receiver (proper voltage)

### Channels Not Responding

**Problem**: All channels reading 1500µs (center)

**Solutions**:
```bash
# Check receiver is bound
# Re-bind following "Binding" section above

# Verify GPIO pin assignments
# Test with oscilloscope if available

# Check Python errors
sudo python3 rover_controller.py
```

### Failsafe Triggers Too Often

**Problem**: "Signal Lost" alerts constantly

**Solutions**:
- Check antenna connector is secure
- Verify receiver power supply (stable 5V)
- Move transmitter antenna perpendicular to receiver
- Check for 2.4GHz interference (WiFi, microwave)

## Usage Examples

### Example 1: Manual Exploration

```
Initial Setup:
1. Power on transmitter
2. Open RoverOS → FLYBABY
3. Wait for signal ✓

Driving:
- Throttle stick DOWN = 0% forward
- Throttle stick CENTER = 50% forward
- Throttle stick UP = 100% forward
- Turn stick LEFT = -100 steering
- Turn stick RIGHT = +100 steering

Movement: "FPS-style" dual-stick control
```

### Example 2: Autonomous Waypoint Mission

```
Pre-Mission:
1. Set waypoints in NAVIGATION page
2. Switch B → ON (Autonomous Mode)
3. Open FLYBABY control page

Mission Control:
- Throttle slider = Mission speed (0-100%)
- Steering = Manual override (if needed)
- Switch B = Toggle auto/manual if emergency
- Press E-STOP to abort

The rover will:
✓ Follow GPS waypoints
✓ Avoid obstacles via lidar
✓ Maintain autonomous speed
✓ Allow manual override at any time
```

### Example 3: Dual-Operator Setup

```
Operator 1 (Transmitter):
- Manual rover control
- Real-time telemetry viewing
- Emergency stop capability

Operator 2 (Tablet/Web):
- Mission planning
- Sensor monitoring
- Parameter adjustment
- Video feed monitoring

Communication: Both share same WiFi network
```

## API Endpoints

### Get FlyBaby Status
```bash
curl http://raspberrypi.local:8080/api/flybaby/input
```

Response:
```json
{
  "connected": true,
  "channel1": 1523,
  "channel2": 1489,
  "channel3": 1200,
  "channel4": 1500,
  "channel5": 1800,
  "channel6": 2100,
  "signalStrength": 92,
  "failsafe": false,
  "frameRate": 49.8,
  "lastUpdate": 1703961234.567
}
```

### Send Control Command
```bash
curl -X POST http://raspberrypi.local:8080/api/flybaby/control \
  -H "Content-Type: application/json" \
  -d '{"throttle": 50, "steering": 20}'
```

## Specifications

| Parameter | Value |
|-----------|-------|
| Transmitter | FS-I6x 2.4GHz |
| Receiver | FS-IA10B 6CH |
| Update Rate | 50Hz |
| PWM Range | 1000-2000µs |
| Range | 500m line-of-sight |
| Channels Used | 6 (4 analog + 2 digital) |
| Battery | 2x3.7V LiPo or AA batteries |
| Dimensions | 240mm × 180mm × 85mm |
| Weight | 650g |

## Safety Precautions

⚠️ **Before Operating:**

1. **Bind Check** - Verify receiver is bound to transmitter
2. **Signal Test** - Confirm 50%+ signal strength
3. **Range Test** - Test at short range first
4. **Failsafe Test** - Verify rover stops if signal lost
5. **Obstacle Clear** - Remove hazards from test area
6. **Speed Limit** - Start at low throttle (20%)

## Next Steps

1. ✅ Hardware wired and powered
2. ✅ Receiver bound to transmitter
3. ✅ GPIO library installed
4. ✅ FlyBaby module integrated
5. 🔄 Test with manual driving
6. 🔄 Calibrate transmitter
7. 🔄 Validate autonomous missions

## Support Resources

- FlyBaby Manual: [Download PDF](https://www.flytech.io/manual)
- GPIO Guide: `man gpio`
- Python RPi.GPIO: https://pypi.org/project/RPi.GPIO/
- Rover Firmware: See `firmware/README.md`

---

**Your rover is now ready to be controlled via FlyBaby transmitter!** 🚀📡
