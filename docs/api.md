# CueTools API Reference

CueTools exposes an HTTP REST API and a WebSocket interface. Default port: `3030`.

## Authentication

API endpoints (`/api/*`) can be protected with token authentication. Set `CUETOOLS_API_TOKEN` to enable.

When enabled, include the token in every API request:

```
Authorization: Bearer <your-token>
```

**Unprotected routes** (no auth required):
- UI pages: `/`, `/stage`, `/config`, `/deck`
- Video streaming: `/videos/*`
- WebSocket connections

When `CUETOOLS_API_TOKEN` is not set (default), all endpoints are open.

## HTTP Endpoints

### Pages

| Method | Path | Description |
|---|---|---|
| GET | `/` or `/stage` | CuePlayer — fullscreen video output |
| GET | `/config` or `/deck` | CueDeck — configuration dashboard |

### Configuration API

#### `GET /api/config`

Returns the full configuration object.

**Response:**
```json
{
  "activeBoard": "default",
  "boards": {
    "default": {
      "name": "Default",
      "cues": {
        "0": { "video": "", "label": "Blackout", "qlcFunction": null },
        "1": { "video": "intro.mp4", "label": "Intro", "qlcFunction": 5 }
      }
    }
  }
}
```

#### `POST /api/config`

Replaces the entire configuration. Body must be a valid config JSON object. The config is validated before saving — invalid structure returns a `400` with an error message.

**Validation rules:**
- `activeBoard` must be a non-empty string
- `boards` must be a non-empty object
- `activeBoard` must reference an existing board
- Each board must have `name` (string) and `cues` (object)
- Cue keys must be integers 0-127
- Each cue must have `video` (string), `label` (string), `qlcFunction` (number or null)

**Request body:** Full config object (same format as GET response)

**Response:** `{"ok": true}` or `{"error": "description"}` (400)

#### `POST /api/board`

Switches the active board.

**Request body:**
```json
{ "boardId": "timeless" }
```

**Response:** `{"ok": true}` or `{"error": "board not found"}` (404)

### Video API

#### `GET /api/videos`

Lists all video files in the video directory.

**Response:**
```json
["intro.mp4", "song1.mp4", "logo.webm"]
```

#### `GET /videos/{filename}`

Streams a video file. Supports HTTP Range requests for seeking.

**Headers:** Standard video streaming headers including `Content-Range` for partial content.

**Error responses:**
- `404` — file not found
- `416` — range not satisfiable

### Control API

#### `GET /api/trigger/{pc}`

Manually triggers a cue by MIDI Program Change number (0-127). Useful for testing.

**Response:** `{"triggered": 4}` or `{"error": "Invalid program change (0-127)"}` (400)

#### `GET /api/status`

Returns server status and health information.

**Response:**
```json
{
  "version": "2.1.0",
  "midiDevice": "/dev/snd/midiC1D0",
  "midiChannel": 15,
  "connectedClients": 1,
  "activeBoard": "default",
  "activeBoardName": "Default",
  "cueCount": 5,
  "boardCount": 2,
  "qlcConnected": true
}
```

### QLC+ API

#### `GET /api/qlc/functions`

Requests QLC+ to send its function list. Results are logged to the server console.

**Response:** `{"ok": true}` or `{"ok": false, "error": "QLC+ not connected"}`

## CORS

All API endpoints include `Access-Control-Allow-Origin: *` headers. Preflight `OPTIONS` requests are handled automatically with the correct `Allow-Methods` and `Allow-Headers`.

## Request Limits

- **Max body size:** 512 KB (configurable via `CUETOOLS_MAX_BODY`)
- **Request timeout:** 30 seconds (configurable via `CUETOOLS_REQUEST_TIMEOUT`)

## WebSocket Interface

CuePlayer connects to the WebSocket server at the same port as HTTP. The server broadcasts cue commands to all connected clients.

### Messages (Server → Client)

#### Play Video
```json
{ "type": "play", "video": "/videos/intro.mp4", "label": "Intro" }
```

#### Blackout
```json
{ "type": "play", "video": "", "label": "Blackout" }
```

### Connection

```javascript
const ws = new WebSocket(`ws://${host}:3030`);
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'play') {
    // Handle video playback or blackout
  }
};
```

## QLC+ WebSocket Protocol

CueTools connects as a client to QLC+ at `ws://localhost:9999/qlcplusWS`. Messages use a pipe-delimited format.

### Trigger a lighting function
```
QLC+API|setFunctionStatus|{functionId}|1
```

### Stop a lighting function
```
QLC+API|setFunctionStatus|{functionId}|0
```

### List all functions
```
Send:    QLC+API|getFunctionsList
Receive: QLC+API|getFunctionsList|0|Scene 1|1|Chase 1|...
```

Function IDs are paired with names in the response. Use these IDs in cue configuration.
