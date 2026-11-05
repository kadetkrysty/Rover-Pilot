"""Exclusive, fail-closed drive authority. Standard-library only; no network listener."""
import math
import threading
import time
import uuid

SOURCES = ("joystick", "gamepad", "flysky")
MAX_COMMAND = 150  # Conservative commissioning limit: 15% of the FOC command range.


class ControlError(Exception):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status


def number(value, lower, upper):
    return type(value) in (int, float) and math.isfinite(value) and lower <= value <= upper


def axis(value):
    return 0.0 if abs(value) < 0.08 else max(-1.0, min(1.0, value))


class DriveAuthority:
    def __init__(self, writer, commissioned=False, clock=time.monotonic):
        self.write = writer
        self.clock = clock
        self.commissioned = commissioned
        self.lock = threading.RLock()
        self.source = "joystick"
        self.owner = None
        self.lease = None
        self.sequence = -1
        self.armed = False
        self.estop = False
        self.serial_connected = False
        self.firmware_ready = False
        self.last_telemetry = None
        self.ignore_telemetry_before = 0
        self.last_frame = 0
        self.last_emit = 0
        self.imu = None
        self.receiver = None
        self.throttle = self.steering = 0.0
        self.output_throttle = self.output_steering = 0.0
        self.reason = "Serial controller is not connected."

    def _send(self, command):
        try:
            self.write(command)
        except Exception:
            self.serial_connected = False
            self.firmware_ready = False
            self.armed = False
            self.lease = None
            self.throttle = self.steering = 0.0
            self.output_throttle = self.output_steering = 0.0
            self.reason = "Serial output failed; hardware watchdog must stop the controller."
            raise ControlError(self.reason, 503)

    def stop(self, reason="Stopped and disarmed.", send=True):
        with self.lock:
            self.armed = False
            self.lease = None
            self.throttle = self.steering = 0.0
            self.output_throttle = self.output_steering = 0.0
            self.reason = reason
            if send and self.serial_connected:
                self._send("STOP")

    def disconnected(self):
        with self.lock:
            self.stop("Arduino disconnected; control must be re-armed.", send=False)
            self.serial_connected = False
            self.firmware_ready = False
            self.last_telemetry = None
            self.imu = self.receiver = None

    def update(self, data, received_at=None):
        """Never infer readiness/IMU validity from missing, malformed or legacy telemetry."""
        with self.lock:
            if received_at is not None and received_at < self.ignore_telemetry_before:
                return
            control = data.get("control")
            if not isinstance(control, dict):
                return
            self.serial_connected = True
            self.firmware_ready = control.get("protocol") == 1 and control.get("watchdogMs") == 350
            self.last_telemetry = self.clock()
            if not self.armed and not self.estop:
                if not self.commissioned:
                    self.reason = "Hardware commissioning is required before arming."
                elif not self.firmware_ready:
                    self.reason = "Updated Arduino control firmware is required."
                elif self.reason == "Serial controller is not connected.":
                    self.reason = "Controller ready. Select a source and arm explicitly."
            if control.get("estop") is True:
                self.estop = True
                self.stop("Hardware E-STOP is latched.", send=False)
            if self.armed and control.get("armed") is False:
                self.stop("Arduino disarmed or its watchdog expired; explicit re-arming is required.")
            imu = data.get("imu")
            self.imu = None
            if isinstance(imu, dict) and imu.get("valid") is True and all(
                number(imu.get(key), -360, 360) for key in ("hdg", "pitch", "roll")
            ):
                self.imu = {"valid": True, "yaw": imu["hdg"], "pitch": imu["pitch"],
                            "roll": imu["roll"], "reference": "relative"}
            ibus = data.get("ibus")
            self.receiver = None
            if isinstance(ibus, dict):
                channels = ibus.get("ch")
                if isinstance(channels, list) and len(channels) == 10 and all(
                    type(value) is int and 800 <= value <= 2200 for value in channels
                ) and number(ibus.get("age"), 0, 1_000_000):
                    self.receiver = {"connected": ibus.get("con") is True, "channels": channels,
                                     "radioAge": ibus["age"]}
            if not self.firmware_ready and self.armed:
                self.stop("Unsupported Arduino firmware; update it before driving.")

    def _ready(self):
        if not self.commissioned:
            raise ControlError("Hardware commissioning is required before arming.")
        if not self.serial_connected or not self.firmware_ready:
            raise ControlError("Updated Arduino firmware and serial connection are required.", 503)
        if self.last_telemetry is None or self.clock() - self.last_telemetry > 0.3:
            raise ControlError("Arduino telemetry is stale.", 503)
        if self.estop:
            raise ControlError("E-STOP is latched; the owner must explicitly reset it.")

    def _radio(self):
        age = (self.clock() - self.last_telemetry) * 1000 if self.last_telemetry is not None else 1_000_000
        rx = self.receiver
        if not rx or not rx["connected"] or rx["radioAge"] + age > 250:
            raise ControlError("FlySky signal is missing or stale.")
        if rx["channels"][4] < 1700:
            raise ControlError("Hold FlySky CH5 high as the radio dead-man switch.")
        return axis((rx["channels"][2] - 1500) / 500), axis((rx["channels"][0] - 1500) / 500)

    def action(self, request):
        with self.lock:
            self.tick()
            owner = request.get("owner")
            if not isinstance(owner, str) or not 1 <= len(owner) <= 100:
                raise ControlError("Authenticated client identity is required.", 400)
            action = request.get("action")
            if action == "select":
                source = request.get("source")
                if source not in SOURCES:
                    raise ControlError("Invalid drive source.", 400)
                if self.armed and self.owner != owner:
                    raise ControlError("Another client has control. Stop before taking control.")
                self.stop("Source selected; neutral controls and explicit arming are required.")
                self.source, self.owner = source, owner
            elif action == "arm":
                self._ready()
                if self.armed:
                    raise ControlError("Already armed; stop before arming again.")
                if self.owner != owner or request.get("neutral") is not True:
                    raise ControlError("Select the source and return controls to neutral first.")
                if self.source == "flysky":
                    throttle, steering = self._radio()
                    if throttle or steering:
                        raise ControlError("FlySky CH1 and CH3 must be centered before arming.")
                # The serial transport waits for the matching firmware ARM acknowledgment.
                self._send("ARM")
                self.ignore_telemetry_before = self.clock()
                self.lease = str(uuid.uuid4())
                self.sequence = -1
                self.throttle = self.steering = 0
                self.armed = True
                self.last_frame = self.clock()
                self.reason = "Armed. Commands require this client's live dead-man heartbeat."
            elif action == "frame":
                self._ready()
                if not self.armed or owner != self.owner or request.get("lease") != self.lease or request.get("source") != self.source:
                    raise ControlError("Control lease is not active for this client/source.")
                seq = request.get("sequence")
                if type(seq) is not int or not self.sequence < seq <= 9_007_199_254_740_991:
                    raise ControlError("Stale or invalid command sequence.", 400)
                throttle, steering = request.get("throttle"), request.get("steering")
                if not number(throttle, -1, 1) or not number(steering, -1, 1):
                    raise ControlError("Drive inputs must be finite normalized numbers.", 400)
                if self.source == "flysky" and (throttle != 0 or steering != 0):
                    raise ControlError("Only the receiver supplies FlySky drive inputs.", 400)
                self.sequence = seq
                self.last_frame = self.clock()
                self.throttle, self.steering = axis(throttle), axis(steering)
            elif action == "stop":
                self.stop()
            elif action == "estop":
                self.estop = True
                self.stop("E-STOP latched.")
                if self.serial_connected:
                    self._send("ESTOP")
            elif action == "reset":
                if not self.serial_connected or not self.firmware_ready:
                    raise ControlError("Cannot confirm E-STOP reset while the Arduino is disconnected.", 503)
                self.stop("E-STOP reset; select and arm explicitly to drive.")
                self._send("RESET_STOP")
                self.ignore_telemetry_before = self.clock()
                self.estop = False
            else:
                raise ControlError("Unknown drive action.", 400)
            return self.status(owner)

    def tick(self):
        with self.lock:
            if not self.armed:
                return
            try:
                self._ready()
                if self.clock() - self.last_frame > 0.5:
                    raise ControlError("Client heartbeat expired; stopped and disarmed.")
                throttle, steering = self._radio() if self.source == "flysky" else (self.throttle, self.steering)
                if self.clock() - self.last_emit >= 0.05:
                    self._send(f"DRIVE:{round(throttle * MAX_COMMAND)},{round(steering * MAX_COMMAND)}")
                    self.output_throttle, self.output_steering = throttle, steering
                    self.last_emit = self.clock()
            except ControlError as error:
                self.stop(str(error))

    def status(self, owner):
        with self.lock:
            self.tick()
            age = max(0, (self.clock() - self.last_telemetry) * 1000) if self.last_telemetry is not None else 1_000_000
            imu = {**self.imu, "ageMs": age, "valid": age <= 300} if self.imu else None
            rx = None
            if self.receiver:
                radio_age = self.receiver["radioAge"] + age
                rx = {"connected": self.receiver["connected"] and radio_age <= 250,
                      "ageMs": radio_age, "channels": self.receiver["channels"],
                      "failsafe": radio_age > 250 or not self.receiver["connected"]}
            owned = self.owner == owner
            return {"available": True, "commissioned": self.commissioned,
                    "serialConnected": self.serial_connected, "firmwareReady": self.firmware_ready,
                    "source": self.source, "armed": self.armed, "estop": self.estop,
                    "owned": owned, "lease": self.lease if owned else None,
                    "reason": self.reason, "imu": imu, "receiver": rx,
                    "output": {"throttle": self.output_throttle if self.armed else 0,
                               "steering": self.output_steering if self.armed else 0}}
