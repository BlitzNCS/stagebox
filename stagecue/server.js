const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

// ─── Config ─────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'videocues.json');
const MIDI_DEVICE = '/dev/snd/midiC1D0';
const MIDI_CHANNEL = 14; // 0-indexed, so 14 = MIDI channel 15
const HTTP_PORT = 3030;
const VIDEO_DIR = path.join(__dirname, 'videos');
const QLC_WS_URL = 'ws://localhost:9999/qlcplusWS';

let config = { activeBoard: 'default', boards: {} };
try {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  if (raw.cues && !raw.boards) {
    config = { activeBoard: 'default', boards: { 'default': { name: 'Default', cues: raw.cues } } };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } else {
    config = raw;
  }
} catch (e) {
  config = {
    activeBoard: 'default',
    boards: { 'default': { name: 'Default', cues: { "0": { "video": "", "label": "Blackout" } } } }
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function saveConfig() { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
function getActiveCues() { const b = config.boards[config.activeBoard]; return b ? b.cues : {}; }

// ─── HTTP Server ────────────────────────────────────────────────
let playerHtml, configHtml;
try { playerHtml = fs.readFileSync(path.join(__dirname, 'player.html'), 'utf-8'); } catch(e) { playerHtml = '<h1>player.html not found</h1>'; }
try { configHtml = fs.readFileSync(path.join(__dirname, 'config.html'), 'utf-8'); } catch(e) { configHtml = '<h1>config.html not found</h1>'; }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/stage') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(playerHtml); return; }
  if (url.pathname === '/config') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(configHtml); return; }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(config)); return;
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { config = JSON.parse(body); saveConfig(); res.writeHead(200); res.end('{"ok":true}'); } catch(e) { res.writeHead(400); res.end(`{"error":"${e.message}"}`); } });
    return;
  }
  if (url.pathname === '/api/board' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { const { boardId } = JSON.parse(body); if (config.boards[boardId]) { config.activeBoard = boardId; saveConfig(); console.log(`Switched to: ${config.boards[boardId].name}`); res.writeHead(200); res.end('{"ok":true}'); } else { res.writeHead(404); res.end('{"error":"not found"}'); } } catch(e) { res.writeHead(400); res.end(`{"error":"${e.message}"}`); } });
    return;
  }
  if (url.pathname === '/api/videos') {
    try { const files = fs.readdirSync(VIDEO_DIR).filter(f => /\.(mp4|mov|webm|mkv)$/i.test(f)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(files)); }
    catch(e) { res.writeHead(200); res.end('[]'); } return;
  }
  if (url.pathname.startsWith('/api/trigger/')) {
    const pc = url.pathname.split('/').pop(); triggerCue(parseInt(pc));
    res.writeHead(200); res.end(`{"triggered":${pc}}`); return;
  }
  if (url.pathname === '/api/status') {
    const b = config.boards[config.activeBoard];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ midiChannel: MIDI_CHANNEL+1, connectedClients: clients.size, activeBoard: config.activeBoard, activeBoardName: b?.name, cueCount: b ? Object.keys(b.cues).length : 0, boardCount: Object.keys(config.boards).length, qlcConnected: qlcWs && qlcWs.readyState === WebSocket.OPEN }));
    return;
  }
  if (url.pathname === '/api/qlc/functions') {
    listQLCFunctions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true,"note":"Check server console for function list"}');
    return;
  }
  if (url.pathname.startsWith('/videos/')) {
    const filePath = path.join(VIDEO_DIR, path.basename(url.pathname));
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath); const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10); const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end-start+1, 'Content-Type': 'video/mp4' });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else { res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' }); fs.createReadStream(filePath).pipe(res); }
      return;
    }
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  const b = config.boards[config.activeBoard];
  console.log(`StageCue v1.1 - MIDI Ch ${MIDI_CHANNEL+1} - Board: ${b?.name || 'None'}`);
  console.log(`  Stage: http://0.0.0.0:${HTTP_PORT}/stage | Config: http://0.0.0.0:${HTTP_PORT}/config`);
});

