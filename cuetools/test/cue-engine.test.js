const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const CueEngine = require('../lib/cue-engine');

function mockConfigStore(cues, boardName) {
  return {
    getActiveCues: () => cues,
    getActiveBoard: () => ({ name: boardName || 'TestBoard', cues }),
    get: () => ({
      activeBoard: 'test',
      boards: { test: { name: boardName || 'TestBoard', cues } }
    })
  };
}

function mockQlcBridge(connected) {
  const triggered = [];
  return {
    triggerFunction: (id) => {
      if (!connected) return false;
      triggered.push(id);
      return true;
    },
    isConnected: () => connected,
    _triggered: triggered
  };
}

function mockWebSocket() {
  const sent = [];
  return { readyState: 1, send: (data) => sent.push(data), _sent: sent, on: () => {} };
}

describe('CueEngine', () => {
  describe('trigger()', () => {
    it('broadcasts mapped cue to WebSocket clients', () => {
      const cues = { '1': { video: 'intro.mp4', label: 'Intro', qlcFunction: null } };
      const engine = new CueEngine(mockConfigStore(cues), mockQlcBridge(false));
      const ws = mockWebSocket();
      engine.addClient(ws);

      engine.trigger(1);

      assert.equal(ws._sent.length, 1);
      const msg = JSON.parse(ws._sent[0]);
      assert.equal(msg.type, 'play');
      assert.equal(msg.video, '/videos/intro.mp4');
      assert.equal(msg.label, 'Intro');
    });

    it('sends blackout for empty video', () => {
      const cues = { '0': { video: '', label: 'Blackout', qlcFunction: null } };
      const engine = new CueEngine(mockConfigStore(cues), mockQlcBridge(false));
      const ws = mockWebSocket();
      engine.addClient(ws);

      engine.trigger(0);

      const msg = JSON.parse(ws._sent[0]);
      assert.equal(msg.video, '');
      assert.equal(msg.label, 'Blackout');
    });

    it('sends unmapped response for missing cue', () => {
      const engine = new CueEngine(mockConfigStore({}), mockQlcBridge(false));
      const ws = mockWebSocket();
      engine.addClient(ws);

      engine.trigger(99);

      const msg = JSON.parse(ws._sent[0]);
      assert.equal(msg.video, '');
      assert.equal(msg.label, 'Unmapped');
    });

    it('triggers QLC+ function when mapped and connected', () => {
      const cues = { '1': { video: 'a.mp4', label: 'A', qlcFunction: 5 } };
      const qlc = mockQlcBridge(true);
      const engine = new CueEngine(mockConfigStore(cues), qlc);

      engine.trigger(1);

      assert.deepEqual(qlc._triggered, [5]);
    });

    it('skips QLC+ when not connected', () => {
      const cues = { '1': { video: 'a.mp4', label: 'A', qlcFunction: 5 } };
      const qlc = mockQlcBridge(false);
      const engine = new CueEngine(mockConfigStore(cues), qlc);

      engine.trigger(1);

      assert.deepEqual(qlc._triggered, []);
    });

    it('skips QLC+ when qlcFunction is null', () => {
      const cues = { '1': { video: 'a.mp4', label: 'A', qlcFunction: null } };
      const qlc = mockQlcBridge(true);
      const engine = new CueEngine(mockConfigStore(cues), qlc);

      engine.trigger(1);

      assert.deepEqual(qlc._triggered, []);
    });

    it('emits cue-triggered event', (_, done) => {
      const cues = { '1': { video: 'a.mp4', label: 'A', qlcFunction: null } };
      const engine = new CueEngine(mockConfigStore(cues, 'Live'), mockQlcBridge(false));

      engine.on('cue-triggered', (pc, cue, boardName) => {
        assert.equal(pc, 1);
        assert.equal(cue.label, 'A');
        assert.equal(boardName, 'Live');
        done();
      });

      engine.trigger(1);
    });

    it('does not send to closed WebSocket clients', () => {
      const engine = new CueEngine(mockConfigStore({ '1': { video: 'a.mp4', label: 'A', qlcFunction: null } }), mockQlcBridge(false));
      const closed = { readyState: 3, send: () => { throw new Error('should not send'); }, on: () => {} };
      engine.addClient(closed);

      // Should not throw
      engine.trigger(1);
    });
  });

  describe('addClient() / clientCount', () => {
    it('tracks connected clients', () => {
      const engine = new CueEngine(mockConfigStore({}), mockQlcBridge(false));
      assert.equal(engine.clientCount, 0);

      const ws = new EventEmitter();
      ws.readyState = 1;
      engine.addClient(ws);
      assert.equal(engine.clientCount, 1);

      ws.emit('close');
      assert.equal(engine.clientCount, 0);
    });
  });

  describe('getStatus()', () => {
    it('returns current status', () => {
      const cues = { '0': { video: '', label: 'BL', qlcFunction: null }, '1': { video: 'a.mp4', label: 'A', qlcFunction: 5 } };
      const engine = new CueEngine(mockConfigStore(cues), mockQlcBridge(true));
      const ws = mockWebSocket();
      engine.addClient(ws);

      const status = engine.getStatus();
      assert.equal(status.connectedClients, 1);
      assert.equal(status.activeBoard, 'test');
      assert.equal(status.activeBoardName, 'TestBoard');
      assert.equal(status.cueCount, 2);
      assert.equal(status.boardCount, 1);
      assert.equal(status.qlcConnected, true);
    });
  });
});
