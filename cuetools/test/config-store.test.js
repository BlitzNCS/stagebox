const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ConfigStore = require('../lib/config-store');

let tmpDir, configPath, store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuetools-test-'));
  configPath = path.join(tmpDir, 'cues.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ConfigStore', () => {
  describe('load()', () => {
    it('creates default config when file does not exist', () => {
      store = new ConfigStore(configPath);
      const cfg = store.load();
      assert.equal(cfg.activeBoard, 'default');
      assert.ok(cfg.boards.default);
      assert.equal(cfg.boards.default.name, 'Default');
      // Should have written the file
      assert.ok(fs.existsSync(configPath));
    });

    it('loads existing config from disk', () => {
      const existing = {
        activeBoard: 'myband',
        boards: {
          myband: { name: 'My Band', cues: { '1': { video: 'a.mp4', label: 'Song A', qlcFunction: null } } }
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(existing));
      store = new ConfigStore(configPath);
      const cfg = store.load();
      assert.equal(cfg.activeBoard, 'myband');
      assert.equal(cfg.boards.myband.cues['1'].label, 'Song A');
    });

    it('migrates legacy flat-cue format', () => {
      const legacy = { cues: { '0': { video: '', label: 'Blackout', qlcFunction: null } } };
      fs.writeFileSync(configPath, JSON.stringify(legacy));
      store = new ConfigStore(configPath);
      const cfg = store.load();
      assert.equal(cfg.activeBoard, 'default');
      assert.ok(cfg.boards.default);
      assert.equal(cfg.boards.default.cues['0'].label, 'Blackout');
    });

    it('falls back to defaults on corrupt JSON', () => {
      fs.writeFileSync(configPath, '{ broken json !!!');
      store = new ConfigStore(configPath);
      const cfg = store.load();
      assert.equal(cfg.activeBoard, 'default');
    });
  });

  describe('save()', () => {
    it('persists config to disk', () => {
      store = new ConfigStore(configPath);
      store.load();
      store.config.boards.default.cues['5'] = { video: 'test.mp4', label: 'Test', qlcFunction: 3 };
      store.save();

      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.equal(raw.boards.default.cues['5'].label, 'Test');
    });

    it('emits saved event', (_, done) => {
      store = new ConfigStore(configPath);
      store.load();
      store.on('saved', (cfg) => {
        assert.ok(cfg.boards);
        done();
      });
      store.save();
    });

    it('creates parent directory if missing', () => {
      const nested = path.join(tmpDir, 'sub', 'dir', 'cues.json');
      store = new ConfigStore(nested);
      store.load();
      assert.ok(fs.existsSync(nested));
    });
  });

  describe('switchBoard()', () => {
    it('switches to an existing board', () => {
      store = new ConfigStore(configPath);
      store.load();
      store.config.boards.second = { name: 'Second', cues: {} };
      const result = store.switchBoard('second');
      assert.equal(result, true);
      assert.equal(store.config.activeBoard, 'second');
    });

    it('returns false for non-existent board', () => {
      store = new ConfigStore(configPath);
      store.load();
      const result = store.switchBoard('nonexistent');
      assert.equal(result, false);
    });

    it('emits board-switched event', (_, done) => {
      store = new ConfigStore(configPath);
      store.load();
      store.config.boards.other = { name: 'Other', cues: {} };
      store.on('board-switched', (id, board) => {
        assert.equal(id, 'other');
        assert.equal(board.name, 'Other');
        done();
      });
      store.switchBoard('other');
    });
  });

  describe('getActiveBoard()', () => {
    it('returns the active board', () => {
      store = new ConfigStore(configPath);
      store.load();
      const board = store.getActiveBoard();
      assert.equal(board.name, 'Default');
    });

    it('returns null for invalid activeBoard', () => {
      store = new ConfigStore(configPath);
      store.load();
      store.config.activeBoard = 'missing';
      assert.equal(store.getActiveBoard(), null);
    });
  });

  describe('getActiveCues()', () => {
    it('returns cues from active board', () => {
      store = new ConfigStore(configPath);
      store.load();
      const cues = store.getActiveCues();
      assert.ok(cues['0']);
      assert.equal(cues['0'].label, 'Blackout');
    });

    it('returns empty object when board missing', () => {
      store = new ConfigStore(configPath);
      store.load();
      store.config.activeBoard = 'ghost';
      const cues = store.getActiveCues();
      assert.deepEqual(cues, {});
    });
  });

  describe('validate()', () => {
    it('accepts valid config', () => {
      store = new ConfigStore(configPath);
      const cfg = {
        activeBoard: 'default',
        boards: {
          default: {
            name: 'Default',
            cues: { '0': { video: '', label: 'Blackout', qlcFunction: null } }
          }
        }
      };
      assert.equal(store.validate(cfg), null);
    });

    it('rejects non-object config', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate(null));
      assert.ok(store.validate('string'));
      assert.ok(store.validate(42));
    });

    it('rejects missing activeBoard', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({ boards: {} }));
    });

    it('rejects empty boards', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({ activeBoard: 'x', boards: {} }));
    });

    it('rejects activeBoard not in boards', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({
        activeBoard: 'missing',
        boards: { default: { name: 'Default', cues: {} } }
      }));
    });

    it('rejects board without name', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({
        activeBoard: 'x',
        boards: { x: { cues: {} } }
      }));
    });

    it('rejects cue key out of range', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({
        activeBoard: 'x',
        boards: { x: { name: 'X', cues: { '200': { video: '', label: 'Bad', qlcFunction: null } } } }
      }));
    });

    it('rejects cue with wrong video type', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({
        activeBoard: 'x',
        boards: { x: { name: 'X', cues: { '1': { video: 123, label: 'Bad', qlcFunction: null } } } }
      }));
    });

    it('rejects cue with wrong qlcFunction type', () => {
      store = new ConfigStore(configPath);
      assert.ok(store.validate({
        activeBoard: 'x',
        boards: { x: { name: 'X', cues: { '1': { video: '', label: 'Bad', qlcFunction: 'not a number' } } } }
      }));
    });

    it('allows qlcFunction to be null', () => {
      store = new ConfigStore(configPath);
      assert.equal(store.validate({
        activeBoard: 'x',
        boards: { x: { name: 'X', cues: { '1': { video: '', label: 'OK', qlcFunction: null } } } }
      }), null);
    });
  });
});
