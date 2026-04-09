const fs = require('fs');
const EventEmitter = require('events');

class MidiListener extends EventEmitter {
  constructor(options = {}) {
    super();
    this.device = options.device || '/dev/snd/midiC1D0';
    this.channel = options.channel ?? 14; // 0-indexed (14 = MIDI channel 15)
    this.retryInterval = options.retryInterval || 5000;
    this.stream = null;
    this.running = false;
  }

  start() {
    this.running = true;
    this._connect();
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
    }
  }

  _connect() {
    if (!this.running) return;

    if (!fs.existsSync(this.device)) {
      this.emit('waiting', this.device);
      setTimeout(() => this._connect(), this.retryInterval);
      return;
    }

    try {
      this.stream = fs.createReadStream(this.device);
      let expecting = null;

      this.stream.on('data', (data) => {
        for (let i = 0; i < data.length; i++) {
          const byte = data[i];

          // Program Change on our channel
          if (byte === (0xC0 | this.channel)) {
            expecting = 'program';
            continue;
          }

          // Program Change on a different channel — ignore
          if ((byte & 0xF0) === 0xC0) {
            expecting = null;
            continue;
          }

          // Data byte following our PC status
          if (expecting === 'program' && byte <= 127) {
            this.emit('program-change', byte);
            expecting = null;
            continue;
          }

          // Any other status byte resets
          if (byte >= 0x80) expecting = null;
        }
      });

      this.stream.on('error', () => {
        this.stream = null;
        if (this.running) {
          this.emit('disconnected', this.device);
          setTimeout(() => this._connect(), this.retryInterval);
        }
      });

      this.stream.on('close', () => {
        this.stream = null;
        if (this.running) {
          setTimeout(() => this._connect(), this.retryInterval);
        }
      });

      this.emit('connected', this.device, this.channel);
    } catch {
      if (this.running) {
        setTimeout(() => this._connect(), this.retryInterval);
      }
    }
  }
}

module.exports = MidiListener;
