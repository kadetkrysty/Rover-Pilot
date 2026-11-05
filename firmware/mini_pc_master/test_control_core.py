import unittest
from control_core import DriveAuthority, ControlError


class DriveTests(unittest.TestCase):
    def setUp(self):
        self.now = 10
        self.writes = []
        self.core = DriveAuthority(self.writes.append, True, lambda: self.now)
        self.telemetry()

    def telemetry(self, **changes):
        data = {"control": {"protocol": 1, "watchdogMs": 350, "estop": False},
                "imu": {"valid": True, "hdg": 3, "pitch": -2, "roll": 1},
                "ibus": {"con": True, "age": 0, "ch": [1500, 1500, 1500, 1500, 2000] + [1500] * 5}}
        data.update(changes)
        self.core.update(data)

    def arm(self, source="joystick"):
        self.core.action({"action": "select", "source": source, "owner": "A"})
        return self.core.action({"action": "arm", "neutral": True, "owner": "A"})["lease"]

    def frame(self, lease, sequence=0, **changes):
        body = {"action": "frame", "owner": "A", "source": self.core.source,
                "lease": lease, "sequence": sequence, "throttle": 1, "steering": -1}
        body.update(changes)
        return self.core.action(body)

    def test_requires_commissioning(self):
        self.core.commissioned = False
        with self.assertRaises(ControlError):
            self.arm()
        self.assertNotIn("ARM", self.writes)

    def test_bounded_motor_commands(self):
        lease = self.arm()
        self.frame(lease)
        self.now += 0.06
        self.core.tick()
        self.assertEqual(self.writes[-1], "DRIVE:150,-150")

    def test_cross_client_and_cross_source_denied(self):
        lease = self.arm()
        for changes in ({"owner": "B"}, {"source": "gamepad"}, {"lease": "old"}):
            with self.assertRaises(ControlError):
                self.frame(lease, **changes) if "lease" not in changes else self.frame("old")

    def test_replayed_sequence_rejected(self):
        lease = self.arm()
        self.frame(lease)
        with self.assertRaises(ControlError):
            self.frame(lease)

    def test_bad_inputs_rejected(self):
        for value in (float("nan"), float("inf"), True, "1", 1.1):
            lease = self.arm()
            with self.assertRaises(ControlError):
                self.frame(lease, throttle=value)
            self.core.stop()

    def test_client_watchdog_never_auto_rearms(self):
        lease = self.arm()
        self.frame(lease)
        self.now += 0.51
        self.telemetry()
        self.core.tick()
        self.assertFalse(self.core.armed)
        self.assertEqual(self.writes[-1], "STOP")
        with self.assertRaises(ControlError):
            self.frame(lease, 1)

    def test_stale_telemetry_disarms(self):
        self.arm()
        self.now += 0.31
        self.core.tick()
        self.assertFalse(self.core.armed)

    def test_source_handover_disarms_and_rotates_lease(self):
        old = self.arm()
        self.core.action({"action": "select", "source": "gamepad", "owner": "A"})
        self.assertFalse(self.core.armed)
        self.assertEqual(self.writes[-1], "STOP")
        new = self.core.action({"action": "arm", "neutral": True, "owner": "A"})["lease"]
        self.assertNotEqual(old, new)
        with self.assertRaises(ControlError):
            self.frame(old)

    def test_other_operator_can_stop_but_not_steal_active_control(self):
        self.arm()
        with self.assertRaises(ControlError):
            self.core.action({"action": "select", "source": "gamepad", "owner": "B"})
        self.core.action({"action": "stop", "owner": "B"})
        self.assertFalse(self.core.armed)

    def test_estop_stays_latched_until_explicit_reset(self):
        self.arm()
        self.core.action({"action": "estop", "owner": "A"})
        self.now += 5
        self.telemetry()
        with self.assertRaises(ControlError):
            self.core.action({"action": "arm", "neutral": True, "owner": "A"})
        self.assertTrue(self.core.estop)
        self.core.action({"action": "reset", "owner": "A"})
        self.assertFalse(self.core.armed)
        self.assertFalse(self.core.estop)

    def test_flysky_neutral_and_ch5_required(self):
        self.core.receiver["channels"][2] = 1900
        with self.assertRaises(ControlError):
            self.arm("flysky")
        self.core.receiver["channels"][2] = 1500
        self.core.receiver["channels"][4] = 1000
        with self.assertRaises(ControlError):
            self.arm("flysky")

    def test_flysky_uses_receiver_not_client_motion(self):
        lease = self.arm("flysky")
        with self.assertRaises(ControlError):
            self.frame(lease)
        self.frame(lease, throttle=0, steering=0)
        self.core.receiver["channels"][2] = 2000
        self.now += 0.06
        self.core.tick()
        self.assertEqual(self.writes[-1], "DRIVE:150,0")
        self.core.receiver["channels"][4] = 1000
        self.core.tick()
        self.assertFalse(self.core.armed)

    def test_flysky_lost_packets_disarm_even_with_cached_values(self):
        self.arm("flysky")
        self.core.receiver["radioAge"] = 251
        self.core.tick()
        self.assertFalse(self.core.armed)

    def test_legacy_firmware_cannot_arm(self):
        self.telemetry(control={"protocol": 0})
        with self.assertRaises(ControlError):
            self.arm()

    def test_imu_validity_and_freshness(self):
        self.assertTrue(self.core.status("A")["imu"]["valid"])
        self.now += 0.4
        self.assertFalse(self.core.status("A")["imu"]["valid"])
        self.telemetry(imu={"valid": True, "hdg": float("nan"), "pitch": 0, "roll": 0})
        self.assertIsNone(self.core.status("A")["imu"])

    def test_lease_not_disclosed_to_other_client(self):
        self.arm()
        self.assertIsNone(self.core.status("B")["lease"])

    def test_serial_failure_disarms(self):
        self.arm()
        self.core.write = lambda _: (_ for _ in ()).throw(OSError("unplugged"))
        self.now += 0.06
        self.core.tick()
        self.assertFalse(self.core.armed)
        self.assertFalse(self.core.serial_connected)


if __name__ == "__main__":
    unittest.main()
