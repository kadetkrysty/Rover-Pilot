"""
================================================================================
FlySky FS-IA10B iBUS Receiver Interface
================================================================================
NOTE: With the Mini PC migration, the FlySky receiver now connects directly
to Arduino Mega via iBUS protocol (single-wire serial).

This module provides a compatibility layer that reads iBUS data from the
Arduino's telemetry stream rather than GPIO pins.

The Arduino handles:
- iBUS protocol decoding at 115200 baud
- Reading all 10 channels at ~143Hz
- Sending channel data in JSON telemetry to Mini PC

This module is kept for API compatibility with existing code.
================================================================================
"""

import time
import threading
from collections import deque


class FlySkyReceiver:
    """
    FlySky FS-IA10B receiver interface via Arduino iBUS.
    
    Hardware Connection:
    - FlySky FS-IA10B iBUS pin → Arduino Mega Pin 19 (RX1)
    - Receiver VCC → Arduino 5V
    - Receiver GND → Arduino GND
    
    The Arduino reads iBUS at 115200 baud using the IBusBM library
    and forwards channel values in the telemetry JSON stream.
    """
    
    # Channel assignments for FlySky FS-I6x transmitter
    CHANNEL_NAMES = {
        1: 'Roll/Aileron',      # Right stick horizontal
        2: 'Pitch/Elevator',    # Right stick vertical
        3: 'Throttle',          # Left stick vertical
        4: 'Yaw/Rudder',        # Left stick horizontal
        5: 'Switch A (SwA)',    # 2-position switch
        6: 'Switch B (SwB)',    # 2-position switch
        7: 'Switch C (SwC)',    # 3-position switch
        8: 'Switch D (SwD)',    # 2-position switch
        9: 'VrA Dial',          # Variable dial A
        10: 'VrB Dial',         # Variable dial B
    }
    
    def __init__(self):
        """Initialize receiver state"""
        self.channels = {i: 1500 for i in range(1, 11)}  # 10 channels
        self.connected = False
        self.frame_rate = 0
        self.last_update = 0
        self.signal_strength = 0
        self.failsafe_active = False
        self.lock = threading.Lock()
        self.update_history = deque(maxlen=50)
    
    def update_from_arduino(self, ibus_data):
        """
        Update channel values from Arduino telemetry.
        
        Args:
            ibus_data: dict with 'con' (connected) and 'ch' (channel array)
        """
        with self.lock:
            self.connected = ibus_data.get('con', False)
            channels = ibus_data.get('ch', [])
            
            for i, value in enumerate(channels):
                if i < 10:
                    self.channels[i + 1] = value
            
            self.last_update = time.time()
            self.update_history.append(self.last_update)
            
            # Check for failsafe
            if not self.connected or time.time() - self.last_update > 1.0:
                self.failsafe_active = True
            else:
                self.failsafe_active = False
    
    def get_channels(self):
        """Get current channel values (PWM: 1000-2000 microseconds)"""
        with self.lock:
            return self.channels.copy()
    
    def get_channel(self, ch):
        """Get single channel value"""
        with self.lock:
            return self.channels.get(ch, 1500)
    
    def get_normalized(self, ch):
        """Get channel value normalized to -1.0 to 1.0"""
        raw = self.get_channel(ch)
        return (raw - 1500) / 500.0
    
    def get_percent(self, ch):
        """Get channel value as 0-100 percentage"""
        raw = self.get_channel(ch)
        return (raw - 1000) / 10.0
    
    def get_signal_strength(self):
        """Calculate signal strength based on update frequency"""
        if len(self.update_history) < 2:
            return 0
        
        if time.time() - self.last_update > 1.0:
            return 0
        
        # Calculate from update intervals
        times = list(self.update_history)
        intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
        
        if not intervals:
            return 0
        
        avg_interval = sum(intervals) / len(intervals)
        expected = 0.007  # iBUS runs at ~143Hz (7ms)
        
        strength = (expected / max(avg_interval, 0.001)) * 100
        return max(0, min(100, strength))
    
    def get_frame_rate(self):
        """Calculate frame rate in Hz"""
        if len(self.update_history) < 2:
            return 0
        
        time_span = self.update_history[-1] - self.update_history[0]
        if time_span <= 0:
            return 0
        
        return (len(self.update_history) - 1) / time_span
    
    def get_status(self):
        """Get complete receiver status dictionary"""
        channels = self.get_channels()
        
        return {
            'connected': self.connected,
            'protocol': 'iBUS',
            'receiver': 'FS-IA10B',
            'transmitter': 'FS-I6x',
            'channel1': channels[1],
            'channel2': channels[2],
            'channel3': channels[3],
            'channel4': channels[4],
            'channel5': channels[5],
            'channel6': channels[6],
            'channel7': channels[7],
            'channel8': channels[8],
            'channel9': channels[9],
            'channel10': channels[10],
            'signalStrength': self.get_signal_strength(),
            'failsafe': self.failsafe_active,
            'frameRate': self.get_frame_rate(),
            'lastUpdate': self.last_update,
        }
    
    def get_control_values(self):
        """
        Get mapped control values for rover driving.
        
        Returns:
            dict with throttle, steering, and switch states
        """
        channels = self.get_channels()
        
        # Convert PWM (1000-2000) to control values (-100 to 100)
        throttle = int((channels[3] - 1500) / 5)   # CH3
        steering = int((channels[1] - 1500) / 5)   # CH1
        
        # Switches (2-position: 1000=OFF, 2000=ON)
        switch_a = channels[5] > 1500
        switch_b = channels[6] > 1500
        
        # 3-position switch C
        if channels[7] < 1300:
            switch_c = 0
        elif channels[7] > 1700:
            switch_c = 2
        else:
            switch_c = 1
        
        switch_d = channels[8] > 1500
        
        return {
            'throttle': max(-100, min(100, throttle)),
            'steering': max(-100, min(100, steering)),
            'pitch': int((channels[2] - 1500) / 5),
            'yaw': int((channels[4] - 1500) / 5),
            'switchA': switch_a,
            'switchB': switch_b,
            'switchC': switch_c,
            'switchD': switch_d,
            'dialA': int((channels[9] - 1000) / 10),
            'dialB': int((channels[10] - 1000) / 10),
        }


# Global receiver instance
receiver = FlySkyReceiver()


def get_receiver():
    """Get the global receiver instance"""
    return receiver


def update_from_telemetry(ibus_data):
    """Update receiver from Arduino telemetry"""
    receiver.update_from_arduino(ibus_data)


# ===== WIRING DIAGRAM (iBUS) =====
"""
WIRING: FlySky FS-IA10B to Arduino Mega (iBUS Protocol)
========================================================

FS-IA10B Receiver          Arduino Mega 2560
-----------------          ------------------
iBUS (Servo/iBUS port) --> Pin 19 (RX1)
VCC (5V) ----------------> 5V
GND ---------------------> GND

Note: Only the iBUS pin needs to be connected for all 10 channels.
This is much simpler than PWM which would require 10 separate wires.

Arduino Library: IBusBM (install via Arduino Library Manager)
Baud Rate: 115200 (set by library)
Update Rate: ~143 Hz (7ms per frame)

The iBUS protocol provides:
- Digital signal (more accurate than PWM)
- All 10 channels on single wire
- Built-in failsafe detection
- Optional telemetry back to transmitter
"""
