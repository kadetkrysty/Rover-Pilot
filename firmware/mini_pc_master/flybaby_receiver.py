"""
FlyBaby FS-I6x Receiver Integration for Raspberry Pi
Reads PWM signals from FS-IA10B receiver via GPIO
Provides REST API for web dashboard
"""

import time
import RPi.GPIO as GPIO
import threading
from collections import deque

class FlyBabyReceiver:
    """Reads FlyBaby FS-I6x / FS-IA10B receiver PWM channels"""
    
    def __init__(self):
        """
        GPIO Pin Mapping (BCM):
        CH1 (Roll/Aileron)  → GPIO 17
        CH2 (Pitch/Elevator) → GPIO 27
        CH3 (Throttle)      → GPIO 22
        CH4 (Yaw/Rudder)    → GPIO 23
        CH5 (Switch A)      → GPIO 24
        CH6 (Switch B)      → GPIO 25
        """
        self.GPIO_PINS = {
            1: 17,
            2: 27,
            3: 22,
            4: 23,
            5: 24,
            6: 25,
        }
        
        self.channels = {i: 0 for i in range(1, 7)}
        self.pulse_starts = {i: 0 for i in range(1, 7)}
        self.signal_strength = 0
        self.failsafe_active = False
        self.last_update_time = 0
        self.frame_rate = 0
        self.update_count = 0
        
        self.running = False
        self.lock = threading.Lock()
        
        # History for signal strength calculation
        self.update_history = deque(maxlen=50)
        
    def setup(self):
        """Initialize GPIO pins for PWM reading"""
        GPIO.setmode(GPIO.BCM)
        
        for ch, pin in self.GPIO_PINS.items():
            GPIO.setup(pin, GPIO.IN)
            # Add event detection for rising and falling edges
            GPIO.add_event_detect(pin, GPIO.BOTH, callback=self._edge_callback)
    
    def _edge_callback(self, channel):
        """Callback for GPIO edge detection"""
        # Get which channel this GPIO corresponds to
        ch = None
        for channel_num, pin in self.GPIO_PINS.items():
            if pin == channel:
                ch = channel_num
                break
        
        if ch is None:
            return
        
        current_time = time.time()
        
        if GPIO.input(channel):  # Rising edge (pulse start)
            self.pulse_starts[ch] = current_time
        else:  # Falling edge (pulse end)
            pulse_duration = (current_time - self.pulse_starts[ch]) * 1000000  # Convert to microseconds
            
            # Valid PWM range is 1000-2000 microseconds
            if 900 < pulse_duration < 2100:
                with self.lock:
                    self.channels[ch] = pulse_duration
                    self.last_update_time = current_time
                    self.update_count += 1
                    self.update_history.append(current_time)
    
    def get_channels(self):
        """Get current channel values (PWM in microseconds)"""
        with self.lock:
            return self.channels.copy()
    
    def get_signal_strength(self):
        """
        Calculate signal strength based on update frequency
        100% = perfect 50Hz signal (20ms updates)
        """
        if len(self.update_history) < 2:
            return 0
        
        # Calculate time between updates
        times = list(self.update_history)
        intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
        
        if not intervals:
            return 0
        
        avg_interval = sum(intervals) / len(intervals)
        expected_interval = 0.02  # 50Hz = 20ms
        
        # If signal is lost for more than 1 second, return 0
        if time.time() - self.last_update_time > 1.0:
            self.failsafe_active = True
            return 0
        
        self.failsafe_active = False
        
        # Calculate strength as percentage
        strength = (expected_interval / avg_interval) * 100
        return max(0, min(100, strength))  # Clamp to 0-100
    
    def get_frame_rate(self):
        """Calculate current frame rate in Hz"""
        if len(self.update_history) < 2:
            return 0
        
        time_span = self.update_history[-1] - self.update_history[0]
        if time_span == 0:
            return 0
        
        frame_rate = (len(self.update_history) - 1) / time_span
        return frame_rate
    
    def get_status(self):
        """Get complete receiver status"""
        channels = self.get_channels()
        
        # Check if any channel has been updated recently
        is_connected = time.time() - self.last_update_time < 1.0
        
        return {
            'connected': is_connected,
            'channel1': channels[1],
            'channel2': channels[2],
            'channel3': channels[3],
            'channel4': channels[4],
            'channel5': channels[5],
            'channel6': channels[6],
            'signalStrength': self.get_signal_strength(),
            'failsafe': self.failsafe_active,
            'frameRate': self.get_frame_rate(),
            'lastUpdate': time.time(),
        }
    
    def cleanup(self):
        """Clean up GPIO"""
        GPIO.cleanup()


# Global receiver instance
receiver = None

def initialize_flybaby():
    """Initialize FlyBaby receiver"""
    global receiver
    try:
        receiver = FlyBabyReceiver()
        receiver.setup()
        print("[OK] FlyBaby FS-I6x receiver initialized")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to initialize FlyBaby receiver: {e}")
        print("[WARN] Continuing without FlyBaby support")
        receiver = None
        return False


# API Integration (add to rover_controller.py)
"""
To integrate with rover_controller.py, add:

from flybaby_receiver import initialize_flybaby, receiver

# In __init__:
initialize_flybaby()

# Add route:
@app.route('/api/flybaby/input', methods=['GET'])
def get_flybaby_input():
    if receiver is None:
        return jsonify({'connected': False}), 503
    
    return jsonify(receiver.get_status())

# In main loop (optional - send control commands):
@app.route('/api/flybaby/control', methods=['POST'])
def flybaby_control():
    if receiver is None:
        return jsonify({'error': 'FlyBaby not available'}), 503
    
    data = request.json
    status = receiver.get_status()
    
    # Convert PWM to rover control
    throttle = (status['channel3'] - 1000) / 1000 * 100  # 0-100%
    steering = (status['channel1'] - 1500) / 500 * 100   # -100 to 100
    
    # Send to rover
    drive_rover(throttle, steering)
    
    return jsonify({'status': 'ok', 'throttle': throttle, 'steering': steering})
"""
