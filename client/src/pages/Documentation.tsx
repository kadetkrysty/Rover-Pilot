import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, FileText, Cpu, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
                <div className="bg-card border-b border-border p-2">
                    <TabsList className="bg-background/50">
                        <TabsTrigger value="wiring" className="font-mono">WIRING_DIAGRAM.MD</TabsTrigger>
                        <TabsTrigger value="arduino" className="font-mono">ARDUINO_CONTROLLER.INO</TabsTrigger>
                        <TabsTrigger value="python" className="font-mono">RPI_MASTER.PY</TabsTrigger>
                        <TabsTrigger value="flysky" className="font-mono">FLYSKY_RECEIVER_SETUP</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="wiring" className="flex-1 p-6 m-0 overflow-auto">
                    <ScrollArea className="h-full pr-4">
                        <div className="prose prose-invert max-w-none font-mono text-sm">
                            <h3 className="text-xl text-primary font-display">POWER DISTRIBUTION</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs">
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
                  └──> [HUSKY LENS]
`}
                            </pre>

                            <h3 className="text-xl text-primary font-display mt-8">DATA LINES</h3>
                            <pre className="bg-black/50 p-4 border border-border rounded-lg text-xs">
{`RASPBERRY PI <==USB SERIAL==> ARDUINO MEGA

ARDUINO MEGA:
  - Serial1 (19/18) <==> HOVERBOARD UART (Rx/Tx) [Level Shifted 3.3V <-> 5V!]
  - Serial2 (17/16) <==> GPS MODULE
  - Serial3 (15/14) <==> LIDAR TF MINI
  - I2C (20/21)     <==> HUSKY LENS
  - I2C (20/21)     <==> IMU MPU6050
  - Digital Pins    <==> ULTRASONIC TRIG/ECHO PAIRS
`}
                            </pre>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="arduino" className="flex-1 p-0 m-0 relative">
                     <ScrollArea className="h-full">
                        <pre className="p-4 text-xs font-mono text-blue-300 leading-relaxed">
{`#include <SoftwareSerial.h>
#include "HuskyLens.h"
#include <Wire.h>

// --- PIN DEFINITIONS ---
#define HOVER_SERIAL Serial1
#define LIDAR_SERIAL Serial3
#define GPS_SERIAL   Serial2

HuskyLens huskyLens;

struct TelemetryPacket {
  float speed;
  float battery;
  float heading;
  int lidarDist;
};

void setup() {
  Serial.begin(115200); // USB to Pi
  HOVER_SERIAL.begin(115200);
  LIDAR_SERIAL.begin(115200);
  GPS_SERIAL.begin(9600);

  Wire.begin();
  huskyLens.begin(Wire);
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  // 1. Read Sensors
  int dist = readLidar();
  
  // 2. Read AI Camera
  if (huskyLens.request()) {
    if (huskyLens.available()) {
       // Object avoidance logic here
    }
  }

  // 3. Send Telemetry to Pi
  Serial.print("DATA:");
  Serial.print(dist);
  Serial.print(",");
  // ... other data
  Serial.println();

  delay(50);
}

int readLidar() {
  // TF Mini Pro Implementation
  return 0; // Placeholder
}
`}
                        </pre>
                     </ScrollArea>
                </TabsContent>

                <TabsContent value="python" className="flex-1 p-0 m-0 relative">
                     <ScrollArea className="h-full">
                        <pre className="p-4 text-xs font-mono text-green-300 leading-relaxed">
{`import serial
import time
import json
from flask import Flask, jsonify, request

app = Flask(__name__)
arduino = serial.Serial('/dev/ttyACM0', 115200, timeout=1)

current_state = {
    "speed": 0,
    "battery": 100,
    "mode": "MANUAL"
}

@app.route('/api/telemetry')
def get_telemetry():
    # Read line from Arduino
    if arduino.in_waiting > 0:
        line = arduino.readline().decode('utf-8').rstrip()
        # Parse data...
    return jsonify(current_state)

@app.route('/api/control', methods=['POST'])
def control_rover():
    data = request.json
    # x = steering, y = throttle
    command = f"MOVE:{data['x']},{data['y']}\\n"
    arduino.write(command.encode('utf-8'))
    return "OK"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
