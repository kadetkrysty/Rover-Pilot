"""Exercise the real Linux serial transport using a pseudo-terminal, not motors."""
import json
import os
import pty
import select
import threading
import time
import unittest
from control_core import DriveAuthority
from secure_control_daemon import SerialLink


class SerialTransportTests(unittest.TestCase):
    def test_arm_ack_is_received_without_authority_lock_deadlock(self):
        master, slave = pty.openpty()
        link = SerialLink(os.ttyname(slave))
        core = DriveAuthority(link.send, commissioned=True)
        link.core = core
        finished = threading.Event()
        telemetry = {"control": {"protocol": 1, "watchdogMs": 350, "estop": False}}

        def firmware():
            pending = b""
            while not finished.is_set():
                try:
                    os.write(master, (json.dumps(telemetry) + "\n").encode())
                    if select.select([master], [], [], 0.02)[0]:
                        pending += os.read(master, 1024)
                        while b"\n" in pending:
                            line, pending = pending.split(b"\n", 1)
                            if line.strip() == b"ARM":
                                os.write(master, b'{"event":"drive_armed","protocol":1}\n')
                except OSError:
                    return
                time.sleep(0.02)

        threading.Thread(target=link.run, daemon=True).start()
        threading.Thread(target=firmware, daemon=True).start()
        try:
            deadline = time.monotonic() + 2
            while link.latest is None and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertIsNotNone(link.latest)
            core.update(*link.latest)
            core.action({"action": "select", "source": "joystick", "owner": "test"})
            result = core.action({"action": "arm", "neutral": True, "owner": "test"})
            self.assertTrue(result["armed"])
            self.assertIsNotNone(result["lease"])
            core.action({"action": "stop", "owner": "test"})
            self.assertFalse(core.armed)
        finally:
            finished.set()
            os.close(master)
            os.close(slave)
