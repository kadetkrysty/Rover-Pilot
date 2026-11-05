# RoverOS driving and MPU6050 setup

## Architecture and supported sources

Android and Windows remain clients. They do **not** open Arduino serial ports or
run a motor-control web server. The paired, certificate-pinned RoverOS Node API
on the MiniPC authorizes owners/operators and forwards validated drive requests
over `/run/roveros-control/control.sock`. This socket is private to the `roveros`
service account. The Python controller opens the explicitly configured Arduino
serial device. It uses only Python's standard library; no pip/venv is required.

The release installer installs `roveros-control.service`, and updates restart
it disarmed. The old `rover_controller.service` is disabled to avoid its
unauthenticated network commands, serial ownership and port-5000 conflict.
The new daemon opens **no TCP port**. Do not run the old controller manually.

**Selecting a page is not selecting a control source.** Use the shared Drive
Source panel on Dashboard, Gamepad or FlySky. Selection is MiniPC-owned and
shared between paired clients. Source changes stop and disarm first.
An operator cannot silently take over another client's armed lease; stop first.
Viewers cannot select, arm, move or stop. Owners can reset a latched E-STOP.
Autonomous driving is not offered as a source: it has no validated integration
with this manual-control authority yet.

| Source | Actual input and dead-man |
|---|---|
| Joystick | Hold the dashboard joystick; forward/backward is rover-relative throttle and left/right is steering. Release/cancel stops and disarms. Keyboard arrows are supported while focused. |
| Gamepad | Standard browser Gamepad mapping only. Left stick Y: forward/reverse; right stick X: steering. Hold R1 (right bumper) as dead-man. Release R1 or disconnect to stop/disarm. Center sticks and release R1 before ARM. |
| FlySky | Arduino Serial1 iBUS: CH1 steering, CH3 **centered/bidirectional** throttle, CH5 high (≥1700 µs) held as dead-man. Center CH1/CH3 before ARM with CH5 held high. Releasing CH5, stale packets or invalid input stops/disarms. |

FlySky is **not** autonomous of the authorizing app: the owning app must remain
visible and send its zero-valued authority heartbeat. The daemon reads the
actual radio channels; client-supplied radio motor values are rejected. No
client-local channel remapping changes this safety mapping. A spring-centered
throttle configuration is required; a normal uncentered aircraft throttle
must not be used with this mapping.

## Required Arduino update

Flash `firmware/arduino_mega_sensor_controller/arduino_mega_sensor_controller.ino`
**together with `feru_protocol.h` in the same sketch directory**, using Arduino
Mega 2560, AVR platform 1.8.6, IBusBM 1.1.4 and TinyGPSPlus 1.0.3. The host packet unit test is
kept separately under `firmware/tests`, outside the Arduino sketch directory.
The MiniPC server workflow also builds a `roveros-mega2560-firmware` HEX artifact
in GitHub Actions; flashing still requires the appropriate programmer/USB
connection and is not silently performed by a server update.

The updated sketch reports control protocol 1 and a 350 ms command watchdog.
Old firmware cannot arm. Old `MOVE:` commands no longer drive the motors.
The new protocol requires an acknowledged ARM and repeated `DRIVE:` frames.
STOP disarms; ESTOP also latches; RESET_STOP clears the latch without arming.
Both daemon and MCU cap speed and steering commands at ±150 (15% of the
nominal ±1000 FOC command range). This is a command cap, **not a measured speed
limit or proof that wheel torque is safe**.

The Feru packet is the official eight-byte little-endian structure:
`uint16 start=0xABCD, int16 steer, int16 speed, uint16 checksum`.
Checksum is `start XOR steer XOR speed`. Do not pre-mix left/right speeds:
Feru firmware performs its own configured mixing.
Reference: https://github.com/EFeru/hoverboard-firmware-hack-FOC/tree/main/Arduino/hoverserial

## Commissioning — required before enabling motion

Keep motor power disconnected until wiring checks are complete. Secure the
rover on supports with **all driven wheels clear of the ground**. Keep people,
clothing and tools away from wheels. Have a physically accessible motor-power
disconnect/emergency stop. Software E-STOP is **not** a safety-rated physical
emergency stop.

