#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const ConfigStore = require('./lib/config-store');
const MidiListener = require('./lib/midi-listener');
const QlcBridge = require('./lib/qlc-bridge');
const VideoServer = require('./lib/video-server');
const CueEngine = require('./lib/cue-engine');

// ─── Resolve paths ─────────────────────────────────────────────
const BASE_DIR = process.env.CUETOOLS_BASE || __dirname;
const CONFIG_PATH = process.env.CUETOOLS_CONFIG || path.join(BASE_DIR, 'config', 'cues.json');
const VIDEO_DIR = process.env.CUETOOLS_VIDEOS || path.join(BASE_DIR, 'videos');
const UI_DIR = process.env.CUETOOLS_UI || path.join(BASE_DIR, 'ui');

// ─── Settings (env-overridable for platform flexibility) ───────
const HTTP_PORT = parseInt(process.env.CUETOOLS_PORT, 10) || 3030;
const MIDI_DEVICE = process.env.CUETOOLS_MIDI_DEVICE || '/dev/snd/midiC1D0';
const MIDI_CHANNEL = parseInt(process.env.CUETOOLS_MIDI_CHANNEL, 10) ?? 14;
const QLC_URL = process.env.CUETOOLS_QLC_URL || 'ws://localhost:9999/qlcplusWS';

// ─── Initialise modules ────────────────────────────────────────
const configStore = new ConfigStore(CONFIG_PATH);
configStore.load();

const qlcBridge = new QlcBridge({ url: QLC_URL });
const videoServer = new VideoServer(VIDEO_DIR);
const cueEngine = new CueEngine(configStore, qlcBridge);
const midiListener = new MidiListener({ device: MIDI_DEVICE, channel: MIDI_CHANNEL });

// ─── Load UI files ─────────────────────────────────────────────
let playerHtml, deckHtml;
try { playerHtml = fs.readFileSync(path.join(UI_DIR, 'cue-player.html'), 'utf-8'); } catch { playerHtml = '<h1>CuePlayer not found</h1>'; }
try { deckHtml = fs.readFileSync(path.join(UI_DIR, 'cue-deck.html'), 'utf-8'); } catch { deckHtml = '<h1>CueDeck not found</h1>'; }

// ─── HTTP Server ───────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // UI routes
  if (url.pathname === '/' || url.pathname === '/stage') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(playerHtml);
    return;
  }
  if (url.pathname === '/config' || url.pathname === '/deck') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(deckHtml);
    return;
  }

  // API: config
  if (url.pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(configStore.get()));
    return;
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        configStore.set(JSON.parse(body));
        res.writeHead(200);
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end(`{"error":"${e.message}"}`);
      }
    });
    return;
  }

  // API: switch board
  if (url.pathname === '/api/board' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { boardId } = JSON.parse(body);
        if (configStore.switchBoard(boardId)) {
          const board = configStore.getActiveBoard();
          console.log(`Switched to: ${board.name}`);
          res.writeHead(200);
          res.end('{"ok":true}');
        } else {
          res.writeHead(404);
          res.end('{"error":"board not found"}');
        }
      } catch (e) {
        res.writeHead(400);
        res.end(`{"error":"${e.message}"}`);
      }
    });
    return;
  }

  // API: list videos
  if (url.pathname === '/api/videos') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(videoServer.listFiles()));
    return;
  }

  // API: test trigger
  if (url.pathname.startsWith('/api/trigger/')) {
    const pc = parseInt(url.pathname.split('/').pop(), 10);
    cueEngine.trigger(pc);
    res.writeHead(200);
    res.end(`{"triggered":${pc}}`);
    return;
  }

  // API: status
  if (url.pathname === '/api/status') {
    const status = cueEngine.getStatus();
    status.midiDevice = MIDI_DEVICE;
    status.midiChannel = MIDI_CHANNEL + 1;
    status.version = require('./package.json').version;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  // API: QLC+ functions
  if (url.pathname === '/api/qlc/functions') {
    const sent = qlcBridge.listFunctions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(sent
      ? '{"ok":true,"note":"Check server console for function list"}'
      : '{"ok":false,"error":"QLC+ not connected"}'
    );
    return;
  }

  // Video streaming
  if (url.pathname.startsWith('/videos/')) {
    videoServer.handleRequest(req, res, url.pathname.replace('/videos/', ''));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ─── WebSocket ─────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
wss.on('connection', ws => cueEngine.addClient(ws));

// ─── Wire up MIDI → CueEngine ─────────────────────────────────
midiListener.on('program-change', pc => cueEngine.trigger(pc));
midiListener.on('connected', (dev, ch) => console.log(`MIDI listening on ${dev} (channel ${ch + 1})`));
midiListener.on('waiting', dev => console.log(`MIDI device ${dev} not found, retrying...`));
midiListener.on('disconnected', dev => console.log(`MIDI device ${dev} disconnected, retrying...`));

// ─── Wire up QLC+ logging ──────────────────────────────────────
qlcBridge.on('connected', () => console.log('QLC+ connected'));
qlcBridge.on('disconnected', () => console.log('QLC+ disconnected'));
qlcBridge.on('functions-list', fns => {
  console.log('QLC+ functions:');
  fns.forEach(f => console.log(`  ID ${f.id}: ${f.name}`));
});

// ─── Start everything ──────────────────────────────────────────
server.listen(HTTP_PORT, '0.0.0.0', () => {
  const board = configStore.getActiveBoard();
  console.log(`CueTools v${require('./package.json').version}`);
  console.log(`  Board: ${board?.name || 'None'} | MIDI Ch ${MIDI_CHANNEL + 1}`);
  console.log(`  CuePlayer: http://0.0.0.0:${HTTP_PORT}/stage`);
  console.log(`  CueDeck:   http://0.0.0.0:${HTTP_PORT}/deck`);
});

qlcBridge.start();
midiListener.start();
