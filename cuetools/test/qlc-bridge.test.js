const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const QlcBridge = require('../lib/qlc-bridge');

describe('QlcBridge', () => {
  it('sets defaults from constructor', () => {
    const bridge = new QlcBridge();
    assert.equal(bridge.url, 'ws://localhost:9999/qlcplusWS');
    assert.equal(bridge.reconnectInterval, 5000);
    assert.equal(bridge.connectDelay, 5000);
    assert.equal(bridge.running, false);
  });

  it('accepts custom options', () => {
    const bridge = new QlcBridge({ url: 'ws://other:1234', reconnectInterval: 1000, connectDelay: 2000 });
    assert.equal(bridge.url, 'ws://other:1234');
    assert.equal(bridge.reconnectInterval, 1000);
    assert.equal(bridge.connectDelay, 2000);
  });

  it('isConnected() returns false when not started', () => {
    const bridge = new QlcBridge();
    assert.equal(bridge.isConnected(), null);
  });

  it('triggerFunction() returns false when not connected', () => {
    const bridge = new QlcBridge();
    assert.equal(bridge.triggerFunction(5), false);
  });

  it('stopFunction() returns false when not connected', () => {
    const bridge = new QlcBridge();
    assert.equal(bridge.stopFunction(5), false);
  });

  it('listFunctions() returns false when not connected', () => {
    const bridge = new QlcBridge();
    assert.equal(bridge.listFunctions(), false);
  });

  it('stop() cleans up state', () => {
    const bridge = new QlcBridge();
    bridge.running = true;
    bridge.reconnectTimer = setInterval(() => {}, 99999);
    bridge.stop();
    assert.equal(bridge.running, false);
    assert.equal(bridge.reconnectTimer, null);
    assert.equal(bridge.ws, null);
  });
});
