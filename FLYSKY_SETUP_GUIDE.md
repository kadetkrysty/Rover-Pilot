# FlySky FS-I6x / FS-IA10B Rover Control Setup Guide

## Overview

This guide explains how to set up and use the FlySky FS-I6x 2.4GHz radio transmitter with your autonomous rover using the RoverOS dashboard. The FS-IA10B receiver module supports 10 PWM channels for complete control.

## Hardware Required

### Radio Transmitter
- **FlySky FS-I6x** 2.4GHz Radio Controller
  - 6-channel transmitter with 10-channel receiver support
  - FS-IA10B receiver module
  - 500m range (open field)
  - Two 3.7V LiPo batteries or AA batteries

### Receiver Module
- **FS-IA10B** PWM Receiver
  - 10 channels (support for extended control)
  - 3.3V-5V compatible
  - PPM & PWM output modes
  - Failsafe capability

### Wiring (Raspberry Pi ↔ Receiver)

```
FS-IA10B Receiver Pins → Raspberry Pi GPIO (BCM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Channel 1 (Roll)        → GPIO 17 (Pin 11)
Channel 2 (Pitch)       → GPIO 27 (Pin 13)
Channel 3 (Throttle)    → GPIO 22 (Pin 15)
Channel 4 (Yaw)         → GPIO 23 (Pin 16)
Channel 5 (Switch A)    → GPIO 24 (Pin 18)
Channel 6 (Switch B)    → GPIO 25 (Pin 22)
Channel 7 (Aux 1)       → GPIO 26 (Pin 37)
Channel 8 (Aux 2)       → GPIO 19 (Pin 35)
Channel 9 (Aux 3)       → GPIO 20 (Pin 38)
Channel 10 (Aux 4)      → GPIO 21 (Pin 40)

GND (Black)             → GND (Pin 6, 9, 14, 20, 30, 34, 39)
VCC (Red - 5V)          → 5V (Pin 2 or 4)

⚠️ CRITICAL: Use a 3.3V→5V level shifter between receiver and GPIO pins!
```

## Installation Steps

### 1. Install Python GPIO Library on Raspberry Pi

```bash
ssh pi@raspberrypi.local
sudo apt update
sudo apt install python3-rpi.gpio
sudo apt install python3-pip
pip3 install RPi.GPIO
sudo usermod -a -G gpio pi
```

### 2. Copy FlySky Module to Raspberry Pi

```bash
scp firmware/raspberry_pi_master/flysky_receiver.py pi@raspberrypi.local:/home/pi/
```

### 3. Update Rover Controller (rover_controller.py)

Add to your Flask application:

```python
from flysky_receiver import initialize_flysky, receiver
from flask import jsonify, request

# In your main() or initialization:
initialize_flysky()

# Add this route:
@app.route('/api/flysky/input', methods=['GET'])
def get_flysky_input():
    """Get current FlySky receiver PWM values"""
    if receiver is None:
        return jsonify({'connected': False}), 503
    
    return jsonify(receiver.get_status())

@app.route('/api/flysky/control', methods=['POST'])
def flysky_control():
    """Process FlySky input and send to rover"""
    if receiver is None:
        return jsonify({'error': 'FlySky not available'}), 503
    
    status = receiver.get_status()
    
    # Convert PWM (1000-2000µs) to rover control (-100 to 100)
    throttle = (status['channel3'] - 1000) / 1000 * 100  # 0-100%
    steering = (status['channel1'] - 1500) / 500 * 100   # -100 to 100
    
    # Send control command to rover
    drive_rover(throttle, steering)
    
    return jsonify({
        'status': 'ok',
        'throttle': throttle,
        'steering': steering,
        'mode': 'AUTONOMOUS' if status['channel6'] > 1200 else 'MANUAL'
    })
```

### 4. Enable GPIO Access for Non-Root User

```bash
sudo usermod -a -G gpio pi
# Log out and back in for group changes to take effect
logout
ssh pi@raspberrypi.local
```

### 5. Wire Receiver to Raspberry Pi GPIO

Follow the pin mapping above. **Use a level shifter circuit** for proper 3.3V-5V conversion:

```
Simple Level Shifter Circuit (for each channel):
┌─────────────────────────┐
│ FS-IA10B CH (3.3V)  ├──┤ 4.7kΩ ┌──┤ GPIO Pin (3.3V)
│                        │       │
└─────────────────────────┴───┬───┴───┴─ 5V (from resistor divider)
                              │
                         10kΩ │ to GND
                              │
```

