#!/bin/bash
# CueBoxx Installer — sets up CueTools on a Raspberry Pi
# Run as root: sudo bash install.sh
set -e

INSTALL_DIR="/opt/cuetools"
CUETOOLS_USER="cuetools"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================="
echo "  CueBoxx Installer"
echo "  CueTools for Raspberry Pi"
echo "========================================="
echo

# ─── Pre-flight checks ──────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run this script as root (sudo bash install.sh)"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (found v$(node -v))"
  exit 1
fi

echo "Node.js $(node -v) — OK"

# ─── Install QLC+ (if not present) ──────────────────────────────
if ! command -v qlcplus &>/dev/null; then
  echo "Installing QLC+..."
  apt-get update
  apt-get install -y qlcplus
fi

echo "QLC+ — OK"

# ─── Create system user ─────────────────────────────────────────
if ! id "$CUETOOLS_USER" &>/dev/null; then
  useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$CUETOOLS_USER"
  echo "Created system user: $CUETOOLS_USER"
fi

# Add to audio/video/dialout groups for MIDI + HDMI + DMX access
usermod -aG audio,video,dialout,plugdev "$CUETOOLS_USER"

# ─── Install CueTools ───────────────────────────────────────────
echo "Installing CueTools to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r "$REPO_ROOT/cuetools/"* "$INSTALL_DIR/"
chown -R "$CUETOOLS_USER":"$CUETOOLS_USER" "$INSTALL_DIR"

cd "$INSTALL_DIR"
sudo -u "$CUETOOLS_USER" npm install --production
echo "CueTools installed — OK"

# ─── Create video directory ─────────────────────────────────────
mkdir -p "$INSTALL_DIR/videos"
chown "$CUETOOLS_USER":"$CUETOOLS_USER" "$INSTALL_DIR/videos"

# ─── Install systemd services ───────────────────────────────────
echo "Installing systemd services..."
cp "$SCRIPT_DIR/cueboxx.service" /etc/systemd/system/
cp "$SCRIPT_DIR/cueboxx-display.service" /etc/systemd/system/
cp "$SCRIPT_DIR/cueboxx-qlc.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable cueboxx.service
systemctl enable cueboxx-qlc.service
systemctl enable cueboxx-display.service

echo "Services enabled — OK"

# ─── Configure MIDI udev rules ──────────────────────────────────
echo "Installing udev rules for USB MIDI/DMX..."
cat > /etc/udev/rules.d/99-cueboxx.rules << 'UDEV'
# USB MIDI — grant access to cuetools user
SUBSYSTEM=="snd", KERNEL=="midi*", MODE="0666"
SUBSYSTEM=="sound", KERNEL=="midi*", MODE="0666"

# FTDI USB-to-DMX (DSD TECH FT232RL)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", MODE="0666", SYMLINK+="cueboxx-dmx"

# Generic USB MIDI
SUBSYSTEM=="snd", ATTRS{idVendor}=="fc02", ATTRS{idProduct}=="0101", MODE="0666", SYMLINK+="cueboxx-midi"
UDEV
udevadm control --reload-rules
echo "udev rules — OK"

# ─── Apply Raspberry Pi boot config recommendations ─────────────
BOOT_CONFIG="/boot/firmware/config.txt"
[ ! -f "$BOOT_CONFIG" ] && BOOT_CONFIG="/boot/config.txt"

if [ -f "$BOOT_CONFIG" ]; then
  echo
  echo "Recommended /boot/config.txt additions for CueBoxx:"
  echo "  (see platform/cueboxx/boot-config.txt)"
  echo
  echo "  # Force HDMI output even without monitor at boot"
  echo "  hdmi_force_hotplug=1"
  echo "  # Set 1080p output"
  echo "  hdmi_group=1"
  echo "  hdmi_mode=16"
  echo "  # GPU memory for video playback"
  echo "  gpu_mem=256"
  echo
  echo "  Apply these manually if needed."
fi

# ─── Summary ────────────────────────────────────────────────────
echo
echo "========================================="
echo "  CueBoxx installation complete!"
echo "========================================="
echo
echo "  CueTools installed to: $INSTALL_DIR"
echo "  Config file:           $INSTALL_DIR/config/cues.json"
echo "  Video directory:       $INSTALL_DIR/videos"
echo
echo "  Start services:"
echo "    sudo systemctl start cueboxx"
echo "    sudo systemctl start cueboxx-qlc"
echo "    sudo systemctl start cueboxx-display"
echo
echo "  Or start all at once:"
echo "    sudo systemctl start cueboxx cueboxx-qlc cueboxx-display"
echo
echo "  CueDeck (config):  http://$(hostname -I | awk '{print $1}'):3030/deck"
echo "  CuePlayer (stage): http://$(hostname -I | awk '{print $1}'):3030/stage"
echo
