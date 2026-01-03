import { Button } from '@/components/ui/button';
import { Code, FileText, Cpu, Download, Wifi, Radio, Settings, Wrench, Zap, AlertTriangle, Power, Video, Cloud, Shield, Camera } from 'lucide-react';
import slushEngineImage from '@assets/slushengine_LT_-_Trans2_1024x1024_1767447433450.webp';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Documentation() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-documentation">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">SYSTEM DOCUMENTATION</h1>
        <p className="text-muted-foreground font-mono mt-1">RoverOS v3.0 - Mini PC + Arduino + iBUS Architecture</p>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-10rem)]">
        <div className="col-span-3 space-y-4">
             <div className="hud-panel p-4">
                <h3 className="font-display text-lg mb-4 text-primary">COMPONENT LIST</h3>
                <ul className="space-y-2 text-sm font-mono text-muted-foreground">
                    <li className="flex items-center gap-2 text-foreground"><Cpu className="w-4 h-4 text-primary" /> Mini PC (Intel Celeron)</li>
                    <li className="flex items-center gap-2 text-foreground"><Cpu className="w-4 h-4 text-secondary" /> Arduino Mega 2560</li>
                    <li className="flex items-center gap-2 text-foreground"><Camera className="w-4 h-4 text-green-400" /> RPi 3B+ + SlushEngine</li>
                    <li className="flex items-center gap-2 text-foreground"><Radio className="w-4 h-4 text-accent" /> FlySky FS-I6x + FS-IA10B</li>
                    <li className="pl-6">• Hoverboard Mainboard (UART)</li>
                    <li className="pl-6">• HuskyLens AI (I2C)</li>
                    <li className="pl-6">• TF Mini Pro Lidar (Serial2)</li>
                    <li className="pl-6">• GPS Neo-6M (Serial3)</li>
                    <li className="pl-6">• IMU MPU6050 (I2C)</li>
                    <li className="pl-6">• 5x HC-SR04 Ultrasonic</li>
                    <li className="pl-6">• Pan/Tilt NEMA17 Motors</li>
                </ul>
             </div>

             <div className="hud-panel p-4 border-accent/50">
                <h3 className="font-display text-lg mb-2 text-accent">v3.0 CHANGES</h3>
                <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                    <li>✓ Raspberry Pi → Mini PC</li>
                    <li>✓ GPIO PWM → iBUS Protocol</li>
                    <li>✓ 10 wires → 1 wire for RC</li>
                    <li>✓ Auto port detection</li>
                </ul>
             </div>
        </div>

        <div className="col-span-9 hud-panel p-0 overflow-hidden flex flex-col">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
                <div className="bg-card border-b border-border p-2 overflow-x-auto">
                    <TabsList className="bg-background/50 w-max">
                        <TabsTrigger value="overview" className="font-mono text-xs" data-testid="tab-overview">OVERVIEW</TabsTrigger>
                        <TabsTrigger value="pantilt" className="font-mono text-xs" data-testid="tab-pantilt">PAN/TILT</TabsTrigger>
                        <TabsTrigger value="estop" className="font-mono text-xs" data-testid="tab-estop">E-STOP</TabsTrigger>
                        <TabsTrigger value="video" className="font-mono text-xs" data-testid="tab-video">VIDEO</TabsTrigger>
                        <TabsTrigger value="cloudsync" className="font-mono text-xs" data-testid="tab-cloudsync">CLOUD</TabsTrigger>
                        <TabsTrigger value="failsafe" className="font-mono text-xs" data-testid="tab-failsafe">FAILSAFE</TabsTrigger>
                        <TabsTrigger value="wiring" className="font-mono text-xs" data-testid="tab-wiring">WIRING</TabsTrigger>
                        <TabsTrigger value="ibus" className="font-mono text-xs" data-testid="tab-ibus">iBUS / RC</TabsTrigger>
                        <TabsTrigger value="troubleshoot" className="font-mono text-xs" data-testid="tab-troubleshoot">TROUBLESHOOT</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="overview" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4">SYSTEM ARCHITECTURE v3.0</h3>
                                <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-green-300">
{`+---------------------------------------------------------------------+
|                         ROVER SYSTEM v3.0                           |
+---------------------------------------------------------------------+
|                                                                     |
|  +---------------------+    USB Serial    +---------------------+   |
|  |  MINI PC            |<--------------->|  ARDUINO MEGA       |   |
|  |  Intel Celeron      |   115200 baud   |  2560               |   |
|  |  8GB RAM            |                 |                     |   |
|  |  Ubuntu OS          |                 |  Sensors:           |   |
|  |                     |                 |  - TF Mini Pro      |   |
|  |  Runs:              |                 |  - MPU6050 IMU      |   |
|  |  - Web Server       |                 |  - Neo-6M GPS       |   |
|  |  - WebSocket        |                 |  - 5x Ultrasonic    |   |
|  |  - SLAM/EKF         |                 |  - HuskyLens        |   |
|  |                     |                 |                     |   |
|  +---------+-----------+                 |  RC Control:        |   |
|            |                             |  - iBUS (Serial1)   |   |
|            | WiFi                        +---------+-----------+   |
|            v                                       |               |
|  +---------------------+                 +---------v-----------+   |
|  |  WEB DASHBOARD      |                 |  FLYSKY FS-IA10B    |   |
|  |  React + Vite       |                 |  (iBUS Protocol)    |   |
|  |  Mobile/Desktop     |                 +---------------------+   |
|  +---------------------+                           ^               |
|                                                    | 2.4GHz        |
|  +---------------------+                 +---------+-----------+   |
|  |  HOVERBOARD         |<-- UART --------|  FLYSKY FS-I6x     |   |
|  |  FOC Controller     |     Arduino     |  Transmitter        |   |
|  +---------------------+                 +---------------------+   |
|                                                                     |
+---------------------------------------------------------------------+`}
                                </pre>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h4 className="font-display text-primary mb-2 flex items-center gap-2">
                                        <Cpu className="w-4 h-4" /> MINI PC
                                    </h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• Intel Celeron J3455 / N5105</li>
                                        <li>• 8GB RAM minimum</li>
                                        <li>• Ubuntu 22.04 LTS</li>
                                        <li>• Runs Python Flask server</li>
                                        <li>• Handles SLAM/EKF processing</li>
                                        <li>• Serves web dashboard</li>
                                    </ul>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h4 className="font-display text-secondary mb-2 flex items-center gap-2">
                                        <Cpu className="w-4 h-4" /> ARDUINO MEGA
                                    </h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• ATmega2560 processor</li>
                                        <li>• 4 hardware serial ports</li>
                                        <li>• All sensors connected here</li>
                                        <li>• iBUS RC receiver decoding</li>
                                        <li>• Motor control via UART</li>
                                        <li>• 20Hz telemetry to Mini PC</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2 flex items-center gap-2">
                                    <Radio className="w-4 h-4" /> iBUS PROTOCOL (NEW IN v3.0)
                                </h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                    The FlySky FS-IA10B receiver now connects directly to Arduino via iBUS protocol instead of GPIO PWM on the Raspberry Pi.
                                </p>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <h5 className="text-xs font-bold text-red-400 mb-1">OLD: GPIO PWM (v2.x)</h5>
                                        <ul className="text-xs font-mono text-muted-foreground">
                                            <li>• 10 separate wires</li>
                                            <li>• Raspberry Pi GPIO pins</li>
                                            <li>• Analog PWM timing</li>
                                            <li>• Complex wiring</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h5 className="text-xs font-bold text-green-400 mb-1">NEW: iBUS (v3.0)</h5>
                                        <ul className="text-xs font-mono text-muted-foreground">
                                            <li>• Single wire connection</li>
                                            <li>• Arduino Serial1 (Pin 19)</li>
                                            <li>• Digital protocol ~143Hz</li>
                                            <li>• Simple and reliable</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="pantilt" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4 flex items-center gap-2">
                                    <Camera className="w-6 h-6" /> CAMERA PAN/TILT SYSTEM
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    The camera pan/tilt mechanism uses a dedicated Raspberry Pi 3 B+ with SlushEngine Model X LT 
                                    stepper motor driver. This provides precise ±180° pan and ±90° tilt control via the left stick on the PS4 controller.
                                </p>
                            </div>

                            <div className="bg-card border border-border p-4 rounded-lg">
                                <h4 className="font-display text-accent mb-3">HARDWARE OVERVIEW</h4>
                                <img 
                                    src={slushEngineImage} 
                                    alt="SlushEngine Model X LT with Raspberry Pi 3 B+" 
                                    className="w-full max-w-2xl mx-auto rounded-lg border border-border mb-4"
                                />
                                <p className="text-xs text-muted-foreground text-center italic">
                                    SlushEngine Model X LT mounted on Raspberry Pi 3 B+ - Controls up to 4 stepper motors
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h4 className="font-display text-primary mb-2">SPECIFICATIONS</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• <span className="text-accent">Controller:</span> Raspberry Pi 3 B+</li>
                                        <li>• <span className="text-accent">Driver:</span> SlushEngine Model X LT</li>
                                        <li>• <span className="text-accent">Motors:</span> NEMA 17 Bipolar Steppers</li>
                                        <li>• <span className="text-accent">Power:</span> 9-36V DC (12V recommended)</li>
                                        <li>• <span className="text-accent">Max Current:</span> 5A peak per motor</li>
                                        <li>• <span className="text-accent">Microstepping:</span> Up to 128 microsteps</li>
                                    </ul>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h4 className="font-display text-secondary mb-2">MOTOR ASSIGNMENT</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• <span className="text-green-400">Motor 1:</span> PAN (horizontal)</li>
                                        <li className="pl-4">Range: ±180° (360° total)</li>
                                        <li className="pl-4">+ = Right, - = Left</li>
                                        <li>• <span className="text-green-400">Motor 2:</span> TILT (vertical)</li>
                                        <li className="pl-4">Range: ±90° (180° total)</li>
                                        <li className="pl-4">+ = Up, - = Down</li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-3">WIRING DIAGRAM</h4>
                                <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-green-300">
{`+-------------------------------------------------------------------------+
|                    CAMERA PAN/TILT WIRING DIAGRAM                       |
+-------------------------------------------------------------------------+
|                                                                         |
|  +----------------------+   40-Pin GPIO   +----------------------+      |
|  |  RASPBERRY PI 3B+    |<--------------->|  SLUSHENGINE X LT    |      |
|  |                      |   (HAT Mount)   |                      |      |
|  |  Power: 5V 2.5A      |                 |  Power: 12V DC       |      |
|  |  via USB-C or GPIO   |                 |  (VPP Terminal)      |      |
|  +----------------------+                 +----------------------+      |
|                                                                         |
|  +------------------------------------------+  +--------------------+   |
|  |           MOTOR CONNECTIONS              |  |     Motor 1        |   |
|  +------------------------------------------+  |      (PAN)         |   |
|  |                                          |  |                    |   |
|  |  PAN MOTOR (Motor Port 1)                |  |  A+ --> Coil A+    |   |
|  |   A+ (Green)  --> SlushEngine Motor1 A+  |  |  A- --> Coil A-    |   |
|  |   A- (Black)  --> SlushEngine Motor1 A-  |  |  B+ --> Coil B+    |   |
|  |   B+ (Red)    --> SlushEngine Motor1 B+  |  |  B- --> Coil B-    |   |
|  |   B- (Blue)   --> SlushEngine Motor1 B-  |  +--------------------+   |
|  |                                          |                           |
|  |  TILT MOTOR (Motor Port 2)               |  +--------------------+   |
|  |   A+ (Green)  --> SlushEngine Motor2 A+  |  |     Motor 2        |   |
|  |   A- (Black)  --> SlushEngine Motor2 A-  |  |      (TILT)        |   |
|  |   B+ (Red)    --> SlushEngine Motor2 B+  |  |                    |   |
|  |   B- (Blue)   --> SlushEngine Motor2 B-  |  |  A+ --> Coil A+    |   |
|  |                                          |  |  A- --> Coil A-    |   |
|  +------------------------------------------+  |  B+ --> Coil B+    |   |
|                                                |  B- --> Coil B-    |   |
|  +------------------------------------------+  +--------------------+   |
|  |           POWER CONNECTIONS              |                           |
|  +------------------------------------------+  +--------------------+   |
|  |  12V DC Power Supply --> VPP (+)         |  |   Power Terminal   |   |
|  |  GND ------------------> GND (-)         |  |                    |   |
|  |                                          |  |  VPP: 9-36V        |   |
|  |  WARNING: Check polarity before          |  |  GND: Common       |   |
|  |  connecting power!                       |  +--------------------+   |
|  +------------------------------------------+                           |
|                                                                         |
|  COMMUNICATION (via Mini PC WiFi):                                      |
|  +------------------+     WiFi      +------------------+                |
|  |  Mini PC         |<------------->|  RPi 3 B+        |<-- TCP/5002    |
|  |  Main Ctrl       |               |  Camera Ctrl     |    Commands    |
|  +------------------+               +------------------+                |
|                                                                         |
+-------------------------------------------------------------------------+`}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-3">SOFTWARE INSTALLATION</h4>
                                <div className="space-y-4">
                                    <div className="bg-card border border-border p-4 rounded">
                                        <h5 className="text-sm font-bold text-secondary mb-2">Step 1: Enable SPI & I2C</h5>
                                        <pre className="bg-black/50 p-3 rounded text-xs font-mono text-cyan-300 overflow-x-auto">
{`sudo raspi-config
# Navigate to: Interfacing Options
# Enable: SPI → Yes
# Enable: I2C → Yes
# Reboot when prompted`}
                                        </pre>
                                    </div>

                                    <div className="bg-card border border-border p-4 rounded">
                                        <h5 className="text-sm font-bold text-secondary mb-2">Step 2: Install SlushEngine Library</h5>
                                        <pre className="bg-black/50 p-3 rounded text-xs font-mono text-cyan-300 overflow-x-auto">
{`# Update package manager
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-dev git

# Install SPI and I2C libraries
sudo pip3 install spidev smbus2

# Clone and install SlushEngine
git clone https://github.com/Roboteurs/slushengine.git
cd slushengine
sudo python3 setup.py install`}
                                        </pre>
                                    </div>

                                    <div className="bg-card border border-border p-4 rounded">
                                        <h5 className="text-sm font-bold text-secondary mb-2">Step 3: Install RoverOS Controller</h5>
                                        <pre className="bg-black/50 p-3 rounded text-xs font-mono text-cyan-300 overflow-x-auto">
{`# Copy the controller script to RPi
# From: firmware/raspberry_pi_camera_controller/

# Make install script executable
chmod +x install.sh

# Run installation
./install.sh

# Reboot to apply changes
sudo reboot`}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-3">PYTHON CONTROLLER CODE</h4>
                                <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-cyan-300">
{`#!/usr/bin/env python3
"""Camera Pan/Tilt Controller - Basic Usage Example"""
import Slush

# Initialize the SlushEngine board
board = Slush.sBoard()

# Initialize motors (1 = Pan, 2 = Tilt)
pan_motor = Slush.Motor(1)
tilt_motor = Slush.Motor(2)

# Configure motors
for motor in [pan_motor, tilt_motor]:
    motor.setCurrent(50, 70, 70, 70)  # hold, run, acc, dec
    motor.setMaxSpeed(800)
    motor.setMicroSteps(128)  # 128 microsteps per step

# Constants
STEPS_PER_DEGREE = (200 * 128) / 360  # 200 steps/rev * 128 microsteps

def set_pan(degrees):
    """Set pan angle: -180 to +180 degrees"""
    degrees = max(-180, min(180, degrees))
    steps = int(degrees * STEPS_PER_DEGREE)
    pan_motor.goTo(steps)

def set_tilt(degrees):
    """Set tilt angle: -90 to +90 degrees"""
    degrees = max(-90, min(90, degrees))
    steps = int(degrees * STEPS_PER_DEGREE)
    tilt_motor.goTo(steps)

# Example usage
set_pan(45)    # Pan 45° right
set_tilt(-15)  # Tilt 15° down

# Wait for moves to complete
pan_motor.waitMove()
tilt_motor.waitMove()

# Center camera
set_pan(0)
set_tilt(0)`}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-3">TROUBLESHOOTING</h4>
                                <div className="space-y-3">
                                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
                                        <h5 className="text-sm font-bold text-destructive mb-1">Motor not spinning</h5>
                                        <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                            <li>• Check 12V power connection to VPP terminal</li>
                                            <li>• Verify motor wire connections (A+, A-, B+, B-)</li>
                                            <li>• Ensure SPI is enabled: <code className="text-cyan-300">ls /dev/spi*</code></li>
                                            <li>• Check current settings match your motor specs</li>
                                        </ul>
                                    </div>

                                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
                                        <h5 className="text-sm font-bold text-destructive mb-1">ImportError: No module named 'Slush'</h5>
                                        <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                            <li>• Reinstall: <code className="text-cyan-300">cd slushengine && sudo python3 setup.py install</code></li>
                                            <li>• Don't run Python from inside the slushengine directory</li>
                                        </ul>
                                    </div>

                                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
                                        <h5 className="text-sm font-bold text-destructive mb-1">SMBus / I2C Error</h5>
                                        <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                            <li>• Install smbus2: <code className="text-cyan-300">pip3 install smbus2</code></li>
                                            <li>• Check I2C enabled: <code className="text-cyan-300">sudo raspi-config</code></li>
                                            <li>• Verify I2C devices: <code className="text-cyan-300">i2cdetect -y 1</code></li>
                                        </ul>
                                    </div>

                                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
                                        <h5 className="text-sm font-bold text-destructive mb-1">Motor moves wrong direction</h5>
                                        <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                            <li>• Swap A+ with A- wires, OR swap B+ with B- wires</li>
                                            <li>• Or invert in software: <code className="text-cyan-300">motor.goTo(-steps)</code></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">PS4 CONTROLLER MAPPING</h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                    The left analog stick controls the camera pan/tilt:
                                </p>
                                <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                    <li>• <span className="text-green-400">Left Stick X-Axis:</span> Pan (left/right) → ±180°</li>
                                    <li>• <span className="text-green-400">Left Stick Y-Axis:</span> Tilt (up/down) → ±90°</li>
                                    <li>• <span className="text-green-400">D-Pad Up/Down:</span> Zoom (FOV adjustment)</li>
                                    <li>• <span className="text-green-400">Share Button:</span> Center camera (0°, 0°)</li>
                                </ul>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="estop" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4 flex items-center gap-2">
                                    <Power className="w-6 h-6" /> EMERGENCY STOP (E-STOP)
                                </h3>
                                <div className="bg-destructive/20 border border-destructive p-4 rounded-lg mb-4">
                                    <p className="text-sm text-destructive font-bold">CRITICAL SAFETY FEATURE</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        The E-Stop button immediately halts all rover movement. Use in emergency situations.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-display text-primary">HOW TO USE E-STOP</h4>
                                
                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">1. Web Dashboard</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Click the red E-STOP button in the navigation bar</li>
                                        <li>• Button is visible on ALL pages for quick access</li>
                                        <li>• Command is sent via WebSocket immediately</li>
                                        <li>• All motor commands are zeroed</li>
                                    </ul>
                                </div>

                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">2. PS4 Controller</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Press the PS button (PlayStation logo)</li>
                                        <li>• Immediately stops all movement</li>
                                        <li>• Throttle and steering reset to zero</li>
                                    </ul>
                                </div>

                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">3. FlySky Transmitter</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Switch SWC to position 3 (failsafe mode)</li>
                                        <li>• Or simply turn off the transmitter</li>
                                        <li>• iBUS failsafe triggers automatic stop</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                <h5 className="font-display text-primary mb-2">E-STOP BEHAVIOR</h5>
                                <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                    <li>• Motors immediately set to 0 speed</li>
                                    <li>• Autonomous navigation paused</li>
                                    <li>• Button pulses for 3 seconds to confirm</li>
                                    <li>• Manual control can resume after stop</li>
                                </ul>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="video" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4 flex items-center gap-2">
                                    <Video className="w-6 h-6" /> VIDEO RECORDING
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Record mission footage from the HuskyLens AI camera for review and analysis.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">STARTING A RECORDING</h5>
                                    <ol className="text-xs font-mono text-muted-foreground space-y-1 list-decimal list-inside">
                                        <li>Navigate to RECORDINGS page</li>
                                        <li>Click "Start Recording" button</li>
                                        <li>Red indicator shows recording is active</li>
                                        <li>Recording continues until stopped</li>
                                    </ol>
                                </div>

                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">PLAYBACK</h5>
                                    <ol className="text-xs font-mono text-muted-foreground space-y-1 list-decimal list-inside">
                                        <li>Select a completed recording from list</li>
                                        <li>Click Play to view footage</li>
                                        <li>Pause/Resume as needed</li>
                                        <li>Download for offline viewing</li>
                                    </ol>
                                </div>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h5 className="font-display text-accent mb-2">STORAGE INFO</h5>
                                <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                    <li>• Recordings stored on Mini PC</li>
                                    <li>• 1080p @ 60FPS default resolution</li>
                                    <li>• ~250MB per 5 minutes of footage</li>
                                    <li>• Auto-cleanup when storage is low</li>
                                </ul>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="cloudsync" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4 flex items-center gap-2">
                                    <Cloud className="w-6 h-6" /> CLOUD SYNC & BACKUP
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Backup and restore routes, waypoints, and settings.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">EXPORTING DATA</h5>
                                    <ol className="text-xs font-mono text-muted-foreground space-y-1 list-decimal list-inside">
                                        <li>Go to CLOUD SYNC page</li>
                                        <li>Click "Export All Data" button</li>
                                        <li>JSON file downloads automatically</li>
                                        <li>Store backup in safe location</li>
                                    </ol>
                                </div>

                                <div className="bg-card border border-border p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">IMPORTING DATA</h5>
                                    <ol className="text-xs font-mono text-muted-foreground space-y-1 list-decimal list-inside">
                                        <li>Go to CLOUD SYNC page</li>
                                        <li>Click "Import Backup" button</li>
                                        <li>Select your backup JSON file</li>
                                        <li>Routes and settings are restored</li>
                                    </ol>
                                </div>

                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h5 className="font-display text-primary mb-2">WHAT'S INCLUDED IN BACKUP</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• All saved navigation routes</li>
                                        <li>• Waypoints with coordinates</li>
                                        <li>• System configuration settings</li>
                                        <li>• Google Maps API key (if saved)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="failsafe" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h3 className="text-xl text-primary font-display mb-4 flex items-center gap-2">
                                    <Shield className="w-6 h-6" /> FAILSAFE SYSTEM
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Automatic safety triggers that protect the rover and surroundings.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-destructive/10 border border-destructive/30 p-4 rounded">
                                    <h5 className="text-sm font-bold text-destructive mb-2">LOW BATTERY</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Triggers at &lt;20% battery</li>
                                        <li>• Speed reduced to 50%</li>
                                        <li>• Warning displayed on dashboard</li>
                                        <li>• At &lt;10%: Full stop, return-to-home</li>
                                    </ul>
                                </div>

                                <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                    <h5 className="text-sm font-bold text-accent mb-2">SIGNAL LOSS</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• iBUS failsafe after 500ms no signal</li>
                                        <li>• Motors stop immediately</li>
                                        <li>• Waits for signal recovery</li>
                                        <li>• Auto-resume when signal returns</li>
                                    </ul>
                                </div>

                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h5 className="text-sm font-bold text-primary mb-2">OBSTACLE DETECTION</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Emergency stop at 15cm</li>
                                        <li>• Slow down at 30cm</li>
                                        <li>• Caution alert at 60cm</li>
                                        <li>• LIDAR + Ultrasonic fusion</li>
                                    </ul>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h5 className="text-sm font-bold text-secondary mb-2">GPS/IMU DRIFT</h5>
                                    <ul className="text-xs font-mono text-muted-foreground space-y-1">
                                        <li>• Monitors EKF covariance</li>
                                        <li>• Stops if localization uncertain</li>
                                        <li>• Requires GPS fix to continue</li>
                                        <li>• IMU recalibration if needed</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-card border border-border p-4 rounded">
                                <h5 className="font-display text-primary mb-2">FAILSAFE LOG</h5>
                                <p className="text-xs text-muted-foreground">
                                    All failsafe events are logged with timestamp, trigger reason, and automatic actions taken. 
                                    View the event history in the DIAGNOSTICS page.
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="wiring" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">ARDUINO MEGA PIN ASSIGNMENT</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-cyan-300">
{`Arduino Mega 2560 Pin Assignment v3.0
=====================================

USB ----------------------- Mini PC (Serial 115200)

Serial1 (iBUS - FlySky Receiver):
  Pin 19 (RX1) ----------- FS-IA10B iBUS Signal
  
Serial2 (LIDAR):
  Pin 16 (TX2) ----------- TF Mini Pro RX
  Pin 17 (RX2) ----------- TF Mini Pro TX

Serial3 (GPS):
  Pin 14 (TX3) ----------- Neo-6M RX
  Pin 15 (RX3) ----------- Neo-6M TX

I2C:
  Pin 20 (SDA) ----------- MPU6050 SDA, HuskyLens SDA
  Pin 21 (SCL) ----------- MPU6050 SCL, HuskyLens SCL

Hoverboard (SoftwareSerial):
  Pin 10 (RX) ------------ Hoverboard TX (via level shifter!)
  Pin 11 (TX) ------------ Hoverboard RX (via level shifter!)

Ultrasonic Sensors:
  Pin 22/23 -------------- HC-SR04 #1 (Front Center)
  Pin 24/25 -------------- HC-SR04 #2 (Front Left)
  Pin 26/27 -------------- HC-SR04 #3 (Front Right)
  Pin 28/29 -------------- HC-SR04 #4 (Rear Left)
  Pin 30/31 -------------- HC-SR04 #5 (Rear Right)

Status LED:
  Pin 13 ----------------- Built-in LED (heartbeat)

Power:
  5V --------------------- All sensors, FS-IA10B receiver
  GND -------------------- Common ground`}
                            </pre>

                            <h3 className="text-xl text-primary font-display mt-8">POWER DISTRIBUTION</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-yellow-300">
{`Power Wiring Diagram
====================

[36V LiPo Battery]
       |
       +----------------------> Hoverboard Mainboard
       |                              |
       |                              +--> Left Motor
       |                              +--> Right Motor
       |
       +--> [DC-DC Buck Converter 36V -> 5V/5A]
                     |
                     +--> Mini PC (USB-C PD or barrel jack)
                     |
                     +--> Arduino Mega (VIN or USB)
                               |
                               +--> TF Mini Pro (5V)
                               +--> MPU6050 (3.3V from Arduino)
                               +--> Neo-6M GPS (3.3V-5V)
                               +--> HuskyLens (5V)
                               +--> HC-SR04 x5 (5V)
                               +--> FS-IA10B Receiver (5V)`}
                            </pre>

                            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded mt-4">
                                <h4 className="font-display text-red-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> CRITICAL: LEVEL SHIFTING
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    The Hoverboard mainboard operates at 3.3V logic while Arduino uses 5V.
                                    You MUST use a bidirectional logic level shifter between them!
                                </p>
                                <pre className="bg-black/50 p-2 rounded mt-2 text-xs font-mono">
{`Arduino Pin 10 (RX) ← Level Shifter ← Hoverboard TX (3.3V)
Arduino Pin 11 (TX) → Level Shifter → Hoverboard RX (3.3V)`}
                                </pre>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="arduino" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">ARDUINO FIRMWARE SETUP</h3>
                            
                            <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                <h4 className="font-display text-primary mb-2">1. INSTALL ARDUINO IDE</h4>
                                <p className="text-xs text-muted-foreground mb-2">Download from arduino.cc/en/software</p>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">2. INSTALL LIBRARIES</h4>
                                <p className="text-xs text-muted-foreground mb-2">Open Library Manager (Tools → Manage Libraries)</p>
                                <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <li>• <span className="text-green-400">IBusBM</span> by bmellink - For FlySky iBUS</li>
                                    <li>• Wire (built-in) - I2C communication</li>
                                    <li>• SoftwareSerial (built-in) - Extra serial ports</li>
                                </ul>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">3. UPLOAD FIRMWARE</h4>
                                <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                    <li>Open arduino_mega_sensor_controller.ino</li>
                                    <li>Select Board: Arduino Mega 2560</li>
                                    <li>Select Port: Your Arduino's COM port</li>
                                    <li>Click Upload</li>
                                </ol>
                            </div>

                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded">
                                <h4 className="font-display text-green-400 mb-2">4. VERIFY INSTALLATION</h4>
                                <p className="text-xs text-muted-foreground mb-2">Open Serial Monitor at 115200 baud:</p>
                                <pre className="bg-black/50 p-2 rounded text-xs font-mono text-green-300">
{`{"event":"boot","version":"3.0.0","controller":"Arduino Mega 2560"}
{"event":"ready","ibus":true,"channels":10}`}
                                </pre>
                            </div>

                            <h4 className="text-lg text-primary font-display mt-6">TELEMETRY FORMAT</h4>
                            <p className="text-xs text-muted-foreground mb-2">Arduino sends JSON at 20Hz:</p>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-blue-300">
{`{
  "t": 123456,                                    // Timestamp (ms)
  "gps": {"lat": 34.0522, "lng": -118.2437, "spd": 0, "acc": 5},
  "imu": {"hdg": 45.0, "pitch": 1.2, "roll": -0.5, "ax": 0, "ay": 0, "az": 1},
  "lidar": 150,                                   // Distance in cm
  "ultra": [50, 45, 60, 55, 48],                 // 5 sensors in cm
  "ibus": {
    "con": true,                                  // Receiver connected
    "ch": [1500,1500,1000,1500,1000,1000,1500,1000,1500,1500]
  },
  "bat": 85.0                                     // Battery percentage
}`}
                            </pre>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="minipc" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">MINI PC HOST SETUP</h3>
                            
                            <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                <h4 className="font-display text-primary mb-2">RECOMMENDED HARDWARE</h4>
                                <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <li>• Intel Celeron J3455 / N5095 / N5105</li>
                                    <li>• 8GB RAM (minimum 4GB)</li>
                                    <li>• 64GB SSD / eMMC</li>
                                    <li>• USB ports for Arduino</li>
                                    <li>• WiFi for dashboard access</li>
                                </ul>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">UBUNTU INSTALLATION</h4>
                                <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Python dependencies
