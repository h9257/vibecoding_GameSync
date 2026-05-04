/**
 * Dev Server - 内嵌 HTTP 服务器
 * 在 Electron 应用内启动一个 HTTP 服务器，使得前端可以通过浏览器访问
 * 同时提供 REST API 端点，映射到与 IPC 相同的后端逻辑
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const configStore = require('./config-store');
const gameDatabase = require('./game-database');
const syncEngine = require('./sync-engine');
const fileWatcher = require('./file-watcher');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

// MIME type mapping
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// ---- API Route Handlers ----
const routes = {
  // Games
  'GET /api/games': () => configStore.getGames(),
  'POST /api/games/add': (body) => {
    const added = configStore.addGame(body);
    if (added.autoSync) fileWatcher.watchGame(added.id);
    return added;
  },
  'POST /api/games/update': (body) => configStore.updateGame(body.id, body.updates),
  'POST /api/games/remove': (body) => { fileWatcher.unwatchGame(body.id); configStore.removeGame(body.id); return { status: 'ok' }; },

  // Presets
  'GET /api/presets': () => gameDatabase.getAll(),
  'POST /api/presets/search': (body) => gameDatabase.search(body.query),

  // Sync Targets
  'GET /api/targets': () => configStore.getSyncTargets(),
  'POST /api/targets/add': (body) => configStore.addSyncTarget(body),
  'POST /api/targets/update': (body) => configStore.updateSyncTarget(body.id, body.updates),
  'POST /api/targets/remove': (body) => { configStore.removeSyncTarget(body.id); return { status: 'ok' }; },
  'POST /api/targets/test': async (body) => syncEngine.testSyncTarget(body),

  // Sync Operations
  'POST /api/sync/execute': async (body) => syncEngine.syncGame(body.gameId, body.direction),
  'POST /api/sync/all': async () => syncEngine.syncAllGames(),
  'POST /api/sync/compare': async (body) => syncEngine.compareGame(body.gameId),

  // Sync History
  'GET /api/history': () => configStore.getSyncHistory(),
  'POST /api/history/clear': () => { configStore.clearSyncHistory(); return { status: 'ok' }; },

  // Settings
  'GET /api/settings': () => configStore.getSettings(),
  'POST /api/settings/update': (body) => configStore.updateSettings(body),

  // Config Directory
  'GET /api/config/dir': () => configStore.getConfigDir(),
  'POST /api/config/changeDir': async (body) => configStore.migrateDataDir(body.newDir),
  'POST /api/config/resetDir': async () => configStore.resetDataDir(),

  // File Watcher
  'POST /api/watcher/toggle': (body) => { fileWatcher.toggleWatch(body.gameId, body.enabled); return { status: 'ok' }; }
};

// Dynamic routes (with path params)
function matchDynamicRoute(method, pathname) {
  // GET /api/sync/status/:gameId
  const statusMatch = pathname.match(/^\/api\/sync\/status\/(.+)$/);
  if (method === 'GET' && statusMatch) {
    const gameId = statusMatch[1];
    return () => {
      const g = configStore.getGame(gameId);
      return g ? { status: g.syncStatus, lastSync: g.lastSyncTime } : null;
    };
  }
  // GET /api/versions/:gameId
  const versionsMatch = pathname.match(/^\/api\/versions\/(.+)$/);
  if (method === 'GET' && versionsMatch) {
    const gameId = versionsMatch[1];
    return () => syncEngine.getVersions(gameId);
  }
  // GET /api/files/scan/:gameId
  const scanMatch = pathname.match(/^\/api\/files\/scan\/(.+)$/);
  if (method === 'GET' && scanMatch) {
    const gameId = scanMatch[1];
    return () => {
      const game = configStore.getGame(gameId);
      if (!game) throw new Error('游戏不存在');
      return syncEngine.scanDirectory(game.localPath, game.excludePatterns || []);
    };
  }
  return null;
}

// Versions (POST routes)
routes['POST /api/versions/restore'] = async (body) => syncEngine.restoreVersion(body.gameId, body.versionId);
routes['POST /api/versions/delete'] = (body) => { syncEngine.deleteVersion(body.gameId, body.versionId); return { status: 'ok' }; };

// ---- Server ----

let server = null;

function start(port = 3000) {
  server = http.createServer(async (req, res) => {
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // ---- API Routes ----
    if (pathname.startsWith('/api/')) {
      const routeKey = `${req.method} ${pathname}`;
      let handler = routes[routeKey] || matchDynamicRoute(req.method, pathname);

      if (!handler) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', route: routeKey }));
        return;
      }

      try {
        let body = null;
        if (req.method === 'POST') {
          body = await readBody(req);
        }
        const result = await handler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result ?? null));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // ---- Static File Serving ----
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(RENDERER_DIR, filePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(RENDERER_DIR)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    try {
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404); res.end('Not Found'); return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      const data = fs.readFileSync(fullPath);

      // Inject api-shim.js before other scripts in index.html
      if (filePath === '/index.html') {
        let html = data.toString('utf-8');
        const shimTag = '  <script src="js/api-shim.js"></script>\n';
        // Insert before the first <script> tag
        html = html.replace(/<script /, shimTag + '  <script ');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch (e) {
      res.writeHead(500); res.end(`Server Error: ${e.message}`);
    }
  });

  server.listen(port, () => {
    console.log(`\n  🌐 Browser debug server running at:`);
    console.log(`     http://localhost:${port}\n`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`  ⚠️ Port ${port} is in use, trying ${port + 1}...`);
      start(port + 1);
    } else {
      console.error('Dev server error:', e);
    }
  });
}

function stop() {
  if (server) {
    server.close();
    server = null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : null);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = { start, stop };