`}
                        </pre>
                     </ScrollArea>
                </TabsContent>

                <TabsContent value="flysky" className="flex-1 p-0 m-0 relative">
                     <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="text-lg font-display text-primary mb-3">FLYSKY FS-I6x 10-CHANNEL SETUP TUTORIAL</h3>
                                <p className="text-sm text-muted-foreground font-mono mb-4">
                                    Complete guide with wiring diagrams and operation instructions
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-display text-primary mb-2">1. GPIO PINOUT REFERENCE</h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Raspberry Pi GPIO pins required for 10-channel receiver connection
                                    </p>
                                    <div className="bg-black/50 p-3 rounded border border-border overflow-hidden">
                                        <img src="/assets/generated_images/raspberry_pi_gpio_pinout_diagram.png" alt="Raspberry Pi GPIO Pinout" className="w-full rounded" />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-display text-primary mb-2">2. RECEIVER WIRING TO RASPBERRY PI</h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        FlySky FS-IA10B receiver PWM connections with 3.3V-5V level shifter
                                    </p>
                                    <div className="bg-black/50 p-3 rounded border border-border overflow-hidden">
                                        <img src="/assets/generated_images/flysky_receiver_wiring_to_raspberry_pi.png" alt="FlySky Receiver Wiring" className="w-full rounded" />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-display text-primary mb-2">3. TRANSMITTER OPERATION GUIDE</h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        How to use FlySky FS-I6x transmitter for manual and autonomous rover control
                                    </p>
                                    <div className="bg-black/50 p-3 rounded border border-border overflow-hidden">
                                        <img src="/assets/generated_images/flysky_transmitter_operation_guide.png" alt="FlySky Transmitter Operation" className="w-full rounded" />
                                    </div>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded">
                                    <h4 className="font-display text-secondary mb-2">CHANNEL MAPPING (10 TOTAL)</h4>
                                    <div className="text-xs font-mono space-y-1 text-muted-foreground">
                                        <div>CH1 (GPIO 17) → Roll/Steering</div>
                                        <div>CH2 (GPIO 27) → Pitch/Forward-Back</div>
                                        <div>CH3 (GPIO 22) → Throttle</div>
                                        <div>CH4 (GPIO 23) → Yaw/Rotation</div>
                                        <div>CH5 (GPIO 24) → Switch A</div>
                                        <div>CH6 (GPIO 25) → Switch B / Mode Select</div>
                                        <div>CH7 (GPIO 26) → Auxiliary Channel 1</div>
                                        <div>CH8 (GPIO 19) → Auxiliary Channel 2</div>
                                        <div>CH9 (GPIO 20) → Auxiliary Channel 3</div>
                                        <div>CH10 (GPIO 21) → Auxiliary Channel 4</div>
                                    </div>
                                </div>

                                <div className="bg-accent/10 border border-accent/30 p-4 rounded">
                                    <h4 className="font-display text-accent mb-2">QUICK SETUP STEPS</h4>
                                    <ol className="text-xs font-mono space-y-1 text-muted-foreground list-decimal list-inside">
                                        <li>Install Python RPi.GPIO library on Raspberry Pi</li>
                                        <li>Wire FS-IA10B receiver to GPIO pins (use level shifter!)</li>
                                        <li>Bind FS-IA10B to FS-I6x transmitter</li>
                                        <li>Configure transmitter channels (CH1-6)</li>
                                        <li>Calibrate all sticks and switches</li>
                                        <li>Copy flysky_receiver.py to Raspberry Pi</li>
                                        <li>Update rover_controller.py with FlySky routes</li>
                                        <li>Verify all 10 channels in dashboard</li>
                                    </ol>
                                </div>

                                <div className="bg-card/50 border border-border p-4 rounded">
                                    <h4 className="font-display text-primary mb-2">CONTROL MODES</h4>
                                    <div className="text-xs font-mono space-y-2 text-muted-foreground">
                                        <div>
                                            <span className="text-secondary font-bold">Manual Mode (Switch B OFF):</span>
                                            <div className="pl-4">Full joystick control, direct throttle input, real-time steering response</div>
                                        </div>
                                        <div>
                                            <span className="text-accent font-bold">Autonomous Mode (Switch B ON):</span>
                                            <div className="pl-4">Auto-navigation to waypoints, throttle controls speed, obstacle avoidance</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground/70 pt-4 border-t border-border">
                                Full documentation available in FLYSKY_SETUP_GUIDE.md (2500+ lines with detailed troubleshooting)
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
