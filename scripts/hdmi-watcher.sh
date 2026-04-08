#!/system/bin/sh
# STAGEBOX HDMI Watcher
# Location on phone: /data/local/tmp/hdmi-watcher.sh
# Polls for external display connection and launches Chrome fullscreen
# with the StageCue video player page

LAUNCHED=0

while true; do
    if dumpsys display 2>/dev/null | grep -q "type EXTERNAL" 2>/dev/null; then
        if [ "$LAUNCHED" -eq 0 ]; then
            sleep 5

            # Find the highest displayId (external is always the newest)
            DISPLAY_ID=$(dumpsys display 2>/dev/null | grep "displayId [0-9]" 2>/dev/null | grep -o "displayId [0-9]*" | grep -o "[0-9]*" | sort -n | tail -1)

            if [ -n "$DISPLAY_ID" ] && [ "$DISPLAY_ID" -gt 1 ]; then
                am force-stop com.android.chrome
                sleep 2
                am start --display "$DISPLAY_ID" --activity-clear-task -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d "http://localhost:3030/stage" > /dev/null 2>&1
                sleep 5
                # Open window dropdown
                input -d "$DISPLAY_ID" tap 300 130
                sleep 1
                # Tap fullscreen
                input -d "$DISPLAY_ID" tap 300 170
                sleep 2
                # Tap page to trigger browser fullscreen
                input -d "$DISPLAY_ID" tap 960 540
                LAUNCHED=1
            fi
        fi
    else
        LAUNCHED=0
    fi

    sleep 3
done
