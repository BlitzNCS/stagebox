const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const createLogger = require('./logger');

const log = createLogger('config');

const DEFAULT_CONFIG = {
  activeBoard: 'default',
  boards: {
    default: {
      name: 'Default',
      cues: {
        '0': { video: '', label: 'Blackout', qlcFunction: null }
      }
    }
  }
};

class ConfigStore extends EventEmitter {
  constructor(configPath) {
    super();
    this.configPath = configPath;
    this.config = null;
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      // Migrate legacy flat-cue format to boards format
      if (raw.cues && !raw.boards) {
        log.info('Migrating legacy flat-cue config to boards format');
        this.config = {
          activeBoard: 'default',
          boards: { default: { name: 'Default', cues: raw.cues } }
        };
        this.save();
      } else {
        this.config = raw;
      }
    } catch (err) {
      log.warn(`Config load failed (${err.message}), using defaults`);
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.save();
    }
    return this.config;
  }

  save() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    this.emit('saved', this.config);
  }

  get() {
    return this.config;
  }

  validate(cfg) {
    if (!cfg || typeof cfg !== 'object') return 'Config must be an object';
    if (typeof cfg.activeBoard !== 'string' || !cfg.activeBoard) return 'activeBoard must be a non-empty string';
    if (!cfg.boards || typeof cfg.boards !== 'object') return 'boards must be an object';
    if (Object.keys(cfg.boards).length === 0) return 'At least one board is required';
    if (!cfg.boards[cfg.activeBoard]) return `activeBoard "${cfg.activeBoard}" does not exist in boards`;

    for (const [boardId, board] of Object.entries(cfg.boards)) {
      if (!board || typeof board !== 'object') return `Board "${boardId}" must be an object`;
      if (typeof board.name !== 'string' || !board.name) return `Board "${boardId}" must have a name`;
      if (!board.cues || typeof board.cues !== 'object') return `Board "${boardId}" must have a cues object`;

      for (const [pc, cue] of Object.entries(board.cues)) {
        const pcNum = parseInt(pc, 10);
        if (isNaN(pcNum) || pcNum < 0 || pcNum > 127) return `Board "${boardId}": cue key "${pc}" must be 0-127`;
        if (!cue || typeof cue !== 'object') return `Board "${boardId}" cue ${pc}: must be an object`;
        if (typeof cue.video !== 'string') return `Board "${boardId}" cue ${pc}: video must be a string`;
        if (typeof cue.label !== 'string') return `Board "${boardId}" cue ${pc}: label must be a string`;
        if (cue.qlcFunction !== null && typeof cue.qlcFunction !== 'number') {
          return `Board "${boardId}" cue ${pc}: qlcFunction must be a number or null`;
        }
      }
    }

    return null;
  }

  set(newConfig) {
    this.config = newConfig;
    this.save();
  }

  getActiveBoard() {
    return this.config.boards[this.config.activeBoard] || null;
  }

  getActiveCues() {
    const board = this.getActiveBoard();
    return board ? board.cues : {};
  }

  switchBoard(boardId) {
    if (!this.config.boards[boardId]) return false;
    this.config.activeBoard = boardId;
    this.save();
    this.emit('board-switched', boardId, this.config.boards[boardId]);
    return true;
  }
}

module.exports = ConfigStore;
