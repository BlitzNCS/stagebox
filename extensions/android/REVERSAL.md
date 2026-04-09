# Reversal Guide — Undo Everything

Everything done by the CueBoxx Android setup is fully reversible. Follow these steps to restore your phone to stock.

## 1. Remove CueTools Files

```bash
adb shell su -c "rm -rf /data/local/tmp/mxwin/home/desktop/cuetools"
adb shell su -c "rm -f /data/local/tmp/mxwin/home/desktop/cuetools.log"
adb shell su -c "rm -f /data/adb/service.d/cueboxx-boot.sh"
adb shell su -c "rm -f /data/local/tmp/hdmi-watcher.sh"
```

## 2. Remove VolksPC

On the phone:
1. Uninstall **VolksPC Installer** (Settings > Apps)
2. Uninstall **VolksPC Desktop** (Settings > Apps)
3. Delete the chroot data:

```bash
adb shell su -c "rm -rf /data/local/tmp/mxwin"
```

## 3. Unroot (Remove Magisk)

### Option A: Clean uninstall via Magisk app

1. Open the **Magisk** app
2. Tap **Uninstall** > **Complete Uninstall**
3. The phone will reboot with stock boot image restored

### Option B: Flash stock boot image

```bash
# Get the original init_boot.img (or boot.img) from the factory image
adb reboot bootloader
fastboot flash init_boot init_boot.img   # or: fastboot flash boot boot.img
fastboot reboot
```

Then uninstall the Magisk app.

## 4. Relock Bootloader (Optional)

Only do this if you want to fully restore the phone to factory state.

**Warning:** Relocking the bootloader erases all data again.

```bash
# First, flash the FULL factory image to ensure everything is stock
# Download from: https://developers.google.com/android/images
# Extract and run flash-all.sh (Mac/Linux) or flash-all.bat (Windows)

adb reboot bootloader
fastboot flashing lock
# Confirm with volume keys + power button
```

## 5. Disable Developer Options (Optional)

Settings > System > Developer Options > toggle off at the top.

Or: Settings > Apps > Show system apps > Settings Storage > Clear Data (resets all developer settings).

## Result

After these steps, your phone is completely stock — no root, no Linux chroot, no CueBoxx files. It's as if nothing was ever installed.