Or use a commercial level shifter module (easier and more reliable).

## FlySky Transmitter Setup

### Binding Receiver to Transmitter

1. **Power on transmitter** (FS-I6x)
   - Sticks will auto-center
   - LED will be solid green

2. **Hold receiver bind button** while powering on
   - LED will start blinking rapidly
   - Release button when ready

3. **Press bind button on transmitter**
   - Transmitter will send binding signal
   - Wait 2-3 seconds

4. **Binding complete** when receiver LED becomes solid
   - Green = bound and ready
   - Red = binding failed, retry

### Transmitter Configuration

#### Model Setup
```
SYS Button → Model Setup
Model Type: Acro (for rover control)
Mode: Mode 2 (recommended for rovers)
```

#### Channel Assignment
```
Stick Left Horizontal    → Channel 1 (Roll/Steering)
Stick Left Vertical      → Channel 2 (Pitch)
Throttle Lever           → Channel 3 (Throttle)
Stick Right Horizontal   → Channel 4 (Yaw)
Switch L (Left)          → Channel 5 (Record/Feature A)
Switch R (Right)         → Channel 6 (Mode: Manual/Autonomous)
```

#### Advanced: Assign Aux Channels (7-10)

```
SYS → Function Setup → Assign Channels
Channel 7 → Knob/Slider (if available)
Channel 8 → Available switch
Channel 9 → Available switch
Channel 10 → Available switch
```

#### Transmitter Calibration

```
SYS → Calibration
1. Move all sticks to extremes (all directions)
2. Move throttle up/down fully
3. Flip all switches through full range
4. Return all sticks to center
5. Press SAVE
```

## Using FlySky in RoverOS Dashboard

### 1. Access Control Page

- Open RoverOS app on your device
- Click **FLYSKY** button in main navigation
- Wait for connection indicator to show ✓ CONNECTED

### 2. Manual Driving Mode (Switch B = OFF)

**Controls:**
- **Left Stick Horizontal** → Steer left/right
- **Left Stick Vertical** → Forward/reverse throttle
- **Right Stick Horizontal** → Camera pan (if equipped)
- **Right Stick Vertical** → Camera tilt (if equipped)
- **Throttle Lever** → Speed control
- **Switch A (L)** → Toggle features (recording, lights, etc.)
- **Switch B (R)** → OFF = Manual mode

**Driving Tips:**
- Throttle at center (1500µs) = 0% (stopped)
- Move throttle lever up = forward movement
- Move throttle lever down = reverse movement
- Steering is proportional to left stick horizontal position

### 3. Autonomous Mode (Switch B = ON)

**Mode Activation:**
- Flip Switch B to ON position
- Rover will engage autonomous waypoint following
- Control mode switches from "MANUAL" to "AUTONOMOUS"

**Controls:**
- **Throttle Lever** → Mission speed (0-100%)
- **Left Stick** → Manual override (if needed in emergency)
- **Right Stick** → Camera gimbal control
- **Switches** → Feature toggles

**Autonomous Features:**
- ✓ Auto-navigation to GPS waypoints
- ✓ Obstacle avoidance via lidar
- ✓ Speed controlled by throttle
- ✓ Failsafe return-to-home if signal lost

### 4. Emergency Stop

- **Quick Stop:** Push throttle to minimum position
- **Signal Loss Failsafe:** Rover auto-stops if signal lost >1 second
- **Manual Override:** Use left stick to regain manual control

## Real-Time Monitoring (Dashboard)

### FlySky Control Page Shows:

**Connection Status**
- ✓ CONNECTED (green) or ✗ NO SIGNAL (red)
- Signal strength bar (0-100%)
- Failsafe alert if triggered

**All 10 Channels Display**
```
Primary Channels (1-6):
- CH1: Roll/Steering     (1000-2000µs)
- CH2: Pitch             (1000-2000µs)
- CH3: Throttle          (1000-2000µs)
- CH4: Yaw               (1000-2000µs)
- CH5: Switch A          (ON/OFF indicator)
- CH6: Switch B          (ON/OFF indicator)

Auxiliary Channels (7-10):
- CH7: Aux Channel 1     (1000-2000µs)
- CH8: Aux Channel 2     (1000-2000µs)
- CH9: Aux Channel 3     (1000-2000µs)
- CH10: Aux Channel 4    (1000-2000µs)
```

