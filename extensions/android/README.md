# CueBoxx — Android Extension

Run CueTools on a rooted Android phone instead of (or alongside) a Raspberry Pi.

This extension turns a spare Android phone into a CueBoxx node — the same CueTools software, deployed into a Linux chroot environment on Android.

## Quick Start

Connect your phone via USB, then:

```bash
cd extensions/android/setup
node setup.js
```

The setup assistant will:
1. Detect your phone and load the right device profile
2. Walk you through rooting (if needed)
3. Install VolksPC (Debian Linux chroot)
4. Deploy CueTools and configure auto-start
5. Verify everything works

No terminal expertise required — just follow the prompts.

## How It Works

```
Your Android Phone (rooted)
  │
  ├── Magisk (root manager)
  │     └── cueboxx-boot.sh (runs on boot)
  │
  ├── VolksPC (Debian Linux chroot)
  │     ├── CueTools (Node.js, port 3030)
  │     ├── QLC+ (headless, port 9999)
  │     └── Device nodes for USB MIDI + DMX
  │
  └── HDMI Watcher (if phone supports video output)
        └── Chrome fullscreen → CuePlayer
```

CueTools runs identically to the Raspberry Pi version — same code, same API, same CueDeck/CuePlayer. The only difference is how the OS boots and how USB devices are accessed.

## Supported Devices

### Recommended (tested, easy setup)

| Device | HDMI | Root | Notes |
|---|---|---|---|
| Pixel 9 / 9 Pro | Yes | Easy | Best option — latest hardware, full support |
| Pixel 8 / 8 Pro | Yes | Easy | Original CueBoxx prototype |

### Compatible (should work, community-tested)

| Device | HDMI | Root | Notes |
|---|---|---|---|
| Pixel 7 / 7 Pro | No | Easy | No HDMI — use a separate display for CuePlayer |
| Pixel 6 / 6 Pro | No | Easy | Uses `boot` partition (not `init_boot`) |
| OnePlus 12 / 11 | Yes | Easy | No factory images — use payload dumper for boot image |

### Use with Caution

| Device | Why |
|---|---|
| Xiaomi / Redmi / POCO | 7-30 day mandatory wait for bootloader unlock |
| Samsung Galaxy | Knox eFUSE trips permanently — avoid unless you accept the trade-off |
| Carrier-locked phones | Bootloader unlock usually blocked by carrier |

### Requirements

- **ARM64** (aarch64) processor
- **Android 12** or newer
- **GKI kernel** (check: Settings > About Phone > Kernel Version)
- **Unlockable bootloader** (not carrier-locked)
- **8GB+** free storage for the Linux chroot
- **4GB+** RAM recommended

## What You Need

| Item | Purpose |
|---|---|
| Android phone (see above) | Runs CueTools |
| USB cable | Connect phone to PC for setup |
| PC (Windows/Mac/Linux) | Run the setup assistant |
| USB MIDI interface | Receives MIDI from your mixer/DAW |
| USB-C hub (if using HDMI) | HDMI output + USB peripherals + charging |
| USB DMX interface (optional) | For QLC+ lighting control |

## Setup Methods

### Automated (recommended)

```bash
node extensions/android/setup/setup.js
```

Interactive assistant handles everything. Works on Windows, macOS, and Linux.

### Manual (advanced)

Use the quick-deploy script after rooting and installing VolksPC yourself:

```bash
bash extensions/android/scripts/deploy-quick.sh [phone-ip]
```

## Updating CueTools

When you pull new code from the repo:

```bash
# Automated
node extensions/android/setup/setup.js
# Choose option 3: "Update CueTools"

# Or manual
bash extensions/android/scripts/deploy-quick.sh
```

## Phones Without HDMI

If your phone doesn't support HDMI output, CueTools still works perfectly for MIDI-triggered lighting via QLC+. For video output:

- Open `http://<phone-ip>:3030/stage` on a laptop or tablet connected to a projector
- Or pair with a Raspberry Pi CueBoxx for video, using the phone for lighting only
- Or use a cheap HDMI-capable Android TV stick running Chrome

## Troubleshooting

| Problem | Fix |
|---|---|
| ADB not detecting phone | Enable USB Debugging in Developer Options, accept the prompt on phone |
| Broken screen | Use `scrcpy` to mirror: https://github.com/Genymobile/scrcpy |
| Root not detected | Open Magisk app, complete any pending setup, reboot |
| CueTools not starting | Check log: `adb shell su -c "cat /data/local/tmp/mxwin/home/desktop/cuetools.log"` |
| MIDI device not found | Replug USB MIDI, check: `adb shell su -c "ls /dev/snd/"` |
| No HDMI output | Check Developer Options > "Enable Desktop Experience Features" |
| VolksPC won't start | Reinstall via the VolksPC Installer app |
| Chrome not fullscreening | Tap coordinates may need adjusting — edit hdmi-watcher.sh |

## Reversal

Everything is fully reversible. See [REVERSAL.md](REVERSAL.md) for complete instructions on unrooting, removing VolksPC, and restoring the phone to stock.

## File Structure

```
extensions/android/
├── README.md              # This file
├── REVERSAL.md            # How to undo everything
├── profiles/
│   └── devices.json       # Device database (codenames, boot partitions, etc.)
├── setup/
│   ├── setup.js           # Interactive setup assistant
│   ├── package.json       # Zero dependencies
│   └── lib/               # Setup modules
│       ├── adb.js          # ADB/fastboot wrapper
│       ├── prompts.js      # CLI interaction
│       ├── detect.js       # Device detection + profile matching
│       ├── templates.js    # Script template rendering
│       ├── root-guide.js   # Guided rooting walkthrough
│       ├── volkspc-setup.js # VolksPC installation
│       ├── deploy.js       # CueTools deployment
│       └── verify.js       # Installation verification
├── templates/             # Script templates ({{VAR}} substitution)
│   ├── cueboxx-boot.sh     # Magisk boot hook
│   ├── hdmi-watcher.sh     # HDMI display detection
│   └── rc.chroot           # VolksPC Linux init
└── scripts/
    └── deploy-quick.sh    # Quick deploy for advanced users
```
