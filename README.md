# STAGEBOX

A broken Pixel 8 Pro repurposed as a combined MIDI-triggered lighting controller (QLC+ via DMX) and video cue player for live gigs. Built for the Timeless function band.

## Architecture

```
iPad (Stage Traxx 4)
  │  Audio + MIDI tracks play in sync
  ▼
Behringer XR18 (mixer)
  │  MIDI out
  ▼
USB MIDI Interface ──► UGREEN USB-C Hub ──► Pixel 8 Pro
                        ├── FTDI DMX cable        │
                        ├── HDMI out              │
                        └── USB-C PD power        │
                                                  │
                    ┌─────────────────────────────┘
                    │
          VolksPC Linux (Debian chroot)
                    │
          ┌─────────┴──────────┐
          │                    │
       QLC+               StageCue
    (headless)          (Node.js server)
    port 9999             port 3030
          │                    │
          │              ┌─────┴──────┐
          │              │            │
          ▼              ▼            ▼
    /dev/ttyUSB0    WebSocket     WebSocket
          │         to QLC+      to Chrome
          ▼              │            │
    FTDI DMX cable       │            ▼
          │              │      HDMI output
          ▼              │            │
       Lights            │        Projector
                         │
                    Triggers shows
```

**StageCue is the brain.** It reads raw MIDI from the USB interface and simultaneously:
1. Sends WebSocket commands to QLC+ to trigger lighting shows
2. Sends WebSocket commands to Chrome to trigger video playback

## Hardware

| Component | Details |
|---|---|
| Phone | Pixel 8 Pro (husky), cracked screen, rooted with Magisk 30.7 |
| USB Hub | UGREEN Revodok Pro 106 (HDMI, 2x USB-C, 2x USB-A, 100W PD) |
| DMX Interface | DSD TECH USB-to-DMX, FTDI FT232RL (vendor 0403, product 6001) |
| MIDI Interface | Generic USB MIDI (vendor fc02, product 0101) |
| Phone MAC | aa:bf:c5:a6:c7:8f |

## Network

| Location | Phone IP | ADB | QLC+ | StageCue |
|---|---|---|---|---|
| Home | 192.168.0.176 | :5555 | :9999 | :3030 |
| Stage | DHCP reservation | :5555 | :9999 | :3030 |

Set DHCP reservation on each router for MAC `aa:bf:c5:a6:c7:8f`.

## Boot Sequence

1. Phone powers on
2. Magisk runs `/data/adb/service.d/stagebox.sh`
3. ADB enabled on fixed port 5555
4. VolksPC installer launches, "Start" button auto-tapped (480, 573)
5. VolksPC chroot starts, `/etc/rc.chroot` runs:
   - Creates `/dev/ttyUSB0` (FTDI DMX, major 188 minor 0)
   - Creates `/dev/snd/midiC1D0` (USB MIDI, major 116 minor 40)
   - Creates `/dev/snd/controlC1` and `/dev/snd/timer`
   - Starts QLC+ headless on port 9999
   - Starts StageCue on port 3030
6. HDMI watcher starts polling for external display
7. When HDMI plugged in: Chrome opens fullscreen on external display at `/stage`

## StageCue

MIDI-triggered video cue player with per-band video sets.

### MIDI

- **Channel 15 only** (other channels ignored)
- Responds to **Program Change** messages
- PC number maps to a video file in the active board

### Boards (Bands)

Same songs, different videos per band. Select the active board from the config page before a gig. Same MIDI PC numbers trigger different videos depending on which band is selected.

### URLs

| URL | Purpose |
|---|---|
| `http://phone-ip:3030/stage` | Fullscreen video player (Chrome on HDMI) |
| `http://phone-ip:3030/config` | Cue editor with band management (iPad) |
| `http://phone-ip:3030/api/status` | Server status |
| `http://phone-ip:3030/api/trigger/N` | Test trigger cue N |
| `http://phone-ip:3030/api/videos` | List video files |

### Adding Videos

```bash
adb push myvideo.mp4 /sdcard/Download/
adb shell su -c "cp /sdcard/Download/myvideo.mp4 /data/local/tmp/mxwin/home/desktop/stagecue/videos/"
```

Then open config page on iPad and map it.

### videocues.json

