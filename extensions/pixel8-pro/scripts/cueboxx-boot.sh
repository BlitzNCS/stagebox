#!/system/bin/sh
# CueBoxx Boot Script — Pixel 8 Pro Extension
# Location on phone: /data/adb/service.d/cueboxx-boot.sh
# Runs automatically on boot via Magisk

# Wait for Android to fully boot
while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done
sleep 10

# Enable ADB over WiFi on fixed port
setprop service.adb.tcp.port 5555
stop adbd
start adbd

# Launch VolksPC installer
am start -n org.volkspc.installer/.MainActivity
sleep 5

# Tap "Start VolksPC desktop" on phone screen (no HDMI at boot)
su shell -c "input tap 480 573"

# Start HDMI watcher in background
sh /data/local/tmp/hdmi-watcher.sh &
