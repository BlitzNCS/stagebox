const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

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
        this.config = {
          activeBoard: 'default',
          boards: { default: { name: 'Default', cues: raw.cues } }
        };
        this.save();
      } else {
        this.config = raw;
      }
    } catch {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.save();
    }
    return this.config;
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    this.emit('saved', this.config);
  }

  get() {
    return this.config;
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
