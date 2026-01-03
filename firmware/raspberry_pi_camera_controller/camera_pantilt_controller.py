#!/usr/bin/env python3
"""
Camera Pan/Tilt Controller for RoverOS
=======================================
Controls the camera pan/tilt mechanism using SlushEngine Model X LT
with Raspberry Pi 3 B+.

Hardware Setup:
- Motor 1 (Port 1): Pan motor - ±180° rotation capability
- Motor 2 (Port 2): Tilt motor - ±90° rotation capability

Communication:
- Receives commands via WebSocket from Mini PC
- Sends position feedback to main rover controller

Author: RoverOS Team
Version: 1.0.0
"""

import time
import json
import threading
import socket
import struct

try:
    import Slush
    SLUSH_AVAILABLE = True
except ImportError:
    print("[WARNING] SlushEngine library not available - running in simulation mode")
    SLUSH_AVAILABLE = False


class MockMotor:
    """Mock motor for testing without hardware"""
    def __init__(self, motor_id):
        self.motor_id = motor_id
        self.position = 0
        self.max_speed = 1000
        self.running = False
        
    def setCurrent(self, hold, run, acc, dec):
        print(f"[MOCK] Motor {self.motor_id}: setCurrent({hold}, {run}, {acc}, {dec})")
        
    def setMaxSpeed(self, speed):
        self.max_speed = speed
        print(f"[MOCK] Motor {self.motor_id}: setMaxSpeed({speed})")
        
    def setAccel(self, accel):
        print(f"[MOCK] Motor {self.motor_id}: setAccel({accel})")
        
    def setDecel(self, decel):
        print(f"[MOCK] Motor {self.motor_id}: setDecel({decel})")
        
    def setMicroSteps(self, steps):
        print(f"[MOCK] Motor {self.motor_id}: setMicroSteps({steps})")
        
    def goTo(self, position):
        self.position = position
        print(f"[MOCK] Motor {self.motor_id}: goTo({position})")
        
    def move(self, steps):
        self.position += steps
        print(f"[MOCK] Motor {self.motor_id}: move({steps})")
        
    def getPosition(self):
        return self.position
    
    def isBusy(self):
        return False
    
    def waitMove(self):
        time.sleep(0.1)
        
    def softStop(self):
        self.running = False
        print(f"[MOCK] Motor {self.motor_id}: softStop()")
        
    def free(self):
        print(f"[MOCK] Motor {self.motor_id}: free()")
        
    def setHome(self):
        self.position = 0
        print(f"[MOCK] Motor {self.motor_id}: setHome()")


