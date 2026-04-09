#!/bin/bash
# CueBoxx Deploy Script — Pixel 8 Pro Extension
# Pushes CueTools + extension scripts to the phone via ADB
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ADB="${ADB:-adb}"

PHONE_IP="${1:-}"
if [ -n "$PHONE_IP" ]; then
  echo "Connecting to $PHONE_IP:5555..."
  $ADB connect "$PHONE_IP:5555"
fi

echo "========================================="
echo "  CueBoxx Deploy — Pixel 8 Pro"
echo "========================================="
echo

# ─── Push CueTools application files ────────────────────────────
echo "Deploying CueTools..."
for f in cuetools.js package.json; do
  $ADB push "$REPO_ROOT/cuetools/$f" /sdcard/Download/
  $ADB shell su -c "cp /sdcard/Download/$f /data/local/tmp/mxwin/home/desktop/cuetools/"
done

# Push lib directory
for f in "$REPO_ROOT"/cuetools/lib/*.js; do
  fname=$(basename "$f")
  $ADB push "$f" /sdcard/Download/
  $ADB shell su -c "mkdir -p /data/local/tmp/mxwin/home/desktop/cuetools/lib && cp /sdcard/Download/$fname /data/local/tmp/mxwin/home/desktop/cuetools/lib/"
done

# Push UI files
for f in "$REPO_ROOT"/cuetools/ui/*.html; do
  fname=$(basename "$f")
  $ADB push "$f" /sdcard/Download/
  $ADB shell su -c "mkdir -p /data/local/tmp/mxwin/home/desktop/cuetools/ui && cp /sdcard/Download/$fname /data/local/tmp/mxwin/home/desktop/cuetools/ui/"
done

echo "CueTools deployed — OK"

# ─── Push extension scripts ─────────────────────────────────────
echo "Deploying Pixel 8 Pro extension scripts..."

$ADB push "$SCRIPT_DIR/scripts/cueboxx-boot.sh" /sdcard/Download/cueboxx-boot.sh
$ADB shell su -c "cp /sdcard/Download/cueboxx-boot.sh /data/adb/service.d/ && chmod +x /data/adb/service.d/cueboxx-boot.sh"

$ADB push "$SCRIPT_DIR/scripts/hdmi-watcher.sh" /sdcard/Download/hdmi-watcher.sh
$ADB shell su -c "cp /sdcard/Download/hdmi-watcher.sh /data/local/tmp/ && chmod +x /data/local/tmp/hdmi-watcher.sh"

$ADB push "$SCRIPT_DIR/scripts/rc.chroot" /sdcard/Download/rc.chroot
$ADB shell su -c "cp /sdcard/Download/rc.chroot /data/local/tmp/mxwin/etc/ && chmod 755 /data/local/tmp/mxwin/etc/rc.chroot"

echo "Extension scripts deployed — OK"

echo
echo "========================================="
echo "  Deploy complete!"
echo "========================================="
echo "  Reboot the phone to apply boot script changes."
echo
