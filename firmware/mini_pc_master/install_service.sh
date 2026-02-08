#!/bin/bash
echo "=== RoverOS Service Installer ==="
echo ""

sudo cp /home/cristian/Rover-Pilot/firmware/mini_pc_master/rover_controller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rover_controller.service
sudo systemctl start rover_controller.service

echo ""
echo "=== Installation Complete ==="
echo ""
echo "The rover controller will now start automatically on boot."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status rover_controller    - Check status"
echo "  sudo systemctl restart rover_controller   - Restart"
echo "  sudo systemctl stop rover_controller      - Stop"
echo "  sudo journalctl -u rover_controller -f    - View live logs"
echo "  sudo systemctl disable rover_controller   - Disable auto-start"
echo ""
