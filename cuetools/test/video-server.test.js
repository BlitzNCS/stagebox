const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const VideoServer = require('../lib/video-server');

let tmpDir, vs;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  vs = new VideoServer(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('VideoServer', () => {
  describe('listFiles()', () => {
    it('returns video files sorted alphabetically', async () => {
      fs.writeFileSync(path.join(tmpDir, 'beta.mp4'), 'fake');
      fs.writeFileSync(path.join(tmpDir, 'alpha.webm'), 'fake');
      fs.writeFileSync(path.join(tmpDir, 'charlie.mov'), 'fake');
      fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'not a video');

      const files = await vs.listFiles();
      assert.deepEqual(files, ['alpha.webm', 'beta.mp4', 'charlie.mov']);
    });

    it('returns empty array for non-existent directory', async () => {
      const bad = new VideoServer('/nonexistent/path');
      const files = await bad.listFiles();
      assert.deepEqual(files, []);
    });

    it('returns empty array for empty directory', async () => {
      const files = await vs.listFiles();
      assert.deepEqual(files, []);
    });

    it('filters by video extensions case-insensitively', async () => {
      fs.writeFileSync(path.join(tmpDir, 'loud.MP4'), 'fake');
      fs.writeFileSync(path.join(tmpDir, 'quiet.MKV'), 'fake');

      const files = await vs.listFiles();
      assert.deepEqual(files, ['loud.MP4', 'quiet.MKV']);
    });
  });

  describe('handleRequest()', () => {
    it('serves a full video file with correct headers', async () => {
      const content = Buffer.alloc(1024, 'x');
      fs.writeFileSync(path.join(tmpDir, 'test.mp4'), content);

      const res = new MockResponse();
      await vs.handleRequest({ headers: {} }, res, 'test.mp4');
      await res.waitForPipe();

      assert.equal(res._status, 200);
      assert.equal(res._headers['Content-Length'], 1024);
      assert.equal(res._headers['Content-Type'], 'video/mp4');
      assert.equal(res._headers['Accept-Ranges'], 'bytes');
    });

    it('serves range requests with 206', async () => {
      const content = Buffer.alloc(1000, 'y');
      fs.writeFileSync(path.join(tmpDir, 'range.mp4'), content);

      const res = new MockResponse();
      await vs.handleRequest({ headers: { range: 'bytes=0-499' } }, res, 'range.mp4');
      await res.waitForPipe();

      assert.equal(res._status, 206);
      assert.equal(res._headers['Content-Range'], 'bytes 0-499/1000');
      assert.equal(res._headers['Content-Length'], 500);
    });

    it('returns 404 for missing file', async () => {
      const res = new MockResponse();
      await vs.handleRequest({ headers: {} }, res, 'nonexistent.mp4');

      assert.equal(res._status, 404);
    });

    it('prevents path traversal via basename', async () => {
      const res = new MockResponse();
      await vs.handleRequest({ headers: {} }, res, '../../../etc/passwd');

      assert.equal(res._status, 404);
    });

    it('returns 416 for out-of-range requests', async () => {
      const content = Buffer.alloc(100, 'z');
      fs.writeFileSync(path.join(tmpDir, 'small.mp4'), content);

      const res = new MockResponse();
      await vs.handleRequest({ headers: { range: 'bytes=200-300' } }, res, 'small.mp4');

      assert.equal(res._status, 416);
    });

    it('detects MIME types correctly', async () => {
      for (const [ext, mime] of [['webm', 'video/webm'], ['mov', 'video/quicktime'], ['mkv', 'video/x-matroska']]) {
        fs.writeFileSync(path.join(tmpDir, `test.${ext}`), 'fake');
        const res = new MockResponse();
        await vs.handleRequest({ headers: {} }, res, `test.${ext}`);
        await res.waitForPipe();
        assert.equal(res._headers['Content-Type'], mime, `Wrong MIME for .${ext}`);
      }
    });
  });
});

// Minimal mock for http.ServerResponse that supports pipe()
const { Writable } = require('stream');

class MockResponse extends Writable {
  constructor() {
    super();
    this._status = null;
    this._headers = {};
    this._body = '';
    this._ended = false;
    this._pipePromise = null;
    this._pipeResolve = null;
    this._pipePromise = new Promise(resolve => { this._pipeResolve = resolve; });
    this.on('finish', () => this._pipeResolve());
  }
  writeHead(status, headers) {
    this._status = status;
    if (headers) Object.assign(this._headers, headers);
  }
  end(data, encoding, cb) {
    if (typeof data === 'string' || Buffer.isBuffer(data)) this._body += data;
    this._ended = true;
    if (typeof cb === 'function') cb();
    else if (typeof encoding === 'function') encoding();
    this._pipeResolve();
    // Don't call super.end() to avoid double-finish issues
  }
  _write(chunk, _encoding, cb) {
    this._body += chunk;
    cb();
  }
  waitForPipe() {
    return this._pipePromise;
  }
}
