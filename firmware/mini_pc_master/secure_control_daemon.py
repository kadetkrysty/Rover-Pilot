#!/usr/bin/env python3
"""Linux-only Arduino bridge. Private Unix socket, no TCP/HTTP control listener."""
import fcntl
import json
import os
import select
import signal
import socketserver
import termios
import threading
import time
import tty
from control_core import ControlError, DriveAuthority

SOCKET = "/run/roveros-control/control.sock"


class SerialLink:
    def __init__(self, device):
        self.device = device
        self.fd = None
        self.lock = threading.Lock()
        self.ack = threading.Event()
        self.reset_ack = threading.Event()
        self.core = None
        self.latest = None

    def send(self, command):
        if command == "ARM":
            self.ack.clear()
        if command == "RESET_STOP":
            self.reset_ack.clear()
        with self.lock:
            if self.fd is None:
                raise OSError("Serial disconnected")
            payload = (command + "\n").encode("ascii")
            deadline = time.monotonic() + 0.15
            while payload:
                if time.monotonic() > deadline:
                    raise OSError("Serial write timed out")
                if select.select([], [self.fd], [], 0.02)[1]:
                    try:
                        count = os.write(self.fd, payload)
                        payload = payload[count:]
                    except BlockingIOError:
                        pass
        if command == "ARM" and not self.ack.wait(0.2):
            raise OSError("Firmware did not acknowledge ARM")
        if command == "RESET_STOP" and not self.reset_ack.wait(0.2):
            raise OSError("Firmware did not acknowledge E-STOP reset")

    def run(self):
        while True:
            fd = None
            try:
                if not self.device or not self.device.startswith("/dev/"):
                    time.sleep(1)
                    continue
                fd = os.open(self.device, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
                # Fail if another controller owns this serial device.
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                fcntl.ioctl(fd, termios.TIOCEXCL)
                tty.setraw(fd)
                attrs = termios.tcgetattr(fd)
                attrs[4] = attrs[5] = termios.B115200
                attrs[2] |= termios.CLOCAL | termios.CREAD
                termios.tcsetattr(fd, termios.TCSANOW, attrs)
                self.fd = fd
                self.send("STOP")
                pending = b""
                while True:
                    if not select.select([fd], [], [], 0.1)[0]:
                        continue
                    chunk = os.read(fd, 4096)
                    if not chunk:
                        raise OSError("Serial closed")
                    pending += chunk
                    if len(pending) > 16384:
                        pending = b""
                        continue
                    while b"\n" in pending:
                        line, pending = pending.split(b"\n", 1)
                        try:
                            data = json.loads(line)
                            if not isinstance(data, dict):
                                continue
                            if data.get("event") == "drive_armed" and data.get("protocol") == 1:
                                self.ack.set()
                            elif data.get("event") == "drive_reset" and data.get("protocol") == 1:
                                self.reset_ack.set()
                            else:
                                # Never block serial ACK reception on the authority lock.
                                self.latest = (data, time.monotonic())
                        except (ValueError, TypeError):
                            continue
            except Exception:
                self.core.disconnected()
                with self.lock:
                    if self.fd is not None:
                        os.close(self.fd)
                    elif fd is not None:
                        os.close(fd)
                    self.fd = None
                time.sleep(1)


def serve():
    device = os.environ.get("ROVEROS_ARDUINO_DEVICE", "")
    serial = SerialLink(device)
    core = DriveAuthority(serial.send, os.environ.get("ROVEROS_DRIVE_COMMISSIONED") == "1")
    serial.core = core

    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            self.connection.settimeout(0.75)
            try:
                line = self.rfile.readline(4097)
                if len(line) > 4096 or not line.endswith(b"\n"):
                    raise ControlError("Invalid control request.", 400)
                body = json.loads(line)
                if not isinstance(body, dict):
                    raise ControlError("Invalid control request.", 400)
                if body.get("action") == "status":
                    result = core.status(body.get("owner"))
                else:
                    result = core.action(body)
                response = {"ok": True, "data": result}
            except ControlError as error:
                response = {"ok": False, "status": error.status, "error": str(error)}
            except Exception:
                response = {"ok": False, "status": 503, "error": "Controller request failed."}
            self.wfile.write((json.dumps(response, allow_nan=False) + "\n").encode())

    class Server(socketserver.ThreadingUnixStreamServer):
        daemon_threads = True
        request_queue_size = 8

    if os.path.exists(SOCKET):
        os.unlink(SOCKET)
    server = Server(SOCKET, Handler)
    os.chmod(SOCKET, 0o600)
    threading.Thread(target=serial.run, daemon=True).start()

    def watchdog():
        while True:
            try:
                data = serial.latest
                serial.latest = None
                if data is not None:
                    core.update(data[0], data[1])
                core.tick()
            except Exception:
                core.stop("Control watchdog failed.", send=False)
            time.sleep(0.02)

    threading.Thread(target=watchdog, daemon=True).start()

    def shutdown(*_):
        try:
            core.stop("Controller service is stopping.")
        finally:
            os._exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    server.serve_forever(poll_interval=0.05)


if __name__ == "__main__":
    serve()