**System Status**
- Current mode (MANUAL/AUTONOMOUS)
- Throttle percentage (0-100%)
- Steering value (-100 to +100)
- Battery voltage
- Update frame rate (should be ~50Hz)

## Usage Examples

### Example 1: Manual Exploration Mode

```
Step 1: Pre-Drive Setup
- Power on transmitter (FS-I6x)
- Verify signal in RoverOS → FLYSKY page
- Check signal strength (should be > 50%)
- Verify all channels responding

Step 2: Start Driving
- Throttle at center (neutral)
- Slowly increase throttle lever upward
- Use left stick horizontal to steer
- Smoothly increase speed over time

Step 3: Navigation
- Use sticks for fine control
- Keep throttle smooth (avoid jerky movements)
- Monitor lidar distance on telemetry panel
- Use camera feed for visual guidance

Step 4: Stop & Return
- Smoothly decrease throttle to center
- Move rover back to starting position
- Power off transmitter when done
```

### Example 2: Autonomous Waypoint Mission

```
Step 1: Mission Planning
- Open NAVIGATION page
- Create waypoint route on map
- Save mission (3-5 waypoints recommended)

Step 2: Pre-Mission Check
- Open FLYSKY control page
- Verify 100% signal strength
- Position rover at mission start point
- Check battery (should be > 80%)

Step 3: Start Mission
- Flip Switch B to ON (autonomous mode)
- Mode changes from MANUAL to AUTONOMOUS
- Throttle controls mission speed
- Rover auto-navigates to waypoints

Step 4: Monitor Mission
- Watch real-time telemetry on dashboard
- Observe lidar obstacle detection
- Monitor GPS path on map
- Use override stick if needed for obstacles

Step 5: Complete Mission
- Rover returns home when all waypoints reached
- Flip Switch B to OFF for manual control
- Monitor final landing/stop
```

### Example 3: Dual-Operator Setup

```
Operator 1 - Radio Controller:
- Uses FS-I6x transmitter
- Manual driving control via joystick
- Emergency stop capability
- Real-time vehicle response

Operator 2 - Tablet/Web Dashboard:
- Monitors live camera feed
- Views sensor telemetry
- Manages mission planning
- Adjusts parameters (speed, sensitivity)
- Watches lidar obstacle detection

Communication:
- Both operators share same WiFi network
- Real-time synchronization
- Operator 1 can yield to Operator 2 anytime
- Seamless mode switching
```

### Example 4: Camera Recording with Transmitter

```
Using Switch A (CH5) for Recording:
1. Flip Switch A to ON during exploration
2. RoverOS records video and telemetry
3. Flip Switch A to OFF when done
4. Download recorded footage from dashboard

This allows hands-free recording while driving!
```

## API Endpoints

### Get Current FlySky Status

```bash
curl http://raspberrypi.local:8080/api/flysky/input
```

**Response:**
```json
{
  "connected": true,
  "channel1": 1523,
  "channel2": 1489,
  "channel3": 1234,
  "channel4": 1500,
  "channel5": 1800,
  "channel6": 2100,
  "channel7": 1500,
  "channel8": 1500,
  "channel9": 1500,
  "channel10": 1500,
  "signalStrength": 92,
  "failsafe": false,
  "frameRate": 49.8,
  "lastUpdate": 1703961234.567
}
```

### Send Control Command

```bash
curl -X POST http://raspberrypi.local:8080/api/flysky/control \
  -H "Content-Type: application/json" \
  -d '{
    "throttle": 50,
    "steering": 20,
    "auxiliaryCommand": "record_toggle"
  }'
```

## Troubleshooting

### No Connection / "Receiver Not Detected"

**Check 1: GPIO Libraries**
```bash
python3 -c "import RPi.GPIO; print('GPIO OK')"
```

**Check 2: GPIO Permissions**
```bash
# Verify user in gpio group
id pi
# Should show: groups=... gpio(...)
```

**Check 3: Receiver Power**
```bash
# Test with multimeter
# VCC should show 5.0V ±0.5V
# GND should be 0V reference
```

**Check 4: GPIO Pin Test**
```bash
python3 -c "
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.IN)
print('GPIO 17 reads:', GPIO.input(17))
GPIO.cleanup()
"
```

### Weak Signal (< 50%)

**Solutions:**
1. Move closer to rover (start at 2-3 meters)
2. Remove obstacles between transmitter and receiver
3. Check antenna is straight and not damaged
4. Verify 5V power supply (should be stable)
5. Check for 2.4GHz interference (WiFi, microwaves)

