const EventEmitter = require('events');

class CueEngine extends EventEmitter {
  constructor(configStore, qlcBridge) {
    super();
    this.configStore = configStore;
    this.qlcBridge = qlcBridge;
    this.clients = new Set();
  }

  addClient(ws) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  get clientCount() {
    return this.clients.size;
  }

  trigger(programChange) {
    const cues = this.configStore.getActiveCues();
    const cue = cues[String(programChange)];
    const board = this.configStore.getActiveBoard();
    const boardName = board?.name || '?';

    const msg = cue
      ? { type: 'play', video: cue.video ? `/videos/${cue.video}` : '', label: cue.label }
      : { type: 'play', video: '', label: 'Unmapped' };

    console.log(`[${boardName}] PC ${programChange} → ${cue ? cue.label : 'unmapped'}`);

    // Broadcast to all connected CuePlayer clients
    const payload = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }

    // Trigger QLC+ lighting function if mapped
    if (cue?.qlcFunction) {
      const sent = this.qlcBridge.triggerFunction(cue.qlcFunction);
      if (!sent) {
        console.log(`  QLC+ not connected, skipping function ${cue.qlcFunction}`);
      } else {
        console.log(`  QLC+ function ${cue.qlcFunction} triggered`);
      }
    }

    this.emit('cue-triggered', programChange, cue, boardName);
  }

  getStatus() {
    const config = this.configStore.get();
    const board = this.configStore.getActiveBoard();
    return {
      connectedClients: this.clientCount,
      activeBoard: config.activeBoard,
      activeBoardName: board?.name,
      cueCount: board ? Object.keys(board.cues).length : 0,
      boardCount: Object.keys(config.boards).length,
      qlcConnected: this.qlcBridge.isConnected()
    };
  }
}

module.exports = CueEngine;