class CameraPanTiltController:
    """
    Camera Pan/Tilt Controller using SlushEngine Model X LT
    
    Motor Configuration:
    - Motor 1: Pan (horizontal rotation)
      - Range: ±180° (total 360° rotation)
      - Positive = clockwise (right)
      - Negative = counter-clockwise (left)
      
    - Motor 2: Tilt (vertical rotation)
      - Range: ±90° (total 180° rotation)
      - Positive = up
      - Negative = down
    """
    
    STEPS_PER_REV = 200
    MICROSTEPS = 128
    STEPS_PER_DEGREE = (STEPS_PER_REV * MICROSTEPS) / 360
    
    PAN_MIN_DEG = -180
    PAN_MAX_DEG = 180
    TILT_MIN_DEG = -90
    TILT_MAX_DEG = 90
    
    def __init__(self, main_controller_host='localhost', main_controller_port=5001):
        """
        Initialize the camera pan/tilt controller.
        
        Args:
            main_controller_host: Hostname of the main rover controller
            main_controller_port: Port for communication with main controller
        """
        self.main_controller_host = main_controller_host
        self.main_controller_port = main_controller_port
        
        self.current_pan_deg = 0.0
        self.current_tilt_deg = 0.0
        self.target_pan_deg = 0.0
        self.target_tilt_deg = 0.0
        
        self.is_homed = False
        self.is_running = False
        
        self._init_slush_board()
        self._init_motors()
        
    def _init_slush_board(self):
        """Initialize the SlushEngine board"""
        if SLUSH_AVAILABLE:
            try:
                self.board = Slush.sBoard()
                print("[INFO] SlushEngine board initialized successfully")
            except Exception as e:
                print(f"[ERROR] Failed to initialize SlushEngine board: {e}")
                self.board = None
        else:
            self.board = None
            print("[INFO] Running in simulation mode (no SlushEngine)")
            
    def _init_motors(self):
        """Initialize pan and tilt motors"""
        if SLUSH_AVAILABLE and self.board:
            try:
                self.pan_motor = Slush.Motor(1)
                self.tilt_motor = Slush.Motor(2)
            except Exception as e:
                print(f"[ERROR] Failed to initialize motors: {e}")
                self.pan_motor = MockMotor(1)
                self.tilt_motor = MockMotor(2)
        else:
            self.pan_motor = MockMotor(1)
            self.tilt_motor = MockMotor(2)
            
        self._configure_motor(self.pan_motor, "PAN")
        self._configure_motor(self.tilt_motor, "TILT")
        
    def _configure_motor(self, motor, name):
        """Configure motor parameters"""
        motor.setCurrent(50, 70, 70, 70)
        motor.setMaxSpeed(800)
        motor.setAccel(500)
        motor.setDecel(500)
        motor.setMicroSteps(self.MICROSTEPS)
        print(f"[INFO] {name} motor configured")
        
    def degrees_to_steps(self, degrees):
        """Convert degrees to motor steps"""
        return int(degrees * self.STEPS_PER_DEGREE)
    
    def steps_to_degrees(self, steps):
        """Convert motor steps to degrees"""
        return steps / self.STEPS_PER_DEGREE
    
    def home(self):
        """
        Home both motors to center position (0°, 0°)
        
        NOTE: This implementation assumes the motors start in a known position.
        For production, you should add limit switches for proper homing.
        """
        print("[INFO] Homing camera pan/tilt system...")
        
        self.pan_motor.setHome()
        self.tilt_motor.setHome()
        
        self.current_pan_deg = 0.0
        self.current_tilt_deg = 0.0
        self.target_pan_deg = 0.0
        self.target_tilt_deg = 0.0
        
        self.is_homed = True
        print("[INFO] Homing complete - both axes at 0°")
        
    def set_pan(self, degrees):
        """
        Set pan angle (horizontal rotation)
        
        Args:
            degrees: Target angle in degrees (-180 to +180)
                    Positive = right, Negative = left
        """
        degrees = max(self.PAN_MIN_DEG, min(self.PAN_MAX_DEG, degrees))
        self.target_pan_deg = degrees
        
        steps = self.degrees_to_steps(degrees)
        self.pan_motor.goTo(steps)
        
        print(f"[PAN] Moving to {degrees:.1f}° ({steps} steps)")
        
    def set_tilt(self, degrees):
        """
        Set tilt angle (vertical rotation)
        
        Args:
            degrees: Target angle in degrees (-90 to +90)
                    Positive = up, Negative = down
        """
        degrees = max(self.TILT_MIN_DEG, min(self.TILT_MAX_DEG, degrees))
        self.target_tilt_deg = degrees
        
        steps = self.degrees_to_steps(degrees)
        self.tilt_motor.goTo(steps)
        
        print(f"[TILT] Moving to {degrees:.1f}° ({steps} steps)")
        
    def set_position(self, pan_deg, tilt_deg):
        """
        Set both pan and tilt angles simultaneously
        
        Args:
            pan_deg: Target pan angle (-180 to +180)
            tilt_deg: Target tilt angle (-90 to +90)
        """
        self.set_pan(pan_deg)
        self.set_tilt(tilt_deg)
        
    def move_relative_pan(self, delta_deg):
        """Move pan by relative amount"""
        new_pan = self.target_pan_deg + delta_deg
        self.set_pan(new_pan)
        
    def move_relative_tilt(self, delta_deg):
        """Move tilt by relative amount"""
        new_tilt = self.target_tilt_deg + delta_deg
        self.set_tilt(new_tilt)
        
    def get_position(self):
        """
        Get current position of both axes
        
        Returns:
            dict: Current pan and tilt angles in degrees
        """
        pan_steps = self.pan_motor.getPosition()
        tilt_steps = self.tilt_motor.getPosition()
        
        self.current_pan_deg = self.steps_to_degrees(pan_steps)
        self.current_tilt_deg = self.steps_to_degrees(tilt_steps)
        
        return {
            'pan': round(self.current_pan_deg, 2),
            'tilt': round(self.current_tilt_deg, 2),
            'pan_steps': pan_steps,
            'tilt_steps': tilt_steps,
            'is_homed': self.is_homed,
            'pan_busy': self.pan_motor.isBusy() if hasattr(self.pan_motor, 'isBusy') else False,
            'tilt_busy': self.tilt_motor.isBusy() if hasattr(self.tilt_motor, 'isBusy') else False
        }
        
    def stop(self):
        """Stop all motor movement"""
        self.pan_motor.softStop()
        self.tilt_motor.softStop()
        print("[INFO] All motors stopped")
        
    def release(self):
        """Release motors (disable holding torque)"""
        self.pan_motor.free()
        self.tilt_motor.free()
        print("[INFO] Motors released")
        
    def center(self):
        """Center the camera (pan=0, tilt=0)"""
        self.set_position(0, 0)
        print("[INFO] Centering camera")
        
    def wait_for_move(self):
        """Wait for both motors to complete their moves"""
        self.pan_motor.waitMove()
        self.tilt_motor.waitMove()
        
    def process_command(self, command):
        """
        Process incoming command from main controller or WebSocket
        
        Command format:
        {
            "type": "camera_control",
            "action": "set_position" | "relative" | "home" | "stop" | "center",
            "pan": float (degrees, optional),
            "tilt": float (degrees, optional)
        }
        """
        try:
            action = command.get('action', '')
            
            if action == 'set_position':
                pan = command.get('pan', self.target_pan_deg)
                tilt = command.get('tilt', self.target_tilt_deg)
                self.set_position(pan, tilt)
                
            elif action == 'relative':
                pan_delta = command.get('pan', 0)
                tilt_delta = command.get('tilt', 0)
                if pan_delta:
                    self.move_relative_pan(pan_delta)
                if tilt_delta:
                    self.move_relative_tilt(tilt_delta)
                    
            elif action == 'home':
                self.home()
                
            elif action == 'stop':
                self.stop()
                
            elif action == 'center':
                self.center()
                
            elif action == 'get_position':
                return self.get_position()
                
            else:
                print(f"[WARNING] Unknown action: {action}")
                
            return {'status': 'ok', 'position': self.get_position()}
            
        except Exception as e:
            print(f"[ERROR] Command processing failed: {e}")
            return {'status': 'error', 'message': str(e)}


