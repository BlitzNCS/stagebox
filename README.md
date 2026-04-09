# CueBoxx

MIDI-triggered video cue and lighting control for live performance.

**CueBoxx** is the hardware — a Raspberry Pi turned into a dedicated stage controller.
**CueTools** is the software — a modular Node.js system that receives MIDI Program Change messages and simultaneously triggers video playback and DMX lighting.

Built for function bands, theater, worship, and any live performance needing synchronized visuals and lighting from a single MIDI trigger.

## How It Works

```
iPad / DAW / Sequencer
  │  MIDI Program Change
  ▼
USB MIDI Interface ──► CueBoxx (Raspberry Pi)
                              │
                    ┌─────────┴──────────┐
                    │     CueTools       │
                    │                    │
                    ▼                    ▼
              CuePlayer            QLC+ (CueLink)
            (video output)        (lighting control)
                    │                    │
                    ▼                    ▼
           HDMI → Projector      DMX → Lights
```

One MIDI message. Video plays. Lights change. In sync. Every time.

## Quick Start (Raspberry Pi)

```bash
git clone <repo-url> /tmp/cueboxx
cd /tmp/cueboxx
sudo bash platform/cueboxx/install.sh
sudo systemctl start cueboxx cueboxx-qlc cueboxx-display
```

Then open **CueDeck** on your phone/tablet: `http://<pi-ip>:3030/deck`

## Project Structure

```
├── cuetools/                    # CueTools — the core software
│   ├── cuetools.js              # Entry point
│   ├── lib/
│   │   ├── cue-engine.js        # CueEngine — cue triggering + dispatch
│   │   ├── midi-listener.js     # MIDI device input
│   │   ├── qlc-bridge.js        # CueLink — QLC+ WebSocket bridge
│   │   ├── video-server.js      # Video file serving (HTTP range)
│   │   └── config-store.js      # Config persistence + board management
│   ├── ui/
│   │   ├── cue-player.html      # CuePlayer — fullscreen video output
│   │   └── cue-deck.html        # CueDeck — configuration dashboard
│   ├── config/
│   │   └── cues.json            # Cue mappings
│   ├── videos/                  # Video files (not in git)
│   └── package.json
│
├── platform/
│   └── cueboxx/                 # CueBoxx — Raspberry Pi platform
│       ├── install.sh           # One-command installer
│       ├── cueboxx.service      # systemd: CueTools server
│       ├── cueboxx-qlc.service  # systemd: QLC+ headless
│       ├── cueboxx-display.service  # systemd: Chromium kiosk
│       └── boot-config.txt      # Recommended RPi boot settings
│
├── extensions/
│   └── android/                 # Android phone extension (multi-device)
│       ├── profiles/
│       │   └── devices.json     # Device database (Pixel, OnePlus, etc.)
│       ├── setup/
│       │   ├── setup.js         # Interactive setup assistant (zero deps)
│       │   └── lib/             # ADB, detection, rooting, deployment
│       ├── templates/           # Boot script templates (per-device generated)
│       └── scripts/
│           └── deploy-quick.sh  # Quick deploy for advanced users
│
└── docs/
    ├── architecture.md          # System architecture + module breakdown
    └── api.md                   # Full HTTP + WebSocket API reference
```

## Naming Guide

| Name | What It Is |
|---|---|
| **CueBoxx** | The hardware product — a Raspberry Pi configured as a dedicated cue controller |
| **CueTools** | The software system that runs on CueBoxx (or any supported platform) |
| **CueEngine** | Core module — receives MIDI triggers, dispatches video + lighting commands |
| **CuePlayer** | Fullscreen video output UI — runs in a browser on the HDMI display |
| **CueDeck** | Configuration dashboard UI — manage boards and cues from a phone/tablet |
| **CueLink** | QLC+ bridge — connects CueTools to QLC+ for lighting control |

## Web Interfaces

| URL | Name | Purpose |
|---|---|---|
| `http://<ip>:3030/stage` | **CuePlayer** | Fullscreen video — point HDMI display here |
| `http://<ip>:3030/deck` | **CueDeck** | Config dashboard — open on your phone/tablet |
| `http://<ip>:3030/api/status` | Status | Server health check |
| `http://<ip>:3030/api/trigger/N` | Test | Manually fire cue N |

## Boards (Multi-Band Support)

CueTools supports multiple **boards** — named cue sets that map the same MIDI PC numbers to different videos and lighting. Switch boards in CueDeck before a set:

- "Timeless" board: PC 1 → `superstition-timeless.mp4` + QLC function 5
- "3-Piece" board: PC 1 → `superstition-3piece.mp4` + QLC function 12
- "Wedding" board: PC 1 → `first-dance.mp4` + QLC function 20

## Android Phone Extension

Got a spare Android phone? Turn it into a CueBoxx node:

```bash
cd extensions/android/setup
node setup.js
```

The setup assistant auto-detects your phone, walks you through rooting + VolksPC, and deploys CueTools — all from one interactive script. Supports Pixel 8/9 (recommended), Pixel 6/7, OnePlus, and more. See [extensions/android/](extensions/android/) for details.

## Extending to Other Hardware

CueTools is platform-agnostic. The Raspberry Pi (CueBoxx) is the primary target, but the software runs anywhere Node.js does.

**Platforms** (`/platform`) provide first-class deployment support.
**Extensions** (`/extensions`) adapt CueTools to additional hardware.

See `extensions/README.md` for how to add support for new hardware.

## Documentation

- [Architecture](docs/architecture.md) — system design, module breakdown, data flow
- [API Reference](docs/api.md) — HTTP endpoints, WebSocket protocol, QLC+ commands

## Development

```bash
cd cuetools
npm install
node cuetools.js
```

Environment variables for configuration:

| Variable | Default | Description |
|---|---|---|
| `CUETOOLS_PORT` | `3030` | Server port |
| `CUETOOLS_MIDI_DEVICE` | `/dev/snd/midiC1D0` | MIDI input device |
| `CUETOOLS_MIDI_CHANNEL` | `14` | MIDI channel (0-indexed, 14 = ch 15) |
| `CUETOOLS_QLC_URL` | `ws://localhost:9999/qlcplusWS` | QLC+ WebSocket URL |

## License

MIT
