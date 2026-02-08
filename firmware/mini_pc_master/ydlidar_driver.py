#!/usr/bin/env python3
"""
================================================================================
YDLIDAR T-mini Plus Driver
================================================================================
360-degree scanning LIDAR driver for RoverOS
Parses raw serial data from YDLIDAR T-mini Plus sensor
================================================================================
"""

import serial
import struct
import threading
import time
import math
import os
import subprocess
import glob as glob_module
import fcntl
from dataclasses import dataclass
from typing import List, Optional, Callable

@dataclass
class LidarPoint:
    angle: float      # Degrees (0-360)
    distance: float   # Millimeters
    intensity: int    # Signal strength

@dataclass
class LidarScan:
    timestamp: float
    points: List[LidarPoint]
    scan_frequency: float

class YDLidarDriver:
    """Driver for YDLIDAR T-mini Plus 360-degree LIDAR"""
    
    def __init__(self, port: str = '/dev/ttyUSB1', baudrate: int = 230400):
        self.port = port
        self.baudrate = baudrate
        self.serial: Optional[serial.Serial] = None
        self.running = False
        self.connected = False
        
        self.current_scan: List[LidarPoint] = []
        self.last_complete_scan: Optional[LidarScan] = None
        self.scan_callback: Optional[Callable[[LidarScan], None]] = None
        
        self.scan_start_time = time.time()
        self.scans_per_second = 0
        self.scan_count = 0
        self.last_scan_count_time = time.time()
        
        self._lock = threading.Lock()
        self._read_thread: Optional[threading.Thread] = None
        self._last_valid_scan_time = time.time()
        self._consecutive_empty_reads = 0
        self._max_recovery_attempts = 6
        
    def connect(self) -> bool:
        """Connect to LIDAR sensor"""
        try:
            self.serial = serial.Serial(
                self.port, 
                self.baudrate, 
                timeout=1
            )
            
            # Enable DTR for data transmission (required for T-mini Plus)
            self.serial.dtr = True
            self.serial.rts = False
            time.sleep(0.2)
            
            # Flush any stale data
            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()
            
            # Send stop command first (in case it was running)
            self.serial.write(b'\xA5\x65')
            time.sleep(0.2)
            self.serial.reset_input_buffer()
            
            # Send start scan command
            self.serial.write(b'\xA5\x60')
            time.sleep(1.0)  # Wait for LIDAR to spin up and start sending data
            
            # Check if data is coming
            bytes_waiting = self.serial.in_waiting
            print(f"[LIDAR] Initial bytes waiting: {bytes_waiting}")
            
            self.connected = True
            self.running = True
            
            self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
            self._read_thread.start()
            
            print(f"[LIDAR] Connected to YDLIDAR on {self.port}")
            return True
            
        except Exception as e:
            print(f"[LIDAR] Connection failed: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from LIDAR"""
        self.running = False
        if self.serial and self.serial.is_open:
            try:
                self.serial.write(b'\xA5\x65')
                time.sleep(0.1)
                self.serial.close()
            except:
                pass
        self.connected = False
        print("[LIDAR] Disconnected")
    
    def _find_usb_device_path(self) -> Optional[str]:
        """Find the sysfs path for the USB device behind this serial port"""
        try:
            port_name = os.path.basename(self.port)
            sysfs_path = f"/sys/class/tty/{port_name}/device"
            if not os.path.exists(sysfs_path):
                return None
            real_path = os.path.realpath(sysfs_path)
            usb_path = real_path
            while usb_path and usb_path != '/':
                authorize_file = os.path.join(usb_path, 'authorized')
                if os.path.exists(authorize_file):
                    return usb_path
                usb_path = os.path.dirname(usb_path)
            return None
        except Exception as e:
            print(f"[LIDAR] Could not find USB device path: {e}")
            return None
    
    def _usb_reset(self) -> bool:
        """Perform a USB device reset - simulates physical unplug/replug"""
        try:
            usb_path = self._find_usb_device_path()
            if usb_path:
                authorize_file = os.path.join(usb_path, 'authorized')
                print(f"[LIDAR] USB reset via sysfs: {authorize_file}")
                if self.serial and self.serial.is_open:
                    try:
                        self.serial.close()
                    except:
                        pass
                with open(authorize_file, 'w') as f:
                    f.write('0')
                time.sleep(2.0)
                with open(authorize_file, 'w') as f:
                    f.write('1')
                time.sleep(3.0)
                return True
            
            try:
                port_name = os.path.basename(self.port)
                sysfs_path = f"/sys/class/tty/{port_name}/device"
                real_path = os.path.realpath(sysfs_path)
                
                usb_dev = real_path
                while usb_dev:
                    busnum_path = os.path.join(usb_dev, 'busnum')
                    devnum_path = os.path.join(usb_dev, 'devnum')
                    if os.path.exists(busnum_path) and os.path.exists(devnum_path):
                        with open(busnum_path) as f:
                            busnum = int(f.read().strip())
                        with open(devnum_path) as f:
                            devnum = int(f.read().strip())
                        dev_path = f"/dev/bus/usb/{busnum:03d}/{devnum:03d}"
                        if os.path.exists(dev_path):
                            print(f"[LIDAR] USB reset via ioctl: {dev_path}")
                            if self.serial and self.serial.is_open:
                                try:
                                    self.serial.close()
                                except:
                                    pass
                            USBDEVFS_RESET = 21780
                            fd = os.open(dev_path, os.O_WRONLY)
                            fcntl.ioctl(fd, USBDEVFS_RESET, 0)
                            os.close(fd)
                            time.sleep(3.0)
                            return True
                    usb_dev = os.path.dirname(usb_dev)
                    if usb_dev == '/sys' or usb_dev == '/':
                        break
            except Exception as e:
                print(f"[LIDAR] ioctl USB reset failed: {e}")
            
            return False
        except Exception as e:
            print(f"[LIDAR] USB reset failed: {e}")
            return False
    
    def _verify_scan_data(self, timeout: float = 5.0) -> int:
        """Read from serial and count valid scan points"""
        valid_points = 0
        check_start = time.time()
        temp_buffer = b''
        while time.time() - check_start < timeout:
            try:
                chunk = self.serial.read(512)
            except:
                break
            if not chunk:
                continue
            temp_buffer += chunk
            while len(temp_buffer) >= 10:
                idx = temp_buffer.find(b'\xaa\x55')
                if idx == -1:
                    temp_buffer = temp_buffer[-1:]
                    break
                if idx > 0:
                    temp_buffer = temp_buffer[idx:]
                if len(temp_buffer) < 10:
                    break
                lsn = temp_buffer[3]
                packet_len = 10 + lsn * 3
                if len(temp_buffer) < packet_len:
                    break
                for i in range(lsn):
                    offset = 10 + i * 3
                    if offset + 2 <= len(temp_buffer):
                        dist = struct.unpack('<H', temp_buffer[offset:offset+2])[0]
                        if 10 < dist < 12000:
                            valid_points += 1
                temp_buffer = temp_buffer[packet_len:]
            if valid_points > 10:
                break
        return valid_points

    def _check_device_health(self) -> bool:
        """Send health status command (A5 92) to check if LIDAR is responsive"""
        try:
            if not self.serial or not self.serial.is_open:
                return False
            self.serial.reset_input_buffer()
            self.serial.write(b'\xA5\x92')
            time.sleep(0.5)
            response = self.serial.read(self.serial.in_waiting or 64)
            if response and b'\xA5\x5A' in response:
                print(f"[LIDAR] Health check OK - device responsive ({len(response)} bytes)")
                return True
            print(f"[LIDAR] Health check - no valid response ({len(response)} bytes)")
            return False
        except Exception as e:
            print(f"[LIDAR] Health check failed: {e}")
            return False
    
    def _restart_scanning(self, attempt: int) -> bool:
        """Restart LIDAR scanning - escalating recovery using YDLIDAR SDK commands"""
        try:
            if attempt <= 2:
                print(f"[LIDAR] Strategy 1: Stop (A5 65) → wait → Start (A5 60)...")
                if not self.serial or not self.serial.is_open:
                    return False
                self.serial.write(b'\xA5\x65')
                time.sleep(2.0)
                self.serial.reset_input_buffer()
                self.serial.reset_output_buffer()
                self._check_device_health()
                self.serial.reset_input_buffer()
                self.serial.write(b'\xA5\x60')
                time.sleep(3.0)
            elif attempt <= 4:
                print(f"[LIDAR] Strategy 2: Soft reboot (A5 40) → reconnect...")
                if self.serial and self.serial.is_open:
                    try:
                        self.serial.write(b'\xA5\x65')
                        time.sleep(0.5)
                        self.serial.write(b'\xA5\x40')
                        time.sleep(0.5)
                        self.serial.close()
                    except:
                        pass
                time.sleep(4.0)
                
                port = self.port
                baudrate = self.baudrate
                self.serial = serial.Serial(port, baudrate, timeout=1)
                self.serial.dtr = True
                self.serial.rts = False
                time.sleep(1.0)
                self.serial.reset_input_buffer()
                
                if self._check_device_health():
                    print(f"[LIDAR] Device responded after reboot")
                else:
                    print(f"[LIDAR] Device not responding after reboot, sending start anyway...")
                
                self.serial.reset_input_buffer()
                self.serial.write(b'\xA5\x60')
                time.sleep(3.0)
            else:
                print(f"[LIDAR] Strategy 3: USB device reset (simulated unplug/replug)...")
                port = self.port
                baudrate = self.baudrate
                if self.serial and self.serial.is_open:
                    try:
                        self.serial.write(b'\xA5\x65')
                        time.sleep(0.3)
                        self.serial.close()
                    except:
                        pass
                
                if self._usb_reset():
                    if not os.path.exists(port):
                        print(f"[LIDAR] Waiting for {port} to reappear...")
                        for _ in range(10):
                            time.sleep(1.0)
                            if os.path.exists(port):
                                break
                    if not os.path.exists(port):
                        tty_ports = glob_module.glob('/dev/ttyUSB*')
                        print(f"[LIDAR] Available ports after reset: {tty_ports}")
                        if tty_ports:
                            port = tty_ports[0]
                            self.port = port
                            print(f"[LIDAR] Using port: {port}")
                        else:
                            print(f"[LIDAR] No serial ports found after USB reset")
                            return False
                else:
                    print(f"[LIDAR] USB reset not available, doing full serial reopen...")
                    time.sleep(3.0)
                
                self.serial = serial.Serial(port, baudrate, timeout=1)
                self.serial.dtr = True
                self.serial.rts = False
                time.sleep(1.0)
                self.serial.reset_input_buffer()
                self.serial.reset_output_buffer()
                self.serial.write(b'\xA5\x60')
                time.sleep(3.0)
            
            valid_points = self._verify_scan_data(5.0)
            print(f"[LIDAR] Recovery check: {valid_points} valid points detected")
            
            if valid_points > 10:
                self.serial.reset_input_buffer()
                self._consecutive_empty_reads = 0
                self._last_valid_scan_time = time.time()
                return True
            
            return False
            
        except Exception as e:
            print(f"[LIDAR] Recovery failed: {e}")
            return False
    
    def _read_loop(self):
        """Background thread to read and parse LIDAR data"""
        buffer = b''
        last_end_angle = 0
        read_count = 0
        recovery_attempts = 0
        
        while self.running:
            try:
                if not self.running:
                    break
                if not self.serial or not self.serial.is_open:
                    time.sleep(0.1)
                    continue
                
                time_since_last_scan = time.time() - self._last_valid_scan_time
                if time_since_last_scan > 5.0 and recovery_attempts < self._max_recovery_attempts:
                    recovery_attempts += 1
                    print(f"[LIDAR] No valid scans for {time_since_last_scan:.0f}s - recovery attempt {recovery_attempts}/{self._max_recovery_attempts}")
                    if self._restart_scanning(recovery_attempts):
                        buffer = b''
                        last_end_angle = 0
                        recovery_attempts = 0
                        print(f"[LIDAR] Recovery successful - valid scan data confirmed")
                    else:
                        print(f"[LIDAR] Recovery attempt {recovery_attempts} failed - no valid scan points")
                        time.sleep(2.0)
                    continue
                elif time_since_last_scan > 5.0 and recovery_attempts >= self._max_recovery_attempts:
                    print(f"[LIDAR] All {self._max_recovery_attempts} recovery attempts failed. Waiting 30s before retrying...")
                    time.sleep(30.0)
                    recovery_attempts = 0
                    continue
                
                try:
                    chunk = self.serial.read(256)
                except (OSError, TypeError):
                    break
                if not chunk:
                    self._consecutive_empty_reads += 1
                    if self._consecutive_empty_reads > 50:
                        self._last_valid_scan_time = 0
                        self._consecutive_empty_reads = 0
                    continue
                
                self._consecutive_empty_reads = 0
                
                read_count += 1
                if read_count % 100 == 1:
                    print(f"[LIDAR] Read {len(chunk)} bytes, buffer size: {len(buffer)}, total points: {len(self.current_scan)}")
                    
                buffer += chunk
                
                while len(buffer) >= 10:
                    idx = buffer.find(b'\xaa\x55')
                    if idx == -1:
                        buffer = buffer[-1:] if buffer else b''
                        break
                    if idx > 0:
                        buffer = buffer[idx:]
                    if len(buffer) < 10:
                        break
                    
                    ct = buffer[2]
                    lsn = buffer[3]
                    fsa = struct.unpack('<H', buffer[4:6])[0]
                    lsa = struct.unpack('<H', buffer[6:8])[0]
                    cs = struct.unpack('<H', buffer[8:10])[0]
                    
                    packet_len = 10 + lsn * 3
                    if len(buffer) < packet_len:
                        break
                    
                    expected_cs = 0x55AA ^ (ct | (lsn << 8)) ^ fsa ^ lsa
                    for i in range(lsn):
                        offset = 10 + i * 3
                        if offset + 2 <= len(buffer):
                            sample = struct.unpack('<H', buffer[offset:offset+2])[0]
                            expected_cs ^= sample
                    
                    if cs != expected_cs:
                        buffer = buffer[2:]
                        continue
                    
                    start_angle = (fsa >> 1) / 64.0
                    end_angle = (lsa >> 1) / 64.0
                    
                    if lsn > 1:
                        if end_angle < start_angle:
                            angle_diff = (360 - start_angle) + end_angle
                        else:
                            angle_diff = end_angle - start_angle
                        angle_step = angle_diff / (lsn - 1) if lsn > 1 else 0
                    else:
                        angle_step = 0
                    
                    points = []
                    for i in range(lsn):
                        offset = 10 + i * 3
                        if offset + 2 <= len(buffer):
                            dist = struct.unpack('<H', buffer[offset:offset+2])[0]
                            intensity = buffer[offset+2] if offset + 2 < len(buffer) else 0
                            
                            angle = start_angle + i * angle_step
                            if angle >= 360:
                                angle -= 360
                            
                            if dist > 0 and dist < 12000:
                                points.append(LidarPoint(
                                    angle=angle,
                                    distance=dist,
                                    intensity=intensity
                                ))
                    
                    with self._lock:
                        self.current_scan.extend(points)
                        
                        # Complete scan on angle wrap-around OR time-based (every ~0.2s)
                        should_complete = False
                        if end_angle < last_end_angle and end_angle < 90 and last_end_angle > 270:
                            should_complete = True
                        elif len(self.current_scan) >= 50 and (time.time() - self.scan_start_time) > 0.2:
                            should_complete = True
                    
                    if should_complete:
                        self._complete_scan()
                    
                    last_end_angle = end_angle
                    buffer = buffer[packet_len:]
                    
            except Exception as e:
                print(f"[LIDAR] Read error: {e}")
                time.sleep(0.1)
    
    def _complete_scan(self):
        """Called when a full 360-degree scan is complete"""
        with self._lock:
            if len(self.current_scan) > 10:
                now = time.time()
                scan_time = now - self.scan_start_time
                
                scan = LidarScan(
                    timestamp=now,
                    points=self.current_scan.copy(),
                    scan_frequency=1.0 / scan_time if scan_time > 0 else 0
                )
                
                self.last_complete_scan = scan
                self._last_valid_scan_time = now
                self._consecutive_empty_reads = 0
                print(f"[LIDAR] Complete scan: {len(scan.points)} points, {scan.scan_frequency:.1f} Hz")
                
                if self.scan_callback:
                    try:
                        self.scan_callback(scan)
                    except Exception as e:
                        print(f"[LIDAR] Callback error: {e}")
                
                self.scan_count += 1
                if now - self.last_scan_count_time >= 1.0:
                    self.scans_per_second = self.scan_count
                    self.scan_count = 0
                    self.last_scan_count_time = now
            
            self.current_scan = []
            self.scan_start_time = time.time()
    
    def get_latest_scan(self) -> Optional[LidarScan]:
        """Get the most recent complete scan"""
        with self._lock:
            return self.last_complete_scan
    
    def get_scan_dict(self) -> dict:
        """Get scan data as dictionary for JSON serialization"""
        scan = self.get_latest_scan()
        if not scan:
            return {
                'connected': self.connected,
                'points': [],
                'count': 0,
                'frequency': 0,
                'timestamp': 0
            }
        
        points = [
            {
                'angle': round(p.angle, 1),
                'distance': p.distance,
                'intensity': p.intensity
            }
            for p in scan.points
        ]
        
        return {
            'connected': self.connected,
            'points': points,
            'count': len(points),
            'frequency': round(scan.scan_frequency, 1),
            'timestamp': int(scan.timestamp * 1000)
        }
    
    def get_obstacles_in_range(self, min_angle: float = 0, max_angle: float = 360, 
                               max_distance: float = 2000) -> List[LidarPoint]:
        """Get obstacles within angle range and distance threshold"""
        scan = self.get_latest_scan()
        if not scan:
            return []
        
        obstacles = []
        for point in scan.points:
            if min_angle <= point.angle <= max_angle and point.distance <= max_distance:
                obstacles.append(point)
        
        return obstacles
    
    def get_closest_obstacle(self) -> Optional[LidarPoint]:
        """Get the closest detected obstacle"""
        scan = self.get_latest_scan()
        if not scan or not scan.points:
            return None
        
        return min(scan.points, key=lambda p: p.distance)
    
    def get_sector_distances(self, num_sectors: int = 8) -> List[dict]:
        """Get minimum distance for each angular sector"""
        scan = self.get_latest_scan()
        if not scan:
            return []
        
        sector_size = 360 / num_sectors
        sectors = []
        
        for i in range(num_sectors):
            start_angle = i * sector_size
            end_angle = (i + 1) * sector_size
            
            sector_points = [
                p for p in scan.points 
                if start_angle <= p.angle < end_angle
            ]
            
            if sector_points:
                min_point = min(sector_points, key=lambda p: p.distance)
                avg_dist = sum(p.distance for p in sector_points) / len(sector_points)
                sectors.append({
                    'sector': i,
                    'start_angle': start_angle,
                    'end_angle': end_angle,
                    'min_distance': min_point.distance,
                    'avg_distance': avg_dist,
                    'point_count': len(sector_points)
                })
            else:
                sectors.append({
                    'sector': i,
                    'start_angle': start_angle,
                    'end_angle': end_angle,
                    'min_distance': 12000,
                    'avg_distance': 12000,
                    'point_count': 0
                })
        
        return sectors
    
    def set_scan_callback(self, callback: Callable[[LidarScan], None]):
        """Set callback function called on each complete scan"""
        self.scan_callback = callback


def find_lidar_port() -> Optional[str]:
    """Auto-detect YDLIDAR port (CP2102 chip)"""
    import serial.tools.list_ports
    
    ports = list(serial.tools.list_ports.comports())
    
    # YDLIDAR uses CP2102 chip - look for it specifically
    for port in ports:
        port_info = f"{port.description} {port.manufacturer or ''}".lower()
        if 'cp210' in port_info or 'cp2102' in port_info:
            print(f"[LIDAR] Found CP2102 on {port.device}")
            return port.device
    
    # Fallback: try ttyUSB1 (usually LIDAR when Arduino is on ttyUSB0)
    for path in ['/dev/ttyUSB1', '/dev/ttyUSB2']:
        try:
            test = serial.Serial(path, 230400, timeout=0.1)
            test.close()
            return path
        except:
            continue
    
    return None


if __name__ == '__main__':
    port = find_lidar_port() or '/dev/ttyUSB1'
    print(f"Testing YDLIDAR on {port}")
    
    lidar = YDLidarDriver(port)
    
    def on_scan(scan: LidarScan):
        closest = min(scan.points, key=lambda p: p.distance) if scan.points else None
        if closest:
            print(f"Scan: {len(scan.points)} points, closest: {closest.distance}mm @ {closest.angle:.1f}°")
    
    lidar.set_scan_callback(on_scan)
    
    if lidar.connect():
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping...")
    
    lidar.disconnect()