// ─── WebSocket ──────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const clients = new Set();
wss.on('connection', ws => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });

function triggerCue(programChange) {
  const cues = getActiveCues(); const cue = cues[String(programChange)];
  const msg = cue ? { type:'play', video: cue.video ? `/videos/${cue.video}` : '', label: cue.label } : { type:'play', video:'', label:'Unmapped' };
  const bn = config.boards[config.activeBoard]?.name || '?';
  console.log(`[${bn}] PC ${programChange} → ${cue ? cue.label : 'unmapped'}`);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); });
  if (cue?.qlcFunction) triggerQLC(cue.qlcFunction);
}

// ─── QLC+ WebSocket Connection ─────────────────────────────────
let qlcWs = null;
let qlcReconnectTimer = null;

function connectQLC() {
  if (qlcWs && qlcWs.readyState === WebSocket.OPEN) return;

  try {
    qlcWs = new WebSocket(QLC_WS_URL);

    qlcWs.on('open', () => {
      console.log('QLC+ WebSocket connected');
      if (qlcReconnectTimer) { clearInterval(qlcReconnectTimer); qlcReconnectTimer = null; }
    });

    qlcWs.on('message', (data) => {
      const msg = data.toString();
      // Log QLC+ responses for debugging
      if (msg.startsWith('QLC+API|getFunctionsList')) {
        const parts = msg.split('|').slice(2);
        console.log('QLC+ functions:');
        for (let i = 0; i < parts.length; i += 2) {
          console.log(`  ID ${parts[i]}: ${parts[i+1]}`);
        }
      }
    });

    qlcWs.on('close', () => {
      console.log('QLC+ WebSocket disconnected');
      qlcWs = null;
      if (!qlcReconnectTimer) {
        qlcReconnectTimer = setInterval(connectQLC, 5000);
      }
    });

    qlcWs.on('error', () => {
      qlcWs = null;
    });
  } catch (e) {
    qlcWs = null;
  }
}

function triggerQLC(fid) {
  if (!qlcWs || qlcWs.readyState !== WebSocket.OPEN) {
    console.log(`  QLC+ not connected, skipping function ${fid}`);
    return;
  }
  // setFunctionStatus: 1 = start, 0 = stop
  qlcWs.send(`QLC+API|setFunctionStatus|${fid}|1`);
  console.log(`  QLC+ function ${fid} triggered`);
}

function stopQLCFunction(fid) {
  if (!qlcWs || qlcWs.readyState !== WebSocket.OPEN) return;
  qlcWs.send(`QLC+API|setFunctionStatus|${fid}|0`);
}

function listQLCFunctions() {
  if (!qlcWs || qlcWs.readyState !== WebSocket.OPEN) return;
  qlcWs.send('QLC+API|getFunctionsList');
}

// Connect to QLC+ after a short delay (give it time to start)
setTimeout(connectQLC, 5000);

// ─── MIDI Reader ────────────────────────────────────────────────
function startMidi() {
  if (!fs.existsSync(MIDI_DEVICE)) { setTimeout(startMidi, 5000); return; }
  const midi = fs.createReadStream(MIDI_DEVICE); let expecting = null;
  midi.on('data', data => {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      if (byte === (0xC0 | MIDI_CHANNEL)) { expecting = 'program'; continue; }
      if ((byte & 0xF0) === 0xC0) { expecting = null; continue; }
      if (expecting === 'program' && byte <= 127) { triggerCue(byte); expecting = null; continue; }
      if (byte >= 0x80) expecting = null;
    }
  });
  midi.on('error', () => { setTimeout(startMidi, 5000); });
  console.log(`Listening for MIDI PC on channel ${MIDI_CHANNEL+1}`);
}
startMidi();