**Antenna Tips:**
- Keep transmitter antenna perpendicular to receiver
- Don't cover antenna with hands
- Avoid metal objects nearby
- Move away from WiFi routers

### Channels Reading 1500µs (Center) Only

**Causes & Fixes:**
1. **Receiver not bound**
   - Re-bind following "Binding Receiver" section
   - Verify LED turns solid green when bound

2. **GPIO pins not connected**
   - Double-check wiring against pin mapping
   - Test continuity with multimeter

3. **Level shifter issues**
   - Verify level shifter power connections
   - Test output voltage (should be 3.3V)
   - Try different level shifter if available

### Failsafe Triggers Frequently

**Problem:** "Signal Lost" alerts constantly, even with transmitter nearby

**Solutions:**
1. Check power supply stability (use multimeter)
2. Verify 5V to receiver is clean and stable
3. Move transmitter antenna away from metal
4. Check for antenna damage
5. Move away from WiFi router (2.4GHz interference)
6. Re-calibrate transmitter sticks

### Some Channels Not Responding

**Example:** Channels 7-10 not working

**Fixes:**
1. Verify GPIO pins 26, 19, 20, 21 are connected
2. Check level shifter has outputs for all channels
3. Ensure transmitter is configured for extended channels
4. Test individual GPIO pins with Python script

## Specifications

| Specification | Value |
|---|---|
| **Transmitter** | FlySky FS-I6x 2.4GHz |
| **Receiver** | FS-IA10B PWM |
| **Channels** | 10 (6 standard + 4 auxiliary) |
| **Update Rate** | 50Hz (20ms interval) |
| **PWM Range** | 1000-2000 microseconds |
| **Signal Range** | 500m line-of-sight |
| **Failsafe** | Auto-stop at >1 second loss |
| **Frequency** | 2.4GHz FHSS (frequency hopping) |
| **Battery** | 2x3.7V LiPo or 4xAA |
| **Dimensions** | 240mm × 180mm × 85mm |
| **Weight** | 650g |
| **Working Temp** | -10°C to +60°C |

## Safety Precautions

⚠️ **Before Operating Your Rover:**

1. **Verify Binding**
   - Confirm receiver LED is solid green
   - Test transmission with left stick
   - Verify all channels responding

2. **Signal Strength Test**
   - Should display > 50% signal strength
   - Test at increasing distances
   - Note maximum reliable range

3. **Failsafe Test**
   - Enable "no signal" failsafe before first run
   - Power off transmitter to simulate loss
   - Verify rover stops immediately

4. **Range Test**
   - Start in open area (no obstacles)
   - Test at 5m, 10m, 20m distances
   - Note signal degradation
   - Stop before signal drops below 25%

5. **Obstacle Clearance**
   - Remove hazards (rocks, holes, people)
   - Test in confined area first
   - Verify lidar obstacle detection works

6. **Speed Limiting**
   - Start with throttle at 20%
   - Gradually increase over several runs
   - Find safe maximum speed for terrain
   - Train with lower speeds before high-speed runs

7. **Emergency Procedures**
   - Know where E-STOP button is
   - Practice emergency stop (push throttle min)
   - Have spare batteries ready
   - Keep first aid kit nearby

## Next Steps Checklist

- [ ] GPIO library installed on Raspberry Pi
- [ ] FlySky receiver wired to GPIO pins 17, 27, 22, 23, 24, 25, 26, 19, 20, 21
- [ ] Level shifter circuit installed and verified
- [ ] FS-IA10B receiver bound to FS-I6x transmitter
- [ ] Transmitter calibrated and configured
- [ ] rover_controller.py updated with FlySky API routes
- [ ] `flysky_receiver.py` copied to Raspberry Pi
- [ ] FlySky control page accessible in RoverOS dashboard
- [ ] Signal strength > 50% verified
- [ ] Failsafe tested and working
- [ ] Manual driving tested at low speed
- [ ] Autonomous mode tested with waypoints

## Support & Resources

- **FlySky Official:** https://www.flytech.io
- **FS-I6x Manual:** Download from FlySky website
- **Raspberry Pi GPIO:** https://raspberrypi.org/documentation
- **Python RPi.GPIO:** https://pypi.org/project/RPi.GPIO/
- **Rover Firmware:** See `firmware/README.md`

---

**Your rover is now ready to be controlled with FlySky FS-I6x!** 🚀📡

The combination of manual joystick control + autonomous waypoint following makes this the ultimate rover control system!
