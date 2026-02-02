#!/usr/bin/env python3
"""
================================================================================
ROVER MASTER CONTROLLER v3.0.0
================================================================================
Mini PC Host Controller (Intel Celeron / Ubuntu)
Communicates with Arduino Mega sensor controller via USB Serial
Receives iBUS RC data from Arduino (FlySky FS-IA10B via iBUS protocol)
Serves telemetry API and WebSocket to web dashboard
================================================================================
"""

import serial
import serial.tools.list_ports
import json
import time
import threading
import os
import socket
import signal
import atexit
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime
import math
from pathfinding import GPSPoint, WaypointRouter, ObstacleAvoidance
from ydlidar_driver import YDLidarDriver, find_lidar_port, LidarScan

# ===== CONFIGURATION =====
ARDUINO_BAUD = 115200
WEB_HOST = '0.0.0.0'
WEB_PORT = 5000  # Match main web server port

# ===== AUTO-DETECT ARDUINO PORT =====
def find_arduino_port():
    """Auto-detect Arduino Mega port on Linux/Windows"""
    ports = list(serial.tools.list_ports.comports())
    
    # Priority order for detection
    arduino_identifiers = [
        'Arduino Mega',
        'Arduino',
        'ttyACM',
        'ttyUSB',
        'CH340',
        'CP210',
    ]
    
    for port in ports:
        port_info = f"{port.device} {port.description} {port.manufacturer or ''}"
        for identifier in arduino_identifiers:
            if identifier.lower() in port_info.lower():
                return port.device
    
    # Fallback to common paths
    fallback_paths = [
        '/dev/ttyACM0',
        '/dev/ttyACM1',
        '/dev/ttyUSB0',
        '/dev/ttyUSB1',
        'COM3',
        'COM4',
    ]
    
    for path in fallback_paths:
        try:
            test = serial.Serial(path, ARDUINO_BAUD, timeout=0.1)
            test.close()
            return path
        except:
            continue
    
    return None

