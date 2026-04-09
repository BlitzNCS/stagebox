const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska'
};

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|mkv)$/i;

class VideoServer {
  constructor(videoDir) {
    this.videoDir = videoDir;
  }

  listFiles() {
    try {
      return fs.readdirSync(this.videoDir).filter(f => VIDEO_EXTENSIONS.test(f)).sort();
    } catch {
      return [];
    }
  }

  handleRequest(req, res, filename) {
    const filePath = path.join(this.videoDir, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Video not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'video/mp4';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }
}

module.exports = VideoServer;
