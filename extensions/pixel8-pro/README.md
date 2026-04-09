# Pixel 8 Pro Extension

This extension adapts CueTools to run on a rooted Pixel 8 Pro using VolksPC (a Debian chroot on Android). It was the original prototype hardware and remains a supported platform.

## How It Works

The Pixel 8 Pro runs Android with Magisk root. On boot:

1. **Magisk** runs `cueboxx-boot.sh` which starts ADB and launches VolksPC
2. **VolksPC** starts a Debian Linux chroot, running `rc.chroot` on init
3. **rc.chroot** creates device nodes for USB MIDI/DMX, starts QLC+ headless, and starts CueTools
4. **hdmi-watcher.sh** polls for an external HDMI display and launches Chrome in fullscreen when found

## Prerequisites

- Pixel 8 Pro (codename: husky), rooted with Magisk
- VolksPC installed from Play Store
- USB-C hub with HDMI output (e.g. UGREEN Revodok Pro 106)
- USB MIDI interface
- USB DMX interface (FTDI-based, e.g. DSD TECH)

## Hardware Details

| Component | Details |
|---|---|
| Phone | Pixel 8 Pro (husky), rooted with Magisk 30.7 |
| USB Hub | UGREEN Revodok Pro 106 (HDMI, 2x USB-C, 2x USB-A, 100W PD) |
| DMX Interface | DSD TECH USB-to-DMX, FTDI FT232RL (vendor 0403, product 6001) |
| MIDI Interface | Generic USB MIDI (vendor fc02, product 0101) |
| Phone MAC | aa:bf:c5:a6:c7:8f |

## Android Developer Options Required

- USB Debugging: ON
- Wireless Debugging: ON
- Desktop Mode / Enable Desktop Experience Features: ON
- Force activities to be resizable: ON
- Enable non-resizable in multi window: ON

## Deployment

Use the deploy script:

```bash
# With phone already connected via ADB
bash extensions/pixel8-pro/deploy.sh

# Or specify IP to auto-connect
bash extensions/pixel8-pro/deploy.sh 192.168.0.176
```

## File Locations on Phone

### Android Side

| File | Path |
|---|---|
| Magisk boot script | `/data/adb/service.d/cueboxx-boot.sh` |
| HDMI watcher | `/data/local/tmp/hdmi-watcher.sh` |

### VolksPC Side (prefix: `/data/local/tmp/mxwin`)

| File | Linux Path |
|---|---|
| Startup script | `/etc/rc.chroot` |
| CueTools server | `/home/desktop/cuetools/cuetools.js` |
| CueTools lib | `/home/desktop/cuetools/lib/` |
| CueTools UI | `/home/desktop/cuetools/ui/` |
| Cue config | `/home/desktop/cuetools/config/cues.json` |
| Videos | `/home/desktop/cuetools/videos/` |
| QLC+ workspace | `/home/desktop/gig-show.qxw` |

### Device Nodes (created by rc.chroot)

| Device | Path | Major | Minor |
|---|---|---|---|
| FTDI DMX | `/dev/ttyUSB0` | 188 | 0 |
| MIDI | `/dev/snd/midiC1D0` | 116 | 40 |
| MIDI control | `/dev/snd/controlC1` | 116 | 41 |
| Timer | `/dev/snd/timer` | 116 | 33 |

## Known Limitations

- Display ID increments each HDMI plug/unplug cycle (watcher handles dynamically)
- Chrome fullscreen tap coordinates (300,130 / 300,170 / 960,540) may vary on different display resolutions
- VolksPC evaluation version: keyboard stops after 10 mins (irrelevant for headless gig use)
- Screen-off (keyevent 26) kills both phone and HDMI output