# ===== GLOBAL STATE =====
class RoverState:
    def __init__(self):
        # Telemetry
        self.speed = 0.0
        self.battery = 85.0
        self.heading = 0.0
        self.pitch = 0.0
        self.roll = 0.0
        self.accel = {'x': 0, 'y': 0, 'z': 0}
        self.lidar_distance = 0
        self.ultrasonic = [0, 0, 0, 0, 0]
        
        # GPS
        self.gps_lat = 0.0
        self.gps_lng = 0.0
        self.gps_speed = 0.0
        self.gps_accuracy = 0
        
        # iBUS RC Control (10 channels from FlySky FS-IA10B)
        self.ibus_connected = False
        self.ibus_channels = [1500] * 10  # Default center position
        self.ibus_frame_rate = 0
        
        # System
        self.mode = "MANUAL"
        self.connected = False
        self.last_update = None
        self.telemetry_log = []
        self.max_log_entries = 100
        
        # Host info
        self.host_type = "Mini PC"
        self.host_os = "Ubuntu"
        
    def update_from_arduino(self, data):
        """Update state from Arduino JSON telemetry"""
        try:
            # GPS
            if 'gps' in data:
                self.gps_lat = data['gps'].get('lat', 0)
                self.gps_lng = data['gps'].get('lng', 0)
                self.gps_speed = data['gps'].get('spd', 0)
                self.gps_accuracy = data['gps'].get('acc', 0)
            
            # IMU
            if 'imu' in data:
                self.heading = data['imu'].get('hdg', 0)
                self.pitch = data['imu'].get('pitch', 0)
                self.roll = data['imu'].get('roll', 0)
                self.accel = {
                    'x': data['imu'].get('ax', 0),
                    'y': data['imu'].get('ay', 0),
                    'z': data['imu'].get('az', 0)
                }
            
            # Sensors
            self.lidar_distance = data.get('lidar', 0)
            self.ultrasonic = data.get('ultra', [0]*5)
            self.battery = data.get('bat', 85)
            
            # iBUS RC
            if 'ibus' in data:
                self.ibus_connected = data['ibus'].get('con', False)
                self.ibus_channels = data['ibus'].get('ch', [1500]*10)
            
            self.last_update = datetime.now().isoformat()
            
            # Log entry
            log_entry = f"[{self.last_update[:19]}] HDG:{self.heading:.0f}° BAT:{self.battery:.0f}%"
            self.telemetry_log.append(log_entry)
            if len(self.telemetry_log) > self.max_log_entries:
                self.telemetry_log.pop(0)
                
        except Exception as e:
            print(f"[ERROR] Failed to parse telemetry: {e}")
    
    def to_dict(self):
        """Convert state to dictionary for JSON/WebSocket"""
        return {
            'timestamp': int(time.time() * 1000),
            'gps': {
                'lat': round(self.gps_lat, 6),
                'lng': round(self.gps_lng, 6),
                'speed': round(self.gps_speed, 1),
                'accuracy': self.gps_accuracy
            },
            'imu': {
                'heading': round(self.heading, 1),
                'pitch': round(self.pitch, 1),
                'roll': round(self.roll, 1),
                'accelX': round(self.accel['x'], 2),
                'accelY': round(self.accel['y'], 2),
                'accelZ': round(self.accel['z'], 2)
            },
            'lidar': [
                {'angle': 0, 'distance': self.lidar_distance}
            ],
            'ultrasonic': self.ultrasonic,
            'battery': round(self.battery, 1),
            'motorLeft': 0,
            'motorRight': 0,
            'mode': self.mode,
            'connected': self.connected,
            'ibus': {
                'connected': self.ibus_connected,
                'channels': self.ibus_channels,
                'frameRate': self.ibus_frame_rate
            }
        }
    
    def get_rc_control(self):
        """Convert iBUS channels to throttle/steering"""
        if not self.ibus_connected:
            return 0, 0
        
        # Channel mapping (FlySky FS-I6x default):
        # CH1 = Roll/Aileron (steering)
        # CH2 = Pitch/Elevator
        # CH3 = Throttle
        # CH4 = Yaw/Rudder
        # CH5-10 = Aux switches
        
        throttle_raw = self.ibus_channels[2]  # CH3
        steering_raw = self.ibus_channels[0]  # CH1
        
        # Convert 1000-2000 to -100..100
        throttle = int((throttle_raw - 1500) / 5)  # ±100
        steering = int((steering_raw - 1500) / 5)  # ±100
        
        return throttle, steering


rover = RoverState()
router = WaypointRouter()
arduino = None
arduino_port = None

# ===== YDLIDAR 360° SCANNER =====
lidar = None
lidar_port = None

def connect_lidar():
    """Connect to YDLIDAR T-mini Plus"""
    global lidar, lidar_port
    
    lidar_port = find_lidar_port()
    
    if lidar_port is None:
        print("[LIDAR] No YDLIDAR found!")
        return False
    
    try:
        lidar = YDLidarDriver(lidar_port)
        
        def on_lidar_scan(scan: LidarScan):
            """Callback for each complete LIDAR scan"""
            if socketio and scan.points:
                scan_data = lidar.get_scan_dict()
                socketio.emit('lidar_scan', scan_data)
        
        lidar.set_scan_callback(on_lidar_scan)
        
        if lidar.connect():
            print(f"[OK] YDLIDAR connected on {lidar_port}")
            return True
        else:
            print("[ERROR] Failed to start YDLIDAR")
            return False
            
    except Exception as e:
        print(f"[ERROR] LIDAR connection failed: {e}")
        return False

