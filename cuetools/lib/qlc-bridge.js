const { WebSocket } = require('ws');
const EventEmitter = require('events');

class QlcBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || 'ws://localhost:9999/qlcplusWS';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.connectDelay = options.connectDelay || 5000;
    this.ws = null;
    this.reconnectTimer = null;
    this.running = false;
  }

  start() {
    this.running = true;
    setTimeout(() => this._connect(), this.connectDelay);
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  _connect() {
    if (!this.running) return;
    if (this.isConnected()) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.emit('connected');
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      });

      this.ws.on('message', (data) => {
        const msg = data.toString();
        this.emit('message', msg);

        // Parse function list responses
        if (msg.startsWith('QLC+API|getFunctionsList')) {
          const parts = msg.split('|').slice(2);
          const functions = [];
          for (let i = 0; i < parts.length; i += 2) {
            functions.push({ id: parts[i], name: parts[i + 1] });
          }
          this.emit('functions-list', functions);
        }
      });

      this.ws.on('close', () => {
        this.ws = null;
        this.emit('disconnected');
        if (this.running && !this.reconnectTimer) {
          this.reconnectTimer = setInterval(() => this._connect(), this.reconnectInterval);
        }
      });

      this.ws.on('error', () => {
        this.ws = null;
      });
    } catch {
      this.ws = null;
    }
  }

  triggerFunction(functionId) {
    if (!this.isConnected()) return false;
    this.ws.send(`QLC+API|setFunctionStatus|${functionId}|1`);
    this.emit('function-triggered', functionId);
    return true;
  }

  stopFunction(functionId) {
    if (!this.isConnected()) return false;
    this.ws.send(`QLC+API|setFunctionStatus|${functionId}|0`);
    return true;
  }

  listFunctions() {
    if (!this.isConnected()) return false;
    this.ws.send('QLC+API|getFunctionsList');
    return true;
  }
}

module.exports = QlcBridge;
