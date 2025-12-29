import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, FileText, Cpu, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Tutorial Images
import rpiPinout from '@assets/generated_images/raspberry_pi_gpio_pinout_diagram.png';
import flySkyWiring from '@assets/generated_images/flysky_receiver_wiring_to_raspberry_pi.png';
import flySkyOperation from '@assets/generated_images/flysky_transmitter_operation_guide.png';
import rpiHardware from '@assets/generated_images/raspberry_pi_3_b+_hardware_overview.png';
import arduinoPins from '@assets/generated_images/arduino_mega_2560_pin_layout.png';
import flySkyControls from '@assets/generated_images/flysky_fs-i6x_transmitter_controls.png';
import lidarWiring from '@assets/generated_images/lidar_tf_mini_pro_to_arduino_connection.png';
import ultrasonicWiring from '@assets/generated_images/ultrasonic_sensor_array_wiring.png';
import imuWiring from '@assets/generated_images/imu_mpu6050_i2c_wiring.png';
import gpsWiring from '@assets/generated_images/gps_module_serial_connection.png';
import hoverboardWiring from '@assets/generated_images/hoverboard_motor_control_wiring.png';
import systemAssembly from '@assets/generated_images/complete_rover_system_assembly.png';

export default function Documentation() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
            <h1 className="text-3xl font-display font-bold text-primary">SYSTEM ARCHITECTURE</h1>
            <p className="text-muted-foreground font-mono mt-1">Component Integration & Wiring Plan</p>
        </div>
        <Link href="/">
            <Button variant="outline" className="font-mono">
                <ArrowLeft className="w-4 h-4 mr-2" /> RETURN TO HUD
            </Button>
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-10rem)]">
        {/* Sidebar */}
        <div className="col-span-3 space-y-4">
             <div className="hud-panel p-4">
                <h3 className="font-display text-lg mb-4 text-primary">COMPONENT LIST</h3>
                <ul className="space-y-2 text-sm font-mono text-muted-foreground">
                    <li className="flex items-center gap-2 text-foreground"><Cpu className="w-4 h-4 text-primary" /> Raspberry Pi 3 B+ (Master)</li>
                    <li className="flex items-center gap-2 text-foreground"><Cpu className="w-4 h-4 text-secondary" /> Arduino Mega (Sensor Slave)</li>
                    <li className="pl-6">• Hoverboard Mainboard (UART)</li>
                    <li className="pl-6">• HuskyLens AI (I2C)</li>
                    <li className="pl-6">• TF Mini Pro Lidar (Serial)</li>
                    <li className="pl-6">• GPS Module (Serial)</li>
                    <li className="pl-6">• IMU MPU6050 (I2C)</li>
                    <li className="pl-6">• 5x HC-SR04 Ultrasonic</li>
                </ul>
             </div>

             <Button className="w-full font-mono" variant="secondary">
                <Download className="w-4 h-4 mr-2" /> DOWNLOAD ALL FILES
             </Button>
        </div>

        {/* Main Content */}
        <div className="col-span-9 hud-panel p-0 overflow-hidden flex flex-col">
            <Tabs defaultValue="wiring" className="h-full flex flex-col">
                <div className="bg-card border-b border-border p-2 overflow-x-auto">
                    <TabsList className="bg-background/50 w-max">
                        <TabsTrigger value="wiring" className="font-mono text-xs">WIRING</TabsTrigger>
                        <TabsTrigger value="arduino" className="font-mono text-xs">ARDUINO CODE</TabsTrigger>
                        <TabsTrigger value="python" className="font-mono text-xs">PYTHON CODE</TabsTrigger>
                        <TabsTrigger value="rpi-setup" className="font-mono text-xs">RPi SETUP</TabsTrigger>
                        <TabsTrigger value="arduino-setup" className="font-mono text-xs">ARDUINO CONFIG</TabsTrigger>
                        <TabsTrigger value="flysky-setup" className="font-mono text-xs">FLYSKY SETUP</TabsTrigger>
                        <TabsTrigger value="sensors" className="font-mono text-xs">SENSORS</TabsTrigger>
                        <TabsTrigger value="system" className="font-mono text-xs">SYSTEM ASSEMBLY</TabsTrigger>
                    </TabsList>
                </div>
                
                {/* WIRING TAB */}
                <TabsContent value="wiring" className="flex-1 p-0 m-0 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <h3 className="text-xl text-primary font-display">POWER DISTRIBUTION</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto">
{`[BATTERY 36V]
  │
  ├──> [HOVERBOARD MAINBOARD]
  │       │
  │       └──> [MOTORS L/R]
  │
  ├──> [DC-DC CONVERTER 36V->5V 5A]
          │
          ├──> [RASPBERRY PI 3 B+] (USB Power)
          │       │
          │       └──> [USB CAMERA]
          │
          └──> [ARDUINO MEGA] (VIN Pin)
                  │
                  ├──> [SENSORS 5V VCC]
                  └──> [HUSKY LENS]`}
                            </pre>

                            <h3 className="text-xl text-primary font-display mt-8">SERIAL DATA CONNECTIONS</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs overflow-x-auto">
{`RASPBERRY PI <==USB SERIAL==> ARDUINO MEGA

ARDUINO MEGA SERIAL PORTS:
  Serial0 (0/1)     ← USB to Raspberry Pi (115200 baud)
  Serial1 (19/18)   ← Hoverboard UART (115200 baud, 3.3V with level shifter)
  Serial2 (17/16)   ← GPS Module (9600 baud)
  Serial3 (15/14)   ← LIDAR TF Mini Pro (115200 baud)

ARDUINO MEGA I2C:
  SDA/SCL (20/21)   ← HuskyLens AI Camera (100kHz)
  SDA/SCL (20/21)   ← IMU MPU6050 (400kHz)

RASPBERRY PI GPIO (for FlySky Receiver):
  GPIO 17-21, 26    ← 10 PWM Channels from FS-IA10B

DIGITAL PINS (Ultrasonic Sensors - 5 units):
  Sensor 1: Trig=22, Echo=23 (Front)
  Sensor 2: Trig=24, Echo=25 (Left)
  Sensor 3: Trig=26, Echo=27 (Right)
  Sensor 4: Trig=28, Echo=29 (Back Left)
  Sensor 5: Trig=30, Echo=31 (Back Right)`}
                            </pre>
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* ARDUINO CODE TAB */}
                <TabsContent value="arduino" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <pre className="p-4 text-xs font-mono text-blue-300 leading-relaxed whitespace-pre-wrap break-words">
{`#include <SoftwareSerial.h>
#include "HuskyLens.h"
#include <Wire.h>
#include <MPU6050.h>

// --- PIN DEFINITIONS ---
#define HOVER_SERIAL Serial1
#define LIDAR_SERIAL Serial3
#define GPS_SERIAL   Serial2

// Ultrasonic Sensors
const int US_TRIG[] = {22, 24, 26, 28, 30};
const int US_ECHO[] = {23, 25, 27, 29, 31};
const int NUM_SENSORS = 5;

HuskyLens huskyLens;
MPU6050 mpu;

struct TelemetryPacket {
  float speed;
  float battery;
  float heading;
  int lidarDist;
  int ultrasonicDist[5];
  float accelX, accelY, accelZ;
  float gyroX, gyroY, gyroZ;
};

void setup() {
  Serial.begin(115200);  // USB to Pi
  HOVER_SERIAL.begin(115200);
  LIDAR_SERIAL.begin(115200);
  GPS_SERIAL.begin(9600);

  Wire.begin();
  huskyLens.begin(Wire);
  mpu.initialize();
  
  // Setup ultrasonic pins
  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(US_TRIG[i], OUTPUT);
    pinMode(US_ECHO[i], INPUT);
  }
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  // 1. Read all sensors
  TelemetryPacket telemetry;
  
  // Ultrasonic
  for (int i = 0; i < NUM_SENSORS; i++) {
    telemetry.ultrasonicDist[i] = readUltrasonic(i);
  }
  
  // IMU
  mpu.getAcceleration(&telemetry.accelX, &telemetry.accelY, &telemetry.accelZ);
  mpu.getRotation(&telemetry.gyroX, &telemetry.gyroY, &telemetry.gyroZ);
  
  // LiDAR
  telemetry.lidarDist = readLidar();
  
  // HuskyLens
  if (huskyLens.request()) {
    if (huskyLens.available()) {
      // Object detection logic
    }
  }

  // 2. Send telemetry to Pi
  sendTelemetry(telemetry);
  delay(50);
}

int readUltrasonic(int sensor) {
  digitalWrite(US_TRIG[sensor], LOW);
  delayMicroseconds(2);
  digitalWrite(US_TRIG[sensor], HIGH);
  delayMicroseconds(10);
  digitalWrite(US_TRIG[sensor], LOW);
  
  long duration = pulseIn(US_ECHO[sensor], HIGH, 30000);
  return duration * 0.034 / 2;  // Convert to cm
}

int readLidar() {
  int dist = 0;
  if (LIDAR_SERIAL.available() >= 5) {
    if (LIDAR_SERIAL.read() == 0x59) {
      if (LIDAR_SERIAL.read() == 0x59) {
        byte low = LIDAR_SERIAL.read();
        byte high = LIDAR_SERIAL.read();
        LIDAR_SERIAL.read();  // checksum
        dist = (high << 8) | low;
      }
    }
  }
  return dist;
}

void sendTelemetry(TelemetryPacket &pkt) {
  Serial.write((byte*)&pkt, sizeof(pkt));
}`}
                        </pre>
                     </ScrollArea>
                </TabsContent>

                {/* PYTHON CODE TAB */}
                <TabsContent value="python" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <pre className="p-4 text-xs font-mono text-green-300 leading-relaxed whitespace-pre-wrap break-words">
{`import serial
import time
import json
import threading
from flask import Flask, jsonify, request

app = Flask(__name__)
arduino = serial.Serial('/dev/ttyACM0', 115200, timeout=1)

current_state = {
    "speed": 0,
    "battery": 100,
    "mode": "MANUAL",
    "lidar": 0,
    "ultrasonic": [0, 0, 0, 0, 0],
    "heading": 0.0,
    "position": {"lat": 0.0, "lon": 0.0}
}

def read_telemetry():
    """Read sensor data from Arduino"""
    global current_state
    while True:
        try:
            if arduino.in_waiting > 0:
                # Parse incoming telemetry
                data = arduino.read(32)  # TelemetryPacket size
                current_state["lidar"] = int.from_bytes(
                    data[8:10], 'little'
                )
                current_state["battery"] = 85
        except Exception as e:
            print(f"Telemetry error: {e}")
        time.sleep(0.05)

@app.route('/api/telemetry')
def get_telemetry():
    return jsonify(current_state)

@app.route('/api/control', methods=['POST'])
def control_rover():
    data = request.json
    x = data.get('x', 0)  # steering -100 to 100
    y = data.get('y', 0)  # throttle -100 to 100
    
    command = f"MOVE:{x},{y}\\n"
    arduino.write(command.encode('utf-8'))
    
    return jsonify({"status": "ok"})

@app.route('/api/command', methods=['POST'])
def send_command():
    data = request.json
    cmd = data.get('command', '')
    
    arduino.write(f"{cmd}\\n".encode('utf-8'))
    
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Start telemetry thread
    telem_thread = threading.Thread(target=read_telemetry, daemon=True)
    telem_thread.start()
    
    app.run(host='0.0.0.0', port=8080, debug=False)`}
                        </pre>
                     </ScrollArea>
                </TabsContent>

                {/* RASPBERRY PI SETUP TAB */}
                <TabsContent value="rpi-setup" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h4 className="font-display text-primary mb-2">RASPBERRY PI 3 B+ HARDWARE</h4>
                                <p className="text-xs text-muted-foreground mb-3">Physical board layout and connectivity</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={rpiHardware} alt="Raspberry Pi 3 B+ Hardware" className="w-full rounded" />
                                </div>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">SETUP COMMANDS</h4>
                                <pre className="bg-black/50 p-3 rounded text-xs font-mono text-green-300 overflow-x-auto">
{`# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Python and dependencies
sudo apt install python3-pip python3-dev
sudo apt install python3-rpi.gpio  # For FlySky receiver
pip3 install flask flask-cors pyserial

# 3. Set up GPIO permissions
sudo usermod -a -G gpio pi

# 4. Clone rover code
git clone https://github.com/yourusername/Rover-Pilot.git
cd Rover-Pilot/firmware/raspberry_pi_master

# 5. Run rover controller
python3 rover_controller.py

# Access dashboard at: http://raspberrypi.local:8080`}
                                </pre>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">RASPBERRY PI GPIO FOR FLYSKY RECEIVER</h4>
                                <div className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <div>GPIO 17 (Pin 11) ← Channel 1 (Roll/Steering)</div>
                                    <div>GPIO 27 (Pin 13) ← Channel 2 (Pitch)</div>
                                    <div>GPIO 22 (Pin 15) ← Channel 3 (Throttle)</div>
                                    <div>GPIO 23 (Pin 16) ← Channel 4 (Yaw)</div>
                                    <div>GPIO 24 (Pin 18) ← Channel 5 (Switch A)</div>
                                    <div>GPIO 25 (Pin 22) ← Channel 6 (Switch B)</div>
                                    <div>GPIO 26 (Pin 37) ← Channel 7 (Aux 1)</div>
                                    <div>GPIO 19 (Pin 35) ← Channel 8 (Aux 2)</div>
                                    <div>GPIO 20 (Pin 38) ← Channel 9 (Aux 3)</div>
                                    <div>GPIO 21 (Pin 40) ← Channel 10 (Aux 4)</div>
                                    <div className="mt-2">GND (Multiple pins) ← Black wire</div>
                                    <div>5V (Pin 2 or 4) ← Red wire</div>
                                </div>
                            </div>
                        </div>
                     </ScrollArea>
                </TabsContent>

                {/* ARDUINO SETUP TAB */}
                <TabsContent value="arduino-setup" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h4 className="font-display text-primary mb-2">ARDUINO MEGA 2560 PIN LAYOUT</h4>
                                <p className="text-xs text-muted-foreground mb-3">All pins and their functions</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={arduinoPins} alt="Arduino Mega Pin Layout" className="w-full rounded" />
                                </div>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">SERIAL CONFIGURATION</h4>
                                <div className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <div className="font-bold text-secondary">Serial0 (Pins 0/1) - USB Communication</div>
                                    <div className="pl-4">→ Connected to Raspberry Pi via USB</div>
                                    <div className="pl-4">→ Baud Rate: 115200</div>
                                    
                                    <div className="font-bold text-secondary mt-3">Serial1 (Pins 19/18) - Hoverboard</div>
                                    <div className="pl-4">→ RX: Pin 19, TX: Pin 18</div>
                                    <div className="pl-4">→ Baud Rate: 115200</div>
                                    <div className="pl-4">→ ⚠️ Use 3.3V-5V level shifter!</div>
                                    
                                    <div className="font-bold text-secondary mt-3">Serial2 (Pins 17/16) - GPS Module</div>
                                    <div className="pl-4">→ RX: Pin 17, TX: Pin 16</div>
                                    <div className="pl-4">→ Baud Rate: 9600</div>
                                    
                                    <div className="font-bold text-secondary mt-3">Serial3 (Pins 15/14) - LiDAR</div>
                                    <div className="pl-4">→ RX: Pin 15, TX: Pin 14</div>
                                    <div className="pl-4">→ Baud Rate: 115200</div>
                                </div>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">I2C CONFIGURATION (Pins 20/21)</h4>
                                <div className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <div>SDA: Pin 20, SCL: Pin 21</div>
                                    <div>I2C Speed: 400kHz (standard)</div>
                                    <div className="mt-2 font-bold">Devices on I2C Bus:</div>
                                    <div className="pl-4">• HuskyLens AI Camera (I2C address: 0x32)</div>
                                    <div className="pl-4">• IMU MPU6050 (I2C address: 0x68)</div>
                                </div>
                            </div>
                        </div>
                     </ScrollArea>
                </TabsContent>

                {/* FLYSKY SETUP TAB */}
                <TabsContent value="flysky-setup" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h4 className="font-display text-primary mb-2">FLYSKY FS-I6X TRANSMITTER CONTROLS</h4>
                                <p className="text-xs text-muted-foreground mb-3">Physical controller layout and operation</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={flySkyControls} alt="FlySky FS-I6x Controls" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">RECEIVER WIRING TO RASPBERRY PI</h4>
                                <p className="text-xs text-muted-foreground mb-3">FlySky FS-IA10B 10-channel connections</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={flySkyWiring} alt="FlySky Wiring" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">TRANSMITTER OPERATION</h4>
                                <p className="text-xs text-muted-foreground mb-3">How to use transmitter for control</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={flySkyOperation} alt="FlySky Operation" className="w-full rounded" />
                                </div>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">BINDING RECEIVER STEPS</h4>
                                <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                    <li>Hold receiver bind button, power on receiver</li>
                                    <li>LED will blink rapidly (binding mode)</li>
                                    <li>Press bind button on transmitter</li>
                                    <li>Wait 2-3 seconds for binding to complete</li>
                                    <li>Receiver LED becomes solid green (success)</li>
                                    <li>Test: Move transmitter sticks, verify receiver responds</li>
                                </ol>
                            </div>
                        </div>
                     </ScrollArea>
                </TabsContent>

                {/* SENSORS TAB */}
                <TabsContent value="sensors" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h4 className="font-display text-primary mb-2">LIDAR TF MINI PRO WIRING</h4>
                                <p className="text-xs text-muted-foreground mb-3">Serial connection to Arduino Serial3</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={lidarWiring} alt="LiDAR Wiring" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">ULTRASONIC SENSOR ARRAY (5x HC-SR04)</h4>
                                <p className="text-xs text-muted-foreground mb-3">Front, left, right, back-left, back-right configuration</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={ultrasonicWiring} alt="Ultrasonic Sensors" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">IMU MPU6050 I2C WIRING</h4>
                                <p className="text-xs text-muted-foreground mb-3">Accelerometer & Gyroscope sensor connection</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={imuWiring} alt="IMU Wiring" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">GPS MODULE SERIAL WIRING</h4>
                                <p className="text-xs text-muted-foreground mb-3">Connected to Arduino Serial2</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={gpsWiring} alt="GPS Wiring" className="w-full rounded" />
                                </div>
                            </div>

                            <div className="bg-card/50 border border-border p-4 rounded">
                                <h4 className="font-display text-primary mb-2">SENSOR CALIBRATION</h4>
                                <div className="text-xs font-mono space-y-2 text-muted-foreground">
                                    <div><span className="font-bold text-secondary">LiDAR:</span> No calibration needed, warm-up 5 seconds before use</div>
                                    <div><span className="font-bold text-secondary">Ultrasonic:</span> Mount perpendicular to ground, test range 2-400cm</div>
                                    <div><span className="font-bold text-secondary">IMU:</span> Place on level surface, run calibration routine on startup</div>
                                    <div><span className="font-bold text-secondary">GPS:</span> Wait 30-60 seconds for first lock, works best outdoors</div>
                                </div>
                            </div>
                        </div>
                     </ScrollArea>
                </TabsContent>

                {/* SYSTEM ASSEMBLY TAB */}
                <TabsContent value="system" className="flex-1 p-0 m-0 relative overflow-hidden">
                     <ScrollArea className="h-full w-full">
                        <div className="p-6 space-y-6 pr-4">
                            <div>
                                <h4 className="font-display text-primary mb-2">COMPLETE ROVER SYSTEM ASSEMBLY</h4>
                                <p className="text-xs text-muted-foreground mb-3">All components and their placement on rover chassis</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={systemAssembly} alt="System Assembly" className="w-full rounded" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-display text-primary mb-2">HOVERBOARD MOTOR CONTROL</h4>
                                <p className="text-xs text-muted-foreground mb-3">UART communication to hoverboard mainboard</p>
                                <div className="bg-black/50 p-3 rounded border border-border">
                                    <img src={hoverboardWiring} alt="Hoverboard Wiring" className="w-full rounded" />
                                </div>
                            </div>

                            <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                <h4 className="font-display text-secondary mb-2">ASSEMBLY CHECKLIST</h4>
                                <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                    <li>Mount Raspberry Pi on top (master controller)</li>
                                    <li>Mount Arduino Mega with proper spacing for cooling</li>
                                    <li>Connect USB between Pi and Arduino</li>
                                    <li>Mount hoverboard base with motors intact</li>
                                    <li>Connect hoverboard UART to Arduino Serial1 (with level shifter)</li>
                                    <li>Mount 5 ultrasonic sensors on all sides</li>
                                    <li>Mount LiDAR on front center (highest point)</li>
                                    <li>Mount GPS antenna on top (clear view of sky)</li>
                                    <li>Mount IMU sensor on Arduino board</li>
                                    <li>Connect all power (36V battery to hoverboard, DC-DC to Pi/Arduino)</li>
                                    <li>Verify all serial communications</li>
                                    <li>Test each sensor individually</li>
                                    <li>Bind FlySky receiver to transmitter</li>
                                    <li>Calibrate all sensors and transmitter</li>
                                </ol>
                            </div>

                            <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                <h4 className="font-display text-accent mb-2">POWER BUDGET</h4>
                                <div className="text-xs font-mono space-y-1 text-muted-foreground">
                                    <div>Hoverboard Motors: ~30-40A at full speed</div>
                                    <div>Raspberry Pi 3 B+: ~500-900mA @ 5V</div>
                                    <div>Arduino Mega: ~200mA @ 5V</div>
                                    <div>All Sensors: ~300-500mA @ 5V</div>
                                    <div className="mt-2 font-bold">Total: 36V @ 30-40A peak, 5V @ 2A required</div>
                                    <div>Recommended: 36V 50A battery pack, 5A DC-DC converter</div>
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