# ===== ARDUINO COMMUNICATION =====
def connect_arduino():
    """Establish connection to Arduino"""
    global arduino, arduino_port
    
    arduino_port = find_arduino_port()
    
    if arduino_port is None:
        print("[ERROR] No Arduino found!")
        rover.connected = False
        return False
    
    try:
        arduino = serial.Serial(arduino_port, ARDUINO_BAUD, timeout=1)
        time.sleep(2)  # Wait for Arduino reset
        rover.connected = True
        print(f"[OK] Connected to Arduino on {arduino_port}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        rover.connected = False
        return False

def read_telemetry_thread():
    """Background thread to read telemetry from Arduino"""
    while True:
        try:
            if arduino and arduino.in_waiting > 0:
                line = arduino.readline().decode('utf-8', errors='ignore').strip()
                
                if line.startswith('{'):
                    try:
                        data = json.loads(line)
                        rover.update_from_arduino(data)
                        
                        # Broadcast via WebSocket if available
                        if socketio:
                            socketio.emit('telemetry', rover.to_dict())
                            
                    except json.JSONDecodeError:
                        pass
                elif line:
                    print(f"[ARDUINO] {line}")
                    
        except Exception as e:
            print(f"[ERROR] Telemetry read: {e}")
            time.sleep(1)
        
        time.sleep(0.01)

def send_command(cmd):
    """Send command to Arduino"""
    try:
        if arduino and arduino.is_open:
            arduino.write((cmd + '\n').encode('utf-8'))
            return True
    except Exception as e:
        print(f"[ERROR] Send command: {e}")
    return False

# ===== RC CONTROL THREAD =====
def rc_control_thread():
    """Background thread for RC control via iBUS with LIDAR obstacle avoidance"""
    while True:
        try:
            if rover.mode == "RC" and rover.ibus_connected:
                throttle, steering = rover.get_rc_control()
                
                if abs(throttle) < 5:
                    throttle = 0
                if abs(steering) < 5:
                    steering = 0
                
                if lidar and lidar.connected and throttle > 0:
                    sectors = lidar.get_sector_distances(8)
                    if sectors:
                        new_throttle, new_steering, action = ObstacleAvoidance.get_avoidance_from_lidar_360(
                            sectors, throttle, steering
                        )
                        if action != "LIDAR_CLEAR":
                            print(f"[LIDAR] {action}: T={new_throttle} S={new_steering}")
                            throttle = new_throttle
                            steering = new_steering
                
                drive_rover(throttle, steering)
                
        except Exception as e:
            print(f"[ERROR] RC control: {e}")
        
        time.sleep(0.05)

# ===== CONTROL LOGIC =====
def drive_rover(throttle, steering):
    """Drive rover with throttle and steering"""
    throttle = max(-100, min(100, throttle))
    steering = max(-100, min(100, steering))
    
    # Scale to Arduino range (-1000 to 1000)
    throttle = int(throttle * 10)
    steering = int(steering * 10)
    
    send_command(f"MOVE:{throttle},{steering}")

def stop_rover():
    """Emergency stop"""
    send_command("STOP")
    rover.mode = "MANUAL"
    print("[COMMAND] Emergency stop")

# ===== FLASK WEB SERVER =====
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    """Get current telemetry state"""
    return jsonify(rover.to_dict())

@app.route('/api/control', methods=['POST'])
def control():
    """Manual control: POST {throttle, steering}"""
    data = request.json
    throttle = data.get('throttle', 0)
    steering = data.get('steering', 0)
    
    rover.mode = "MANUAL"
    drive_rover(throttle, steering)
    
    return jsonify({'status': 'ok', 'throttle': throttle, 'steering': steering})

@app.route('/api/stop', methods=['POST'])
def stop():
    """Emergency stop"""
    stop_rover()
    return jsonify({'status': 'stopped'})

@app.route('/api/mode', methods=['POST'])
def set_mode():
    """Set control mode: MANUAL, RC, AUTONOMOUS"""
    data = request.json
    mode = data.get('mode', 'MANUAL').upper()
    
    if mode in ['MANUAL', 'RC', 'AUTONOMOUS']:
        rover.mode = mode
        return jsonify({'status': 'ok', 'mode': mode})
    
    return jsonify({'error': 'Invalid mode'}), 400

@app.route('/api/ibus', methods=['GET'])
def get_ibus():
    """Get iBUS RC channel data"""
    return jsonify({
        'connected': rover.ibus_connected,
        'channels': rover.ibus_channels,
        'frameRate': rover.ibus_frame_rate,
        'control': {
            'throttle': rover.get_rc_control()[0],
            'steering': rover.get_rc_control()[1]
        }
    })

@app.route('/api/status', methods=['GET'])
def status():
    """Get connection status"""
    return jsonify({
        'arduino_connected': rover.connected,
        'arduino_port': arduino_port,
        'lidar_connected': lidar.connected if lidar else False,
        'lidar_port': lidar_port,
        'ibus_connected': rover.ibus_connected,
        'mode': rover.mode,
        'host': rover.host_type,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/system/info', methods=['GET'])
def system_info():
    """Get system information"""
    hostname = socket.gethostname()
    
    return jsonify({
        'rover_name': 'RoverOS v3.0',
        'firmware_version': '3.0.0',
        'controller': 'Arduino Mega 2560',
        'host': 'Mini PC (Intel Celeron)',
        'host_os': 'Ubuntu',
        'hostname': hostname,
        'rc_receiver': 'FlySky FS-IA10B (iBUS)',
        'rc_transmitter': 'FlySky FS-I6x',
        'sensors': {
            'lidar_360': 'YDLIDAR T-mini Plus',
            'camera': 'HuskyLens AI',
            'imu': 'MPU6050',
            'gps': 'Neo-6M',
            'ultrasonic': 5
        }
    })

@app.route('/api/logs', methods=['GET'])
def logs():
    """Get telemetry logs"""
    return jsonify({'logs': rover.telemetry_log})

# ===== LIDAR 360° API =====
@app.route('/api/lidar/scan', methods=['GET'])
def get_lidar_scan():
    """Get full 360° LIDAR scan data"""
    if not lidar:
        return jsonify({'error': 'LIDAR not connected', 'points': []}), 503
    
    return jsonify(lidar.get_scan_dict())

@app.route('/api/lidar/sectors', methods=['GET'])
def get_lidar_sectors():
    """Get LIDAR data grouped by angular sectors"""
    if not lidar:
        return jsonify({'error': 'LIDAR not connected', 'sectors': []}), 503
    
    num_sectors = request.args.get('sectors', 8, type=int)
    return jsonify({
        'connected': lidar.connected,
        'sectors': lidar.get_sector_distances(num_sectors)
    })

@app.route('/api/lidar/closest', methods=['GET'])
def get_lidar_closest():
    """Get closest obstacle from LIDAR"""
    if not lidar:
        return jsonify({'error': 'LIDAR not connected'}), 503
    
    closest = lidar.get_closest_obstacle()
    if closest:
        return jsonify({
            'connected': True,
            'angle': round(closest.angle, 1),
            'distance': closest.distance,
            'intensity': closest.intensity
        })
    return jsonify({'connected': True, 'angle': None, 'distance': None})

@app.route('/api/lidar/obstacles', methods=['GET'])
def get_lidar_obstacles():
    """Get obstacles within specified range"""
    if not lidar:
        return jsonify({'error': 'LIDAR not connected', 'obstacles': []}), 503
    
    min_angle = request.args.get('min_angle', 0, type=float)
    max_angle = request.args.get('max_angle', 360, type=float)
    max_distance = request.args.get('max_distance', 2000, type=float)
    
    obstacles = lidar.get_obstacles_in_range(min_angle, max_angle, max_distance)
    
    return jsonify({
        'connected': lidar.connected,
        'count': len(obstacles),
        'obstacles': [
            {'angle': round(o.angle, 1), 'distance': o.distance, 'intensity': o.intensity}
            for o in obstacles
        ]
    })

# ===== WAYPOINT NAVIGATION API =====
@app.route('/api/navigation/waypoints', methods=['GET'])
def get_waypoints():
    """Get all waypoints"""
    waypoints = [{'lat': wp.lat, 'lng': wp.lng, 'name': wp.name} for wp in router.waypoints]
    return jsonify({'waypoints': waypoints})

@app.route('/api/navigation/waypoints', methods=['POST'])
def add_waypoint():
    """Add a waypoint"""
    data = request.json
    router.add_waypoint(data.get('lat'), data.get('lng'), data.get('name', f'WP{len(router.waypoints)+1}'))
    return jsonify({'status': 'added', 'total': len(router.waypoints)})

@app.route('/api/navigation/start', methods=['POST'])
def start_navigation():
    """Start autonomous navigation"""
    if len(router.waypoints) == 0:
        return jsonify({'error': 'No waypoints'}), 400
    
    router.plan_route()
    rover.mode = "AUTONOMOUS"
    return jsonify({'status': 'started', 'waypoints': len(router.route)})

@app.route('/api/navigation/abort', methods=['POST'])
def abort_navigation():
    """Abort navigation"""
    rover.mode = "MANUAL"
    stop_rover()
    return jsonify({'status': 'aborted'})

# ===== WEBSOCKET EVENTS =====
@socketio.on('connect')
def handle_connect():
    print("[WS] Client connected")
    emit('status', {'connected': rover.connected, 'mode': rover.mode})

@socketio.on('command')
def handle_command(data):
    """Handle WebSocket commands"""
    cmd_type = data.get('type')
    
    if cmd_type == 'move':
        throttle = data.get('throttle', 0)
        steering = data.get('steering', 0)
        drive_rover(throttle, steering)
    elif cmd_type == 'stop':
        stop_rover()
    elif cmd_type == 'mode':
        rover.mode = data.get('mode', 'MANUAL')

# ===== MAIN =====
if __name__ == '__main__':
    print("\n" + "="*60)
    print("  ROVER MASTER CONTROLLER v3.0.0")
    print("  Mini PC Host - Ubuntu / Intel Celeron")
    print("  RC: FlySky FS-I6x + FS-IA10B (iBUS Protocol)")
    print("  LIDAR: YDLIDAR T-mini Plus (360° Scanner)")
    print("="*60 + "\n")
    
    # Connect to Arduino
    if not connect_arduino():
        print("[WARN] Arduino not found, running in demo mode...")
    
    # Connect to YDLIDAR
    if not connect_lidar():
        print("[WARN] LIDAR not found, SLAM disabled...")
    
    # Start background threads
    threading.Thread(target=read_telemetry_thread, daemon=True).start()
    threading.Thread(target=rc_control_thread, daemon=True).start()
    
    # Cleanup function
    def cleanup():
        print("\n[SHUTDOWN] Stopping all devices...")
        if lidar:
            try:
                lidar.disconnect()
                print("[OK] LIDAR motor stopped")
            except:
                pass
        if arduino:
            try:
                stop_rover()
                arduino.close()
                print("[OK] Arduino disconnected")
            except:
                pass
        print("[OK] Goodbye")
    
    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGTERM, lambda sig, frame: (cleanup(), exit(0)))
    signal.signal(signal.SIGINT, lambda sig, frame: (cleanup(), exit(0)))
    
    # Start server
    print(f"[INIT] Starting server on {WEB_HOST}:{WEB_PORT}")
    print("[INIT] API Endpoints:")
    print("       /api/telemetry     - Rover telemetry")
    print("       /api/lidar/scan    - 360° LIDAR scan")
    print("       /api/lidar/sectors - Sector distances")
    print("       /api/lidar/closest - Closest obstacle")
    print("[INIT] Press Ctrl+C to stop\n")
    
    socketio.run(app, host=WEB_HOST, port=WEB_PORT, debug=False)
