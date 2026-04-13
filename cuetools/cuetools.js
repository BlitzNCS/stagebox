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
const createLogger = require('./lib/logger');

const log = createLogger('server');

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

// ─── Security settings ─────────────────────────────────────────
const API_TOKEN = process.env.CUETOOLS_API_TOKEN || '';
const MAX_BODY_SIZE = parseInt(process.env.CUETOOLS_MAX_BODY, 10) || 1024 * 512; // 512 KB
const REQUEST_TIMEOUT = parseInt(process.env.CUETOOLS_REQUEST_TIMEOUT, 10) || 30000; // 30s

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

// ─── Helpers ───────────────────────────────────────────────────
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function checkAuth(req) {
  if (!API_TOKEN) return true;
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === API_TOKEN;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT);

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        clearTimeout(timer);
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      clearTimeout(timer);
      resolve(body);
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ─── HTTP Server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // UI routes (no auth required)
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

  // Auth check for API routes
  if (url.pathname.startsWith('/api/') && !checkAuth(req)) {
    jsonResponse(res, 401, { error: 'Unauthorized' });
    return;
  }

  // API: config
  if (url.pathname === '/api/config' && req.method === 'GET') {
    jsonResponse(res, 200, configStore.get());
    return;
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const error = configStore.validate(parsed);
      if (error) {
        jsonResponse(res, 400, { error });
        return;
      }
      configStore.set(parsed);
      jsonResponse(res, 200, { ok: true });
    } catch (e) {
      jsonResponse(res, 400, { error: e.message });
    }
    return;
  }

  // API: switch board
  if (url.pathname === '/api/board' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { boardId } = JSON.parse(body);
      if (configStore.switchBoard(boardId)) {
        const board = configStore.getActiveBoard();
        log.info(`Switched to: ${board.name}`);
        jsonResponse(res, 200, { ok: true });
      } else {
        jsonResponse(res, 404, { error: 'board not found' });
      }
    } catch (e) {
      jsonResponse(res, 400, { error: e.message });
    }
    return;
  }

  // API: list videos
  if (url.pathname === '/api/videos') {
    const files = await videoServer.listFiles();
    jsonResponse(res, 200, files);
    return;
  }

  // API: test trigger
  if (url.pathname.startsWith('/api/trigger/')) {
    const pc = parseInt(url.pathname.split('/').pop(), 10);
    if (isNaN(pc) || pc < 0 || pc > 127) {
      jsonResponse(res, 400, { error: 'Invalid program change (0-127)' });
      return;
    }
    cueEngine.trigger(pc);
    jsonResponse(res, 200, { triggered: pc });
    return;
  }

  // API: status
  if (url.pathname === '/api/status') {
    const status = cueEngine.getStatus();
    status.midiDevice = MIDI_DEVICE;
    status.midiChannel = MIDI_CHANNEL + 1;
    status.version = require('./package.json').version;
    jsonResponse(res, 200, status);
    return;
  }

  // API: QLC+ functions
  if (url.pathname === '/api/qlc/functions') {
    const sent = qlcBridge.listFunctions();
    jsonResponse(res, 200, sent
      ? { ok: true, note: 'Check server console for function list' }
      : { ok: false, error: 'QLC+ not connected' }
    );
    return;
  }

  // Video streaming (no auth — player needs direct access)
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
midiListener.on('connected', (dev, ch) => log.info(`MIDI listening on ${dev} (channel ${ch + 1})`));
midiListener.on('waiting', dev => log.warn(`MIDI device ${dev} not found, retrying...`));
midiListener.on('disconnected', dev => log.warn(`MIDI device ${dev} disconnected, retrying...`));

// ─── Wire up QLC+ logging ──────────────────────────────────────
qlcBridge.on('connected', () => log.info('QLC+ connected'));
qlcBridge.on('disconnected', () => log.warn('QLC+ disconnected'));
qlcBridge.on('functions-list', fns => {
  log.info('QLC+ functions:');
  fns.forEach(f => log.info(`  ID ${f.id}: ${f.name}`));
});

// ─── Start everything ──────────────────────────────────────────
server.listen(HTTP_PORT, '0.0.0.0', () => {
  const board = configStore.getActiveBoard();
  log.info(`CueTools v${require('./package.json').version}`);
  log.info(`  Board: ${board?.name || 'None'} | MIDI Ch ${MIDI_CHANNEL + 1}`);
  log.info(`  CuePlayer: http://0.0.0.0:${HTTP_PORT}/stage`);
  log.info(`  CueDeck:   http://0.0.0.0:${HTTP_PORT}/deck`);
  if (API_TOKEN) log.info('  API token auth: enabled');
});

qlcBridge.start();
midiListener.start();
