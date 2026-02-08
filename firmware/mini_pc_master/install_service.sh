#!/bin/bash
echo "=== RoverOS Service Installer ==="
echo ""

echo "[1/4] Adding user to dialout group for serial port access..."
sudo usermod -aG dialout cristian

echo "[2/4] Copying service file..."
sudo cp /home/cristian/Rover-Pilot/firmware/mini_pc_master/rover_controller.service /etc/systemd/system/

echo "[3/4] Reloading systemd..."
sudo systemctl daemon-reload

echo "[4/4] Enabling and starting service..."
sudo systemctl enable rover_controller.service
sudo systemctl restart rover_controller.service

sleep 3
echo ""
echo "=== Service Status ==="
sudo systemctl status rover_controller --no-pager
echo ""
echo "=== Installation Complete ==="
echo ""
echo "The rover controller will start automatically on boot (with 10s delay for USB devices)."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status rover_controller    - Check status"
echo "  sudo systemctl restart rover_controller   - Restart"
echo "  sudo systemctl stop rover_controller      - Stop"
echo "  sudo journalctl -u rover_controller -f    - View live logs"
echo "  sudo systemctl disable rover_controller   - Disable auto-start"
echo ""
