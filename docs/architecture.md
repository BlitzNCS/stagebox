# CueTools Architecture

## Overview

CueTools is a MIDI-triggered cue system for live performance. It receives MIDI Program Change messages and simultaneously triggers video playback and lighting changes.

```
MIDI Source (e.g. iPad + mixer)
  │
  │  MIDI Program Change on Channel 15
  ▼
┌─────────────────────────────────────────┐
│           CueTools Server               │
│                                         │
│  ┌─────────────┐   ┌────────────────┐  │
│  │ MidiListener │──▶│   CueEngine    │  │
│  └─────────────┘   │                │  │
│                     │  Looks up PC#  │  │
│                     │  in ConfigStore│  │
│                     │                │  │
│  ┌─────────────┐   │  Dispatches to:│  │
│  │ ConfigStore  │──▶│  - CuePlayer   │  │
│  │ (cues.json)  │   │  - QlcBridge   │  │
│  └─────────────┘   └───┬────────┬───┘  │
│                         │        │      │
│  ┌─────────────┐        │        │      │
│  │ VideoServer  │        │        │      │
│  │ (file serve) │        │        │      │
│  └─────────────┘        │        │      │
│                         │        │      │
│  ┌─────────────┐        │        │      │
│  │ Logger       │ (all modules)   │      │
│  └─────────────┘        │        │      │
└─────────────────────────┼────────┼──────┘
                          │        │
                ┌─────────┘        └──────────┐
                ▼                              ▼
        WebSocket to                   WebSocket to
        Chrome/CuePlayer               QLC+ (port 9999)
                │                              │
                ▼                              ▼
          HDMI Output                    /dev/ttyUSB0
          (projector)                    (DMX lights)
```

## Module Breakdown

### CueEngine (`lib/cue-engine.js`)
The central coordinator. Receives program change events, looks up the corresponding cue in the active board, and dispatches:
- Video commands to connected CuePlayer clients via WebSocket
- Lighting triggers to QLC+ via the QlcBridge

### MidiListener (`lib/midi-listener.js`)
Reads raw MIDI bytes from a device file (e.g. `/dev/snd/midiC1D0`). Parses Program Change messages on the configured channel and emits `program-change` events. Handles device not-found and disconnection with automatic retry.

### QlcBridge (`lib/qlc-bridge.js`)
WebSocket client that connects to QLC+'s web API (`ws://localhost:9999/qlcplusWS`). Sends pipe-delimited commands to start/stop lighting functions. Auto-reconnects on disconnect.

### ConfigStore (`lib/config-store.js`)
Manages the cue configuration JSON file. Supports multiple "boards" (cue sets), allowing different video/lighting mappings for different bands or shows. Handles config loading, saving, migration from legacy format, board switching, and schema validation.

### VideoServer (`lib/video-server.js`)
Serves video files over HTTP with range request support (for seeking). Lists available video files and auto-detects MIME types. All file I/O is async to avoid blocking the event loop.

### Logger (`lib/logger.js`)
Structured logging with ISO 8601 timestamps, log levels (error, warn, info, debug), and module tags. All modules use the logger for consistent, filterable output. Log level is controlled via `CUETOOLS_LOG_LEVEL` environment variable.

## Security

### API Authentication
API endpoints can be protected with token-based authentication. Set `CUETOOLS_API_TOKEN` to enable. When set, all `/api/*` requests must include an `Authorization: Bearer <token>` header.

UI routes (`/`, `/stage`, `/config`, `/deck`) and video streaming (`/videos/*`) are not protected — the CuePlayer needs direct access to function.

### Input Validation
- POST request bodies are limited to 512 KB (configurable via `CUETOOLS_MAX_BODY`)
- Request bodies have a 30-second timeout (configurable via `CUETOOLS_REQUEST_TIMEOUT`)
- Config objects are validated against a schema before saving (structure, types, PC range 0-127)
- All JSON responses use `JSON.stringify()` to prevent injection
- Video filenames are sanitised via `path.basename()` to prevent path traversal
- CORS headers are applied consistently across all API endpoints

