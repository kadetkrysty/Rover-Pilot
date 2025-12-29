#!/usr/bin/env python3
"""
Rover Master Controller for Raspberry Pi 3 B+
Communicates with Arduino Mega sensor controller via USB Serial
Serves telemetry API to web dashboard
"""

import serial
import json
import time
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import math

# ===== CONFIGURATION =====
ARDUINO_PORT = '/dev/ttyACM0'  # USB serial port (may be ttyACM1, etc.)
ARDUINO_BAUD = 115200
WEB_HOST = '0.0.0.0'
WEB_PORT = 8080

# ===== GLOBAL STATE =====
class RoverState:
    def __init__(self):
        self.speed = 0.0
        self.battery = 85.0
        self.heading = 0.0
        self.pitch = 0.0
        self.roll = 0.0
        self.lidar_distance = 0
        self.ultrasonic = [0, 0, 0, 0, 0]
        self.gps_lat = 0.0
        self.gps_lon = 0.0
        self.mode = "MANUAL"
        self.connected = False
        self.last_update = None
        self.telemetry_log = []
        self.max_log_entries = 100
        
    def update(self, data_dict):
        """Update state from Arduino telemetry"""
        self.speed = data_dict.get('spd', 0)
        self.battery = data_dict.get('bat', 85)
        self.heading = data_dict.get('hdg', 0)
        self.pitch = data_dict.get('pitch', 0)
        self.roll = data_dict.get('roll', 0)
        self.lidar_distance = data_dict.get('lidar', 0)
        self.ultrasonic = data_dict.get('ultra', [0]*5)
        self.last_update = datetime.now().isoformat()
        
        # Add to log
        log_entry = f"[{self.last_update}] SPD:{self.speed:.1f} BAT:{self.battery:.0f}% HDG:{self.heading:.0f}°"
        self.telemetry_log.append(log_entry)
        if len(self.telemetry_log) > self.max_log_entries:
            self.telemetry_log.pop(0)
    
    def to_dict(self):
        """Convert state to dictionary for JSON"""
        return {
            'speed': round(self.speed, 1),
            'battery': round(self.battery, 1),
            'heading': round(self.heading, 1),
            'pitch': round(self.pitch, 1),
            'roll': round(self.roll, 1),
            'lidarDistance': self.lidar_distance,
            'ultrasonic': self.ultrasonic,
            'gps': {'lat': self.gps_lat, 'lng': self.gps_lon},
            'mode': self.mode,
            'connected': self.connected,
            'lastUpdate': self.last_update,
            'log': self.telemetry_log
        }

rover = RoverState()
arduino = None

# ===== ARDUINO COMMUNICATION =====
def connect_arduino():
    """Establish connection to Arduino"""
    global arduino
    try:
        arduino = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=1)
        time.sleep(2)  # Wait for Arduino to reset
        rover.connected = True
        print(f"[OK] Connected to Arduino on {ARDUINO_PORT}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to connect Arduino: {e}")
        rover.connected = False
        return False

def read_telemetry_thread():
    """Background thread to read telemetry from Arduino"""
    while True:
        try:
            if arduino and arduino.in_waiting > 0:
                line = arduino.readline().decode('utf-8').strip()
                
                if line.startswith('{'):
                    # Parse JSON telemetry
                    data = json.loads(line)
                    rover.update(data)
                else:
                    # Parse text logs
                    print(f"[ARDUINO] {line}")
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f"[ERROR] Telemetry read error: {e}")
        
        time.sleep(0.01)  # 10ms polling

def send_command(cmd):
    """Send command to Arduino"""
    try:
        if arduino:
            arduino.write((cmd + '\n').encode('utf-8'))
            return True
    except Exception as e:
        print(f"[ERROR] Failed to send command: {e}")
    return False

# ===== CONTROL LOGIC =====
def drive_rover(throttle, steering):
    """
    Drive rover with throttle and steering
    throttle: -100 to 100 (backward to forward)
    steering: -100 to 100 (left to right)
    """
    # Clamp values
    throttle = max(-100, min(100, throttle))
    steering = max(-100, min(100, steering))
    
    # Scale to Arduino range (-200 to 200)
    throttle = int(throttle * 2)
    steering = int(steering * 2)
    
    cmd = f"MOVE:{throttle},{steering}"
    send_command(cmd)
    rover.mode = "MANUAL"

def stop_rover():
    """Emergency stop"""
    send_command("STOP")
    print("[COMMAND] Emergency stop engaged")

def autonomous_mode():
    """Example autonomous logic using SLAM/SLAM"""
    rover.mode = "AUTONOMOUS"
    print("[MODE] Switching to autonomous navigation")
    # TODO: Implement SLAM-based navigation

# ===== FLASK WEB SERVER =====
app = Flask(__name__)
CORS(app)

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    """Get current telemetry state"""
    return jsonify(rover.to_dict())

@app.route('/api/control', methods=['POST'])
def control():
    """Control rover: POST {throttle: -100..100, steering: -100..100}"""
    data = request.json
    throttle = data.get('throttle', 0)
    steering = data.get('steering', 0)
    
    drive_rover(throttle, steering)
    
    return jsonify({'status': 'ok', 'throttle': throttle, 'steering': steering})

@app.route('/api/stop', methods=['POST'])
def stop():
    """Emergency stop"""
    stop_rover()
    return jsonify({'status': 'stopped'})

@app.route('/api/status', methods=['GET'])
def status():
    """Get connection status"""
    return jsonify({
        'arduino_connected': rover.connected,
        'mode': rover.mode,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/logs', methods=['GET'])
def logs():
    """Get telemetry logs"""
    return jsonify({'logs': rover.telemetry_log})

@app.route('/api/system/info', methods=['GET'])
def system_info():
    """Get system information"""
    return jsonify({
        'rover_name': 'SLAM-Rover-v2.4',
        'firmware_version': '2.4.0',
        'controller': 'Arduino Mega 2560',
        'host': 'Raspberry Pi 3 B+',
        'sensors': {
            'lidar': 'TF Mini Pro',
            'camera': 'HuskyLens AI',
            'imu': 'MPU6050',
            'gps': 'Neo-6M',
            'ultrasonic': 5
        }
    })

# ===== MAIN =====
if __name__ == '__main__':
    print("\n" + "="*60)
    print("  ROVER MASTER CONTROLLER v2.4")
    print("  Raspberry Pi 3 B+ - Autonomous System")
    print("="*60 + "\n")
    
    # Connect to Arduino
    if not connect_arduino():
        print("[WARN] Continuing in demo mode without Arduino...")
        rover.connected = False
    
    # Start telemetry reader thread
    telemetry_thread = threading.Thread(target=read_telemetry_thread, daemon=True)
    telemetry_thread.start()
    
    # Start Flask server
    print(f"[INIT] Starting web server on {WEB_HOST}:{WEB_PORT}")
    print(f"[INIT] Open http://<rpi_ip>:{WEB_PORT} in your browser")
    print("[INIT] Press Ctrl+C to stop\n")
    
    try:
        app.run(host=WEB_HOST, port=WEB_PORT, debug=False)
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Rover Master shutting down...")
        if arduino:
            stop_rover()
            arduino.close()
        print("[OK] Goodbye")