1. Verify the exact motor-board firmware/configuration is Feru FOC with the
   intended `CONTROL_SERIAL` UART, serial baud 115200, correct voltage levels,
   steering/mixing signs and command-loss timeout enabled. Refer to its
   documentation for the specific board and firmware revision. Never change
   wiring based only on the example pin numbers.
2. Flash the updated Arduino sketch. Install the new RoverOS MiniPC release.
   The controller initially has motion disabled and no serial device selected.
3. SSH to the MiniPC. Identify the Arduino **by identity**, not by whichever USB
   port appears first:
   ```sh
   ls -l /dev/serial/by-id/
   sudoedit /etc/roveros/hardware.env
   ```
   Set `ROVEROS_ARDUINO_DEVICE` to the Arduino's stable `/dev/serial/by-id/...`
   path. Leave `ROVEROS_DRIVE_COMMISSIONED=0` for the first checks.
   ```sh
   sudo systemctl restart roveros-control
   sudo systemctl status roveros-control --no-pager
   ```
4. Pair an owner client. On Dashboard confirm the controller and new Arduino
   firmware are recognized. Keep the rover stationary through IMU calibration
   (64 stationary samples, typically several seconds). Check roll/pitch and
   relative yaw against known physical movements. Incorrect mounting/axis signs
   must be corrected before interpreting orientation; the app does not assume
   an absolute-north reference.
5. For FlySky, configure receiver/transmitter failsafe with CH5 **low** and
   throttle/steering neutral. Test loss of transmitter power: some receivers
   continue sending valid iBUS failsafe frames, so packet freshness alone
   cannot identify RF loss. CH5's failsafe value must prevent motion.
6. With wheels raised, motor-board timeout configured and physical disconnect
   ready, explicitly set `ROVEROS_DRIVE_COMMISSIONED=1` in that root-owned file
   and restart `roveros-control`. This permits controlled bench tests; it is
   **not** a substitute for passing them.
7. Select one source, neutralize input, press ARM, and test very small movements.
   Verify actual forward/reverse and steering signs. Test stop on joystick
   release/cancel, R1 release, radio CH5 release, radio power loss, Wi-Fi loss,
   app blur/background/closure, serial unplug, controller service termination
   and source handover. Verify client A cannot drive client B's armed lease.
8. Test E-STOP from another paired operator and the physical power disconnect.
   Software E-STOP must remain latched until the owner resets it and deliberately
   re-arms. Reset must never move wheels. Reconnects/restarts must not resume.
   If **any** check fails, disconnect motor power and set commissioning back to
   `0`; do not use the rover on the ground.

## Watchdogs and limitations

- Clients send at 10 Hz, one request in flight, with increasing sequence numbers
  and a per-arm lease. Node limits drive frames to 25 Hz per paired client.
- The daemon stops/disarms on a client heartbeat older than 500 ms, Arduino
  telemetry older than 300 ms, or radio packet age over 250 ms.
- The MCU requires fresh drive frames nominally within 350 ms. It disarms on
  expiry and rejects late frames until a new ARM. Sensor/serial processing and
  OS scheduling add latency; these are not hard-real-time safety guarantees.
  Ultrasonic pings are staggered one per 100 ms (each sensor about 2 Hz), rather
  than blocking the control loop on five consecutive echo timeouts.
- MCU timeout handling does not protect against a hung/dead MCU. Feru's own
  command-loss timeout and a physical stop are required independent safeguards.
- Commands/ARM acknowledgments are not wheel-speed or encoder feedback. The app
  does not prove that the motor board acted on a requested command.
- MPU6050 has no magnetometer. Startup-calibrated gyro integration provides
  relative yaw and complementary-filter roll/pitch using measured sample times.
  Yaw drifts and resets after restart; it is not geographic heading or a safe
  world-coordinate steering reference. Invalid/stale IMU data is marked unavailable.
- Demo Mode is local preview only: no drive API, source selection, arming or
  motor command is transmitted. Its sample orientation is not live hardware.

## Verification performed in development

Automated tests cover control identity/source isolation, leases and replay,
neutral arming, rate limits, heartbeat/telemetry/radio expiry, E-STOP latching,
commissioning, malformed input, serial failure and exact Feru byte encoding.
They use fake serial/hardware inputs. Actual UART timing, motor-board firmware,
receiver failsafe behavior, IMU mounting and physical stop distances require
the bench tests above. Do not interpret passing software tests as certification.