```json
{
  "activeBoard": "3-piece",
  "boards": {
    "3-piece": {
      "name": "3-Piece Band",
      "cues": {
        "1": { "video": "superstition-3piece.mp4", "label": "Superstition", "qlcFunction": 5 },
        "0": { "video": "logo.mp4", "label": "Between Songs", "qlcFunction": null },
        "127": { "video": "", "label": "Blackout", "qlcFunction": null }
      }
    }
  }
}
```

- Empty `video` = blackout (fade to black)
- `qlcFunction` = QLC+ function ID to trigger simultaneously (see below)

---

## QLC+ Integration

### How QLC+ is controlled

QLC+ has **no HTTP API**. It uses **WebSocket** exclusively.

**Endpoint:** `ws://localhost:9999/qlcplusWS`

**Message format:** Pipe-delimited strings: `QLC+API|commandName|param1|param2`

### Key API Commands

**Query functions:**
```
Send:    QLC+API|getFunctionsList
Receive: QLC+API|getFunctionsList|0|Scene 1|1|Scene 2|2|Chase 1|...
         (pairs of: functionID|functionName)
```

**Start/stop a function (scene, chase, show, etc):**
```
Send: QLC+API|setFunctionStatus|5|1    ← Start function ID 5
Send: QLC+API|setFunctionStatus|5|0    ← Stop function ID 5
```

**Query Virtual Console widgets:**
```
Send:    QLC+API|getWidgetsList
Receive: QLC+API|getWidgetsList|0|Button 1|1|Slider 1|...
         (pairs of: widgetID|widgetName)
```

**Press a Virtual Console button:**
```
Send: widgetID|255    ← Button ON (simplified format, no QLC+API prefix)
Send: widgetID|0      ← Button OFF
```

**Set a slider value:**
```
Send: widgetID|128    ← Set slider to 50% (range 0-255)
```

**Set a DMX channel directly (Simple Desk):**
```
Send: QLC+API|sdResetUniverse
Send: QLC+API|setSimpleDeskChannel|1|255    ← Channel 1 to full
```

### How StageCue triggers QLC+

StageCue connects to QLC+ via WebSocket on startup. When a MIDI program change arrives:

1. Look up the cue in the active board
2. If `qlcFunction` is set, send `QLC+API|setFunctionStatus|{id}|1`
3. Simultaneously send the video command to Chrome

### Setup workflow for QLC+

1. **Build your show on Windows/Mac QLC+:**
   - Add your fixtures (DMX addresses, fixture definitions)
   - Create Scenes (static looks: "verse blue", "chorus red")
   - Create Chasers (sequential scene changes with timing)
   - Create Shows (timeline-based, can import audio for visual sync)
   - In the Virtual Console, create buttons that trigger each show/chaser
   - Note down the **Function IDs** — you need these for StageCue mapping

2. **Find Function IDs:**
   - Open the QLC+ web interface: `http://phone-ip:9999`
   - Go to the QLC+ Web API test page: `https://www.qlcplus.org/Test_Web_API.html`
   - Connect to your QLC+ instance
   - Click "getFunctionsList" to see all functions with their IDs
   - Or use the Virtual Console web page — the widget IDs are visible in the page source

3. **Save and deploy the workspace:**
   ```bash
   adb push gig-show.qxw /sdcard/Download/
   adb shell su -c "cp /sdcard/Download/gig-show.qxw /data/local/tmp/mxwin/home/desktop/gig-show.qxw"
   ```

4. **Update rc.chroot to load workspace on boot:**
   Change the QLC+ launch line to:
   ```
   qlcplus -w -o /home/desktop/gig-show.qxw -p
   ```

5. **Map QLC+ functions in StageCue:**
   In the config page, set `qlcFunction` for each cue to the function ID from step 2.

### QLC+ command line options

```
qlcplus -w              # Enable web interface (port 9999)
qlcplus -w -p           # Web + start in operate mode (not design mode)
qlcplus -w -p -o file   # Web + operate + load workspace file
qlcplus -wp 8080        # Use custom port
```

### Important notes

- QLC+ must be running in **operate mode** (`-p` flag) for functions to be triggered
- The web interface must be enabled (`-w` flag)
- The WebSocket endpoint is always at `/qlcplusWS` on the web port
- Widget values are 0-255 (0=off, 255=on for buttons)
- Function status is 0 or 1 (0=stopped, 1=running)
- The DMX USB output selection persists inside the `.qxw` workspace file

---

## File Locations on Phone

