# CueBoxx — Raspberry Pi Platform

CueBoxx is the reference hardware platform for CueTools. It turns a Raspberry Pi into a dedicated MIDI-triggered video cue player and lighting controller for live performance.

## Recommended Hardware

| Component | Recommended | Notes |
|---|---|---|
| Raspberry Pi | Pi 4 Model B (4GB+) or Pi 5 | Pi 5 preferred for 4K video |
| Storage | 32GB+ microSD or USB SSD | SSD recommended for video performance |
| USB MIDI Interface | Generic USB MIDI cable | Any class-compliant USB MIDI adapter |
| USB DMX Interface | DSD TECH USB-to-DMX (FTDI FT232RL) | For QLC+ lighting output |
| HDMI Output | Direct HDMI to projector/screen | Pi 4: micro-HDMI, Pi 5: full HDMI |
| Power | Official Pi PSU (5V 3A+) | Must power USB peripherals reliably |

## Installation

```bash
git clone <repo-url> /tmp/stagebox
cd /tmp/stagebox
sudo bash platform/cueboxx/install.sh
```

This will:
1. Install Node.js 20 (if needed)
2. Install QLC+ (if needed)
3. Create a `cuetools` system user
4. Copy CueTools to `/opt/cuetools`
5. Install and enable systemd services
6. Set up udev rules for USB MIDI/DMX devices

## Services

| Service | Purpose |
|---|---|
| `cueboxx.service` | CueTools server (MIDI, API, WebSocket) |
| `cueboxx-qlc.service` | QLC+ headless lighting engine |
| `cueboxx-display.service` | Chromium kiosk on HDMI (CuePlayer) |

```bash
# Start all services
sudo systemctl start cueboxx cueboxx-qlc cueboxx-display

# Check status
sudo systemctl status cueboxx

# View logs
journalctl -u cuetools -f
```

## Adding Videos

Copy video files directly to `/opt/cuetools/videos/`:

```bash
sudo cp myvideo.mp4 /opt/cuetools/videos/
sudo chown cuetools:cuetools /opt/cuetools/videos/myvideo.mp4
```

Then map them in CueDeck at `http://<pi-ip>:3030/deck`.

## Boot Configuration

Review `boot-config.txt` in this directory for recommended Raspberry Pi boot settings (HDMI, GPU memory, USB power).