class CameraPanTiltServer:
    """
    TCP server for camera pan/tilt control (port 5002)
    
    Receives JSON commands from the main rover controller over TCP.
    Commands are newline-delimited JSON objects.
    
    Example client connection (from Mini PC):
        import socket
        import json
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('raspberry-pi-ip', 5002))
        
        # Send command
        cmd = {'action': 'set_position', 'pan': 45.0, 'tilt': -15.0}
        sock.send((json.dumps(cmd) + '\\n').encode())
        
        # Receive response
        response = sock.recv(4096).decode()
        print(json.loads(response))
    """
    
    def __init__(self, host='0.0.0.0', port=5002):
        self.host = host
        self.port = port
        self.controller = CameraPanTiltController()
        self.running = False
        self.server_socket = None
        
    def start(self):
        """Start the camera control server"""
        self.running = True
        self.controller.home()
        
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        
        print(f"[SERVER] Camera Pan/Tilt server listening on {self.host}:{self.port}")
        
        position_thread = threading.Thread(target=self._position_broadcast_loop, daemon=True)
        position_thread.start()
        
        try:
            while self.running:
                try:
                    client_socket, address = self.server_socket.accept()
                    print(f"[SERVER] Client connected: {address}")
                    
                    client_thread = threading.Thread(
                        target=self._handle_client,
                        args=(client_socket, address),
                        daemon=True
                    )
                    client_thread.start()
                    
                except socket.timeout:
                    continue
                    
        except KeyboardInterrupt:
            print("\n[SERVER] Shutting down...")
        finally:
            self.stop()
            
    def _handle_client(self, client_socket, address):
        """Handle client connection"""
        client_socket.settimeout(1.0)
        
        try:
            buffer = ""
            while self.running:
                try:
                    data = client_socket.recv(4096).decode('utf-8')
                    if not data:
                        break
                        
                    buffer += data
                    
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        if line.strip():
                            try:
                                command = json.loads(line)
                                response = self.controller.process_command(command)
                                response_json = json.dumps(response) + '\n'
                                client_socket.send(response_json.encode('utf-8'))
                            except json.JSONDecodeError:
                                print(f"[WARNING] Invalid JSON: {line}")
                                
                except socket.timeout:
                    continue
                    
        except Exception as e:
            print(f"[ERROR] Client handler error: {e}")
        finally:
            client_socket.close()
            print(f"[SERVER] Client disconnected: {address}")
            
    def _position_broadcast_loop(self):
        """Periodically log current position (for debugging)"""
        while self.running:
            time.sleep(1.0)
            pos = self.controller.get_position()
            
    def stop(self):
        """Stop the server"""
        self.running = False
        self.controller.stop()
        self.controller.release()
        
        if self.server_socket:
            self.server_socket.close()
            
        print("[SERVER] Server stopped")


def main():
    """Main entry point"""
    print("=" * 60)
    print("  RoverOS Camera Pan/Tilt Controller")
    print("  SlushEngine Model X LT + Raspberry Pi 3 B+")
    print("=" * 60)
    print()
    
    server = CameraPanTiltServer(host='0.0.0.0', port=5002)
    
    try:
        server.start()
    except KeyboardInterrupt:
        print("\n[MAIN] Interrupt received")
    finally:
        server.stop()


if __name__ == '__main__':
    main()
