#!/bin/bash
# CueBoxx Quick Deploy — Android Extension
# For advanced users: pushes CueTools to a rooted Android phone via ADB
# Usage: bash deploy-quick.sh [phone-ip]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$EXT_DIR/../.." && pwd)"
ADB="${ADB:-adb}"

PHONE_IP="${1:-}"
if [ -n "$PHONE_IP" ]; then
  echo "Connecting to $PHONE_IP:5555..."
  $ADB connect "$PHONE_IP:5555" || true
  sleep 2
fi

echo "=================================="
echo "  CueBoxx Quick Deploy — Android"
echo "=================================="
echo

# Check connection
$ADB devices | grep -q "device$" || {
  echo "ERROR: No phone detected. Connect via USB or specify IP."
  echo "Usage: $0 [phone-ip]"
  exit 1
}

REMOTE="/data/local/tmp/mxwin/home/desktop/cuetools"

echo "Creating directories..."
$ADB shell su -c "mkdir -p $REMOTE/lib $REMOTE/ui $REMOTE/config $REMOTE/videos"

echo "Deploying CueTools core..."
for f in cuetools.js package.json; do
  $ADB push "$REPO_ROOT/cuetools/$f" /sdcard/Download/
  $ADB shell su -c "cp /sdcard/Download/$f $REMOTE/"
done

echo "Deploying lib modules..."
for f in "$REPO_ROOT"/cuetools/lib/*.js; do
  fname=$(basename "$f")
  $ADB push "$f" /sdcard/Download/
  $ADB shell su -c "cp /sdcard/Download/$fname $REMOTE/lib/"
done

echo "Deploying UI..."
for f in "$REPO_ROOT"/cuetools/ui/*.html; do
  fname=$(basename "$f")
  $ADB push "$f" /sdcard/Download/
  $ADB shell su -c "cp /sdcard/Download/$fname $REMOTE/ui/"
done

# Only deploy default config if none exists
$ADB shell su -c "test -f $REMOTE/config/cues.json" 2>/dev/null || {
  echo "Deploying default config..."
  $ADB push "$REPO_ROOT/cuetools/config/cues.json" /sdcard/Download/
  $ADB shell su -c "cp /sdcard/Download/cues.json $REMOTE/config/"
}

echo
echo "=================================="
echo "  Deploy complete!"
echo "=================================="
echo "  Reboot phone or restart CueTools inside VolksPC."
echo