### Android side

| File | Path |
|---|---|
| Magisk boot script | `/data/adb/service.d/stagebox.sh` |
| HDMI watcher | `/data/local/tmp/hdmi-watcher.sh` |

### VolksPC side (prefix: `/data/local/tmp/mxwin`)

| File | Linux path | Full Android path |
|---|---|---|
| Startup script | `/etc/rc.chroot` | `/data/local/tmp/mxwin/etc/rc.chroot` |
| StageCue server | `/home/desktop/stagecue/server.js` | `/data/local/tmp/mxwin/home/desktop/stagecue/server.js` |
| StageCue player | `/home/desktop/stagecue/player.html` | `/data/local/tmp/mxwin/home/desktop/stagecue/player.html` |
| StageCue config | `/home/desktop/stagecue/config.html` | `/data/local/tmp/mxwin/home/desktop/stagecue/config.html` |
| Cue mappings | `/home/desktop/stagecue/videocues.json` | `/data/local/tmp/mxwin/home/desktop/stagecue/videocues.json` |
| Videos | `/home/desktop/stagecue/videos/` | `/data/local/tmp/mxwin/home/desktop/stagecue/videos/` |
| QLC+ workspace | `/home/desktop/gig-show.qxw` | `/data/local/tmp/mxwin/home/desktop/gig-show.qxw` |

### Device nodes (created by rc.chroot)

| Device | Path | Major | Minor |
|---|---|---|---|
| FTDI DMX | `/dev/ttyUSB0` | 188 | 0 |
| MIDI | `/dev/snd/midiC1D0` | 116 | 40 |
| MIDI control | `/dev/snd/controlC1` | 116 | 41 |
| Timer | `/dev/snd/timer` | 116 | 33 |

## Deployment

### Updating StageCue

```bash
adb push stagecue/server.js /sdcard/Download/server.js
adb push stagecue/player.html /sdcard/Download/player.html
adb push stagecue/config.html /sdcard/Download/config.html
adb shell su -c "cp /sdcard/Download/server.js /data/local/tmp/mxwin/home/desktop/stagecue/"
adb shell su -c "cp /sdcard/Download/player.html /data/local/tmp/mxwin/home/desktop/stagecue/"
adb shell su -c "cp /sdcard/Download/config.html /data/local/tmp/mxwin/home/desktop/stagecue/"
```

### Updating boot scripts

```bash
adb push scripts/stagebox.sh /sdcard/Download/stagebox.sh
adb push scripts/hdmi-watcher.sh /sdcard/Download/hdmi-watcher.sh
adb push scripts/rc.chroot /sdcard/Download/rc.chroot
adb shell su -c "cp /sdcard/Download/stagebox.sh /data/adb/service.d/ && chmod +x /data/adb/service.d/stagebox.sh"
adb shell su -c "cp /sdcard/Download/hdmi-watcher.sh /data/local/tmp/ && chmod +x /data/local/tmp/hdmi-watcher.sh"
adb shell su -c "cp /sdcard/Download/rc.chroot /data/local/tmp/mxwin/etc/ && chmod 755 /data/local/tmp/mxwin/etc/rc.chroot"
```

## ADB Quick Reference

```bash
adb connect 192.168.0.176:5555
adb shell su
adb shell su -c "ps -ef | grep -E 'qlcplus|node|mxwin|hdmi'"
adb shell su -c "cat /data/local/tmp/mxwin/home/desktop/stagecue.log"
```

## Developer Options Required

- USB Debugging: ON
- Wireless Debugging: ON
- Desktop Mode / Enable Desktop Experience Features: ON
- Force activities to be resizable: ON
- Enable non-resizable in multi window: ON

## Repo Structure

```
stagebox/
├── README.md
├── TODO.md
├── .gitignore
├── stagecue/
│   ├── server.js          # MIDI → video + QLC+ trigger server
│   ├── player.html        # Fullscreen video player (HDMI)
│   ├── config.html        # Band/cue management UI (iPad)
│   ├── videocues.json     # Cue mappings
│   ├── package.json
│   └── videos/
│       └── .gitkeep
└── scripts/
    ├── stagebox.sh        # Magisk boot → /data/adb/service.d/
    ├── hdmi-watcher.sh    # HDMI detect → /data/local/tmp/
    └── rc.chroot          # Linux init → /data/local/tmp/mxwin/etc/
```
