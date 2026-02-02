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
        
    def connect(self) -> bool:
        """Connect to LIDAR sensor"""
        try:
            self.serial = serial.Serial(
                self.port, 
                self.baudrate, 
                timeout=1
            )
            time.sleep(0.5)
            
            # Enable DTR for data transmission (required for T-mini Plus)
            self.serial.dtr = True
            self.serial.rts = False
            time.sleep(0.1)
            
            # Send start scan command
            self.serial.write(b'\xA5\x60')
            time.sleep(0.5)
            
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
    
    def _read_loop(self):
        """Background thread to read and parse LIDAR data"""
        buffer = b''
        last_end_angle = 0
        read_count = 0
        
        while self.running:
            try:
                if not self.running:
                    break
                if not self.serial or not self.serial.is_open:
                    time.sleep(0.1)
                    continue
                
                try:
                    chunk = self.serial.read(256)
                except (OSError, TypeError):
                    break
                if not chunk:
                    continue
                
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
                        
                        # Complete scan on angle wrap-around OR time-based (every ~0.5s)
                        should_complete = False
                        if end_angle < last_end_angle and end_angle < 90 and last_end_angle > 270:
                            should_complete = True
                        elif len(self.current_scan) >= 200 and (time.time() - self.scan_start_time) > 0.1:
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