## UI Components

### CuePlayer (`ui/cue-player.html`)
Fullscreen video output designed for HDMI-connected displays. Receives WebSocket commands from CueEngine to play videos with crossfade transitions. Features:
- Dual `<video>` element crossfade (0.5s transition)
- Blackout support (fade to black)
- Auto-reconnect on WebSocket disconnect
- Wake lock to prevent screen dimming
- Fullscreen on click
- ARIA roles for accessibility

### CueDeck (`ui/cue-deck.html`)
Configuration dashboard accessed from a tablet/phone on the same network. Manages boards (cue sets), individual cues (MIDI PC → video + QLC+ function mapping), and provides a test trigger button for each cue. Features:
- Keyboard navigation and focus management
- ARIA labels, roles, and modal attributes
- Escape key to close modals

## Data Flow

1. **MIDI In** → MidiListener parses raw bytes → emits `program-change` event
2. **CueEngine** receives event → looks up PC number in active board's cue map
3. **Video** → CueEngine broadcasts `{type:'play', video:'/videos/file.mp4'}` to all WebSocket clients
4. **Lighting** → CueEngine calls `qlcBridge.triggerFunction(id)` → sends `QLC+API|setFunctionStatus|{id}|1`

## Configuration Format

```json
{
  "activeBoard": "timeless",
  "boards": {
    "timeless": {
      "name": "Timeless",
      "cues": {
        "1": { "video": "superstition.mp4", "label": "Superstition", "qlcFunction": 5 },
        "0": { "video": "", "label": "Blackout", "qlcFunction": null }
      }
    }
  }
}
```

- **Boards** are named cue sets (one per band/show)
- **Cues** are keyed by MIDI PC number (0-127)
- Empty `video` string triggers a blackout (fade to black)
- `qlcFunction` is the QLC+ function ID to trigger (null = no lighting change)

## Environment Variables

All settings can be overridden via environment variables for platform flexibility:

| Variable | Default | Description |
|---|---|---|
| `CUETOOLS_PORT` | `3030` | HTTP/WebSocket server port |
| `CUETOOLS_MIDI_DEVICE` | `/dev/snd/midiC1D0` | MIDI device file path |
| `CUETOOLS_MIDI_CHANNEL` | `14` | MIDI channel (0-indexed) |
| `CUETOOLS_QLC_URL` | `ws://localhost:9999/qlcplusWS` | QLC+ WebSocket URL |
| `CUETOOLS_BASE` | `__dirname` | Base directory for CueTools |
| `CUETOOLS_CONFIG` | `<base>/config/cues.json` | Config file path |
| `CUETOOLS_VIDEOS` | `<base>/videos` | Video directory path |
| `CUETOOLS_UI` | `<base>/ui` | UI files directory path |
| `CUETOOLS_API_TOKEN` | _(empty)_ | API auth token (empty = auth disabled) |
| `CUETOOLS_MAX_BODY` | `524288` | Max POST body size in bytes (512 KB) |
| `CUETOOLS_REQUEST_TIMEOUT` | `30000` | POST request timeout in ms |
| `CUETOOLS_LOG_LEVEL` | `info` | Log level: error, warn, info, debug |

## Testing

Tests use Node.js built-in test runner (`node:test`). Run with:

```bash
cd cuetools
npm test
```

Test coverage includes:
- **ConfigStore**: loading, saving, migration, board switching, schema validation
- **CueEngine**: triggering, WebSocket broadcast, QLC+ dispatch, status reporting
- **MidiListener**: MIDI byte parsing, channel filtering, reconnection
- **VideoServer**: file listing, streaming, range requests, path traversal prevention
- **QlcBridge**: connection state, function triggering
- **Logger**: module creation and output

## CI/CD

GitHub Actions runs on every push and pull request to `main`:
- **Test job**: runs `npm test` across Node.js 18, 20, and 22
- **Lint job**: runs ESLint on Node.js 22
