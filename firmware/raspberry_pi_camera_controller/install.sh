#!/bin/bash

# SlushEngine Model X LT Installation Script
# For Raspberry Pi 3 B+ Camera Pan/Tilt Controller
# RoverOS Project

echo "=============================================="
echo "  RoverOS Camera Pan/Tilt Controller Setup"
echo "  SlushEngine Model X LT Installation"
echo "=============================================="
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    echo "[WARNING] This script is designed for Raspberry Pi"
    echo "          Running on: $(uname -a)"
fi

# Update package lists
echo "[STEP 1] Updating package lists..."
sudo apt-get update

# Install Python3 and pip if not present
echo "[STEP 2] Installing Python3 and pip..."
sudo apt-get install -y python3 python3-pip python3-dev

# Enable SPI interface
echo "[STEP 3] Enabling SPI interface..."
if ! grep -q "^dtparam=spi=on" /boot/config.txt; then
    echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
    echo "          SPI enabled in /boot/config.txt"
else
    echo "          SPI already enabled"
fi

# Enable I2C interface
echo "[STEP 4] Enabling I2C interface..."
if ! grep -q "^dtparam=i2c_arm=on" /boot/config.txt; then
    echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt
    echo "          I2C enabled in /boot/config.txt"
else
    echo "          I2C already enabled"
fi

# Install SPI Python library
echo "[STEP 5] Installing SPI Python library..."
sudo pip3 install spidev

# Install I2C/SMBus library
echo "[STEP 6] Installing SMBus2 library..."
sudo pip3 install smbus2

# Clone and install SlushEngine library
echo "[STEP 7] Installing SlushEngine library..."
if [ -d "slushengine" ]; then
    echo "          Removing old slushengine directory..."
    rm -rf slushengine
fi

git clone https://github.com/Roboteurs/slushengine.git
cd slushengine
sudo python3 setup.py install
cd ..

# Verify installation
echo "[STEP 8] Verifying SlushEngine installation..."
python3 -c "import Slush; print('[OK] SlushEngine library installed successfully')" 2>/dev/null || echo "[WARN] SlushEngine import test failed - please check installation"

# Create systemd service
echo "[STEP 9] Creating systemd service..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

sudo tee /etc/systemd/system/camera-pantilt.service > /dev/null << EOF
[Unit]
Description=RoverOS Camera Pan/Tilt Controller
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/python3 ${SCRIPT_DIR}/camera_pantilt_controller.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

echo ""
echo "=============================================="
echo "  Installation Complete!"
echo "=============================================="
echo ""
echo "IMPORTANT: Please reboot your Raspberry Pi to"
echo "           enable SPI and I2C interfaces."
echo ""
echo "After reboot, you can:"
echo "  1. Test the controller:"
echo "     python3 camera_pantilt_controller.py"
echo ""
echo "  2. Enable auto-start on boot:"
echo "     sudo systemctl enable camera-pantilt"
echo "     sudo systemctl start camera-pantilt"
echo ""
echo "  3. Check service status:"
echo "     sudo systemctl status camera-pantilt"
echo ""
echo "Run 'sudo reboot' to restart now."
