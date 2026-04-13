const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const MidiListener = require('../lib/midi-listener');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'midi-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MidiListener', () => {
  it('sets defaults from constructor', () => {
    const ml = new MidiListener();
    assert.equal(ml.device, '/dev/snd/midiC1D0');
    assert.equal(ml.channel, 14);
    assert.equal(ml.retryInterval, 5000);
    assert.equal(ml.running, false);
  });

  it('accepts custom options', () => {
    const ml = new MidiListener({ device: '/dev/midi1', channel: 0, retryInterval: 1000 });
    assert.equal(ml.device, '/dev/midi1');
    assert.equal(ml.channel, 0);
    assert.equal(ml.retryInterval, 1000);
  });

  it('emits waiting when device does not exist', (_, done) => {
    const ml = new MidiListener({ device: '/nonexistent/device', retryInterval: 50 });
    ml.on('waiting', (dev) => {
      assert.equal(dev, '/nonexistent/device');
      ml.stop();
      done();
    });
    ml.start();
  });

  it('emits connected and program-change from device file', (_, done) => {
    // Create a fake MIDI device file with a Program Change message
    // Channel 14 (0-indexed): status byte = 0xC0 | 14 = 0xCE, data byte = 42
    const fakeDev = path.join(tmpDir, 'midi0');
    const midiData = Buffer.from([0xCE, 42]);
    fs.writeFileSync(fakeDev, midiData);

    const ml = new MidiListener({ device: fakeDev, channel: 14, retryInterval: 50 });
    let gotConnected = false;

    ml.on('connected', () => { gotConnected = true; });
    ml.on('program-change', (pc) => {
      assert.equal(gotConnected, true);
      assert.equal(pc, 42);
      ml.stop();
      done();
    });

    ml.start();
  });

  it('ignores Program Change on wrong channel', (_, done) => {
    // Channel 0: status byte = 0xC0, data = 10; then channel 14: 0xCE, data = 5
    const fakeDev = path.join(tmpDir, 'midi1');
    const midiData = Buffer.from([0xC0, 10, 0xCE, 5]);
    fs.writeFileSync(fakeDev, midiData);

    const ml = new MidiListener({ device: fakeDev, channel: 14, retryInterval: 50 });
    const received = [];

    ml.on('program-change', (pc) => {
      received.push(pc);
      if (received.length === 1) {
        assert.equal(pc, 5); // Only channel 14 should come through
        ml.stop();
        done();
      }
    });

    ml.start();
  });

  it('resets state on non-PC status bytes', (_, done) => {
    // Send Note On (0x90) between PC status and data — should reset parser
    // 0xCE = PC on ch14, 0x90 = Note On ch0, then 42 = data byte
    // The 42 should NOT be emitted as a PC because 0x90 reset the parser
    // Then 0xCE, 7 = valid PC on ch14
    const fakeDev = path.join(tmpDir, 'midi2');
    const midiData = Buffer.from([0xCE, 0x90, 42, 0xCE, 7]);
    fs.writeFileSync(fakeDev, midiData);

    const ml = new MidiListener({ device: fakeDev, channel: 14, retryInterval: 50 });
    const received = [];
    let firstPass = true;

    ml.on('program-change', (pc) => {
      if (firstPass) received.push(pc);
    });

    // Stop after first read — file streams close and would reconnect
    ml.on('connected', () => {
      setTimeout(() => {
        firstPass = false;
        ml.stop();
        assert.deepEqual(received, [7]); // Only the valid PC after reset
        done();
      }, 50);
    });

    ml.start();
  });

  it('stop() prevents further reconnection', () => {
    const ml = new MidiListener({ device: '/nonexistent', retryInterval: 10 });
    ml.start();
    ml.stop();
    assert.equal(ml.running, false);
    assert.equal(ml.stream, null);
  });
});
