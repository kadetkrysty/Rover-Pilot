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
                        <TabsTrigger value="flybaby" className="font-mono">FLYBABY_SETUP.MD</TabsTrigger>
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
            </Tabs>
        </div>
      </div>
    </div>
  );
}