sudo apt install python3-pip python3-dev

# 3. Install required packages
pip3 install flask flask-cors flask-socketio pyserial

# 4. Add user to dialout group (for serial access)
sudo usermod -aG dialout $USER

# 5. Reboot for group changes
sudo reboot`}
                                </pre>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">RUNNING THE CONTROLLER</h4>
                                <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`cd firmware/raspberry_pi_master
python3 rover_controller.py

# Expected output:
# ============================================================
#   ROVER MASTER CONTROLLER v3.0.0
#   Mini PC Host - Ubuntu / Intel Celeron
#   RC: FlySky FS-I6x + FS-IA10B (iBUS Protocol)
# ============================================================
# 
# [OK] Connected to Arduino on /dev/ttyACM0
# [INIT] Starting server on 0.0.0.0:5000`}
                                </pre>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded">
                                <h4 className="font-display text-yellow-400 mb-2">AUTO-START ON BOOT</h4>
                                <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`# Create systemd service
sudo nano /etc/systemd/system/rover.service

# Add this content:
[Unit]
Description=RoverOS Controller
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/firmware/raspberry_pi_master
ExecStart=/usr/bin/python3 rover_controller.py
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start:
sudo systemctl enable rover
sudo systemctl start rover`}
                                </pre>
                            </div>

                            <h4 className="text-lg text-primary font-display mt-6">API ENDPOINTS</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left p-2 text-primary">Endpoint</th>
                                            <th className="text-left p-2 text-primary">Method</th>
                                            <th className="text-left p-2 text-primary">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-muted-foreground">
                                        <tr className="border-b border-border/50"><td className="p-2">/api/telemetry</td><td className="p-2">GET</td><td className="p-2">Current sensor data</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">/api/control</td><td className="p-2">POST</td><td className="p-2">throttle, steering</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">/api/stop</td><td className="p-2">POST</td><td className="p-2">Emergency stop</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">/api/mode</td><td className="p-2">POST</td><td className="p-2">MANUAL/RC/AUTONOMOUS</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">/api/ibus</td><td className="p-2">GET</td><td className="p-2">RC channel values</td></tr>
                                        <tr><td className="p-2">/api/status</td><td className="p-2">GET</td><td className="p-2">Connection status</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="ibus" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">FlySky iBUS SETUP</h3>
                            
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded">
                                <h4 className="font-display text-green-400 mb-2 flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> iBUS ADVANTAGES
                                </h4>
                                <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <li>✓ Single wire for all 10 channels (vs 10 wires for PWM)</li>
                                    <li>✓ Digital signal - more accurate than analog PWM</li>
                                    <li>✓ ~143 Hz update rate</li>
                                    <li>✓ Built-in failsafe detection</li>
                                    <li>✓ Simple wiring - just 3 connections</li>
                                </ul>
                            </div>

                            <h4 className="text-lg text-primary font-display mt-4">WIRING DIAGRAM</h4>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto font-mono text-cyan-300">
{`FlySky FS-IA10B to Arduino Mega (iBUS Protocol)
================================================

    FS-IA10B Receiver              Arduino Mega
    -----------------              ------------
    iBUS Pin ------------------>   Pin 19 (RX1)
    VCC (5V) ------------------>   5V
    GND ----------------------->   GND

That's it! Just 3 wires for all 10 channels.`}
                            </pre>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded mt-4">
                                <h4 className="font-display text-secondary mb-2">TRANSMITTER SETUP</h4>
                                <ol className="text-xs font-mono space-y-2 text-muted-foreground list-decimal list-inside">
                                    <li>Power on FS-I6x transmitter</li>
                                    <li>Long press "OK" to enter menu</li>
                                    <li>Go to System → Output Mode</li>
                                    <li>Change from "PWM" to "iBUS"</li>
                                    <li>Save and power cycle transmitter</li>
                                </ol>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded mt-4">
                                <h4 className="font-display text-accent mb-2">BINDING RECEIVER</h4>
                                <ol className="text-xs font-mono space-y-2 text-muted-foreground list-decimal list-inside">
                                    <li>Hold receiver BIND button while powering on</li>
                                    <li>LED blinks rapidly (binding mode)</li>
                                    <li>On transmitter: Menu → System → RX Bind</li>
                                    <li>Press OK to start binding</li>
                                    <li>Wait for receiver LED to go solid (success)</li>
                                    <li>Power cycle both devices to test</li>
                                </ol>
                            </div>

                            <h4 className="text-lg text-primary font-display mt-6">CHANNEL MAPPING</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left p-2 text-primary">Channel</th>
                                            <th className="text-left p-2 text-primary">Control</th>
                                            <th className="text-left p-2 text-primary">Range</th>
                                            <th className="text-left p-2 text-primary">Use</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-muted-foreground">
                                        <tr className="border-b border-border/50"><td className="p-2">CH1</td><td className="p-2">Right Stick H</td><td className="p-2">1000-2000</td><td className="p-2 text-green-400">Steering</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH2</td><td className="p-2">Right Stick V</td><td className="p-2">1000-2000</td><td className="p-2">Unused</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH3</td><td className="p-2">Left Stick V</td><td className="p-2">1000-2000</td><td className="p-2 text-green-400">Throttle</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH4</td><td className="p-2">Left Stick H</td><td className="p-2">1000-2000</td><td className="p-2">Unused</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH5</td><td className="p-2">Switch A</td><td className="p-2">1000/2000</td><td className="p-2">Mode Select</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH6</td><td className="p-2">Switch B</td><td className="p-2">1000/2000</td><td className="p-2">Lights/Horn</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH7</td><td className="p-2">Switch C</td><td className="p-2">1000/1500/2000</td><td className="p-2">Speed Limit</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH8</td><td className="p-2">Switch D</td><td className="p-2">1000/2000</td><td className="p-2 text-red-400">E-Stop</td></tr>
                                        <tr className="border-b border-border/50"><td className="p-2">CH9</td><td className="p-2">VrA Dial</td><td className="p-2">1000-2000</td><td className="p-2">Fine Adjust</td></tr>
                                        <tr><td className="p-2">CH10</td><td className="p-2">VrB Dial</td><td className="p-2">1000-2000</td><td className="p-2">Fine Adjust</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="sensors" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">SENSOR SETUP</h3>

                            <div className="space-y-4">
                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h4 className="font-display text-primary mb-2">TF MINI PRO LIDAR</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Specifications:</p>
                                            <ul className="space-y-1">
                                                <li>• Range: 0.1m - 12m</li>
                                                <li>• Accuracy: ±1cm (0.1-6m)</li>
                                                <li>• Update Rate: 100Hz</li>
                                                <li>• Interface: UART 115200</li>
                                            </ul>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Wiring:</p>
                                            <ul className="space-y-1">
                                                <li>• VCC → Arduino 5V</li>
                                                <li>• GND → Arduino GND</li>
                                                <li>• TX → Arduino Pin 17 (RX2)</li>
                                                <li>• RX → Arduino Pin 16 (TX2)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h4 className="font-display text-secondary mb-2">MPU6050 IMU</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Specifications:</p>
                                            <ul className="space-y-1">
                                                <li>• 3-axis accelerometer</li>
                                                <li>• 3-axis gyroscope</li>
                                                <li>• I2C Address: 0x68</li>
                                                <li>• Supply: 3.3V (has regulator)</li>
                                            </ul>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Wiring:</p>
                                            <ul className="space-y-1">
                                                <li>• VCC → Arduino 5V</li>
                                                <li>• GND → Arduino GND</li>
                                                <li>• SDA → Arduino Pin 20</li>
                                                <li>• SCL → Arduino Pin 21</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                    <h4 className="font-display text-accent mb-2">NEO-6M GPS</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Specifications:</p>
                                            <ul className="space-y-1">
                                                <li>• 50 channels</li>
                                                <li>• Position accuracy: 2.5m</li>
                                                <li>• Update Rate: 1-5Hz</li>
                                                <li>• Interface: UART 9600</li>
                                            </ul>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Wiring:</p>
                                            <ul className="space-y-1">
                                                <li>• VCC → Arduino 5V</li>
                                                <li>• GND → Arduino GND</li>
                                                <li>• TX → Arduino Pin 15 (RX3)</li>
                                                <li>• RX → Arduino Pin 14 (TX3)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded">
                                    <h4 className="font-display text-purple-400 mb-2">HC-SR04 ULTRASONIC (x5)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Specifications:</p>
                                            <ul className="space-y-1">
                                                <li>• Range: 2cm - 400cm</li>
                                                <li>• Accuracy: 3mm</li>
                                                <li>• Angle: 15°</li>
                                                <li>• Supply: 5V</li>
                                            </ul>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Pin Assignments:</p>
                                            <ul className="space-y-1">
                                                <li>• #1 Front: Trig=22, Echo=23</li>
                                                <li>• #2 Left: Trig=24, Echo=25</li>
                                                <li>• #3 Right: Trig=26, Echo=27</li>
                                                <li>• #4 Rear-L: Trig=28, Echo=29</li>
                                                <li>• #5 Rear-R: Trig=30, Echo=31</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded">
                                    <h4 className="font-display text-blue-400 mb-2">HUSKYLENS AI CAMERA</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Specifications:</p>
                                            <ul className="space-y-1">
                                                <li>• Built-in AI processor</li>
                                                <li>• Object detection</li>
                                                <li>• Face recognition</li>
                                                <li>• I2C Address: 0x32</li>
                                            </ul>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground">
                                            <p className="font-bold mb-1">Wiring:</p>
                                            <ul className="space-y-1">
                                                <li>• VCC → Arduino 5V</li>
                                                <li>• GND → Arduino GND</li>
                                                <li>• SDA → Arduino Pin 20</li>
                                                <li>• SCL → Arduino Pin 21</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="assembly" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">ROVER ASSEMBLY GUIDE</h3>

                            <div className="space-y-4">
                                <div className="bg-primary/10 border border-primary/30 p-4 rounded">
                                    <h4 className="font-display text-primary mb-2">STEP 1: CHASSIS & MOTORS</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Mount hoverboard motors to chassis frame</li>
                                        <li>Connect motor wires to hoverboard mainboard</li>
                                        <li>Secure mainboard with vibration dampening</li>
                                        <li>Route power cables to battery compartment</li>
                                    </ol>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h4 className="font-display text-secondary mb-2">STEP 2: POWER SYSTEM</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Install 36V LiPo battery in protected compartment</li>
                                        <li>Connect battery to hoverboard mainboard</li>
                                        <li>Install DC-DC converter (36V → 5V)</li>
                                        <li>Wire Mini PC and Arduino power from converter</li>
                                        <li>Add main power switch and fuse</li>
                                    </ol>
                                </div>

                                <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                    <h4 className="font-display text-accent mb-2">STEP 3: ELECTRONICS</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Mount Mini PC in ventilated enclosure</li>
                                        <li>Mount Arduino Mega near sensors</li>
                                        <li>Connect USB cable between Mini PC and Arduino</li>
                                        <li>Install level shifter for hoverboard UART</li>
                                        <li>Wire hoverboard to Arduino pins 10/11</li>
                                    </ol>
                                </div>

                                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded">
                                    <h4 className="font-display text-green-400 mb-2">STEP 4: SENSORS</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Mount LIDAR at front, facing forward</li>
                                        <li>Mount 5 ultrasonic sensors around chassis</li>
                                        <li>Install MPU6050 on flat surface, level</li>
                                        <li>Mount GPS with antenna facing sky</li>
                                        <li>Position HuskyLens for forward vision</li>
                                        <li>Connect all sensor wires to Arduino</li>
                                    </ol>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded">
                                    <h4 className="font-display text-yellow-400 mb-2">STEP 5: RC SYSTEM</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Mount FlySky FS-IA10B receiver</li>
                                        <li>Connect iBUS wire to Arduino Pin 19</li>
                                        <li>Connect receiver power (5V, GND)</li>
                                        <li>Bind receiver to transmitter</li>
                                        <li>Configure transmitter for iBUS output</li>
                                    </ol>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded">
                                    <h4 className="font-display text-blue-400 mb-2">STEP 6: SOFTWARE</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Flash Arduino with sensor controller firmware</li>
                                        <li>Install Ubuntu on Mini PC</li>
                                        <li>Install Python dependencies</li>
                                        <li>Copy rover_controller.py to Mini PC</li>
                                        <li>Configure auto-start service</li>
                                        <li>Test all systems</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="troubleshoot" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">TROUBLESHOOTING</h3>

                            <div className="space-y-4">
                                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded">
                                    <h4 className="font-display text-red-400 mb-2">ARDUINO NOT DETECTED</h4>
                                    <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`# Check if Arduino is connected
ls /dev/ttyACM* /dev/ttyUSB*

# Add user to dialout group
sudo usermod -aG dialout $USER

# Logout and login again, then verify
groups

# Check USB cable is data-capable (not charge-only)`}
                                    </pre>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded">
                                    <h4 className="font-display text-yellow-400 mb-2">iBUS NOT WORKING</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• Verify receiver is bound (solid LED, not blinking)</li>
                                        <li>• Check iBUS wire is connected to Pin 19 (RX1)</li>
                                        <li>• Verify transmitter is set to iBUS output mode</li>
                                        <li>• Power cycle the receiver</li>
                                        <li>• Check 5V power to receiver</li>
                                    </ul>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded">
                                    <h4 className="font-display text-blue-400 mb-2">NO GPS LOCK</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• GPS needs clear sky view</li>
                                        <li>• First fix takes 5-10 minutes</li>
                                        <li>• Check antenna connection</li>
                                        <li>• Verify Serial3 wiring (pins 14/15)</li>
                                        <li>• Try outdoors with antenna facing up</li>
                                    </ul>
                                </div>

                                <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded">
                                    <h4 className="font-display text-purple-400 mb-2">I2C SENSORS NOT RESPONDING</h4>
                                    <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`// Run I2C scanner sketch on Arduino
// Expected addresses:
// - MPU6050: 0x68 or 0x69
// - HuskyLens: 0x32

// Check wiring:
// - SDA → Pin 20
// - SCL → Pin 21
// - Verify 4.7kΩ pull-up resistors if needed`}
                                    </pre>
                                </div>

                                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded">
                                    <h4 className="font-display text-orange-400 mb-2">HOVERBOARD NOT RESPONDING</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• Use logic level shifter (Arduino 5V ↔ Hoverboard 3.3V)</li>
                                        <li>• Verify SoftwareSerial pins (10/11)</li>
                                        <li>• Check baud rate is 115200</li>
                                        <li>• Test with hoverboard's native Bluetooth app first</li>
                                        <li>• Verify FOC firmware is installed on mainboard</li>
                                    </ul>
                                </div>

                                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded">
                                    <h4 className="font-display text-green-400 mb-2">WEB DASHBOARD NOT LOADING</h4>
                                    <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <li>• Check Mini PC is connected to WiFi</li>
                                        <li>• Verify rover_controller.py is running</li>
                                        <li>• Check firewall allows port 5000</li>
                                        <li>• Try: http://[mini-pc-ip]:5000</li>
                                        <li>• Check console for Python errors</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
}
