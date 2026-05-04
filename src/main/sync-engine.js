const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const AdmZip = require('adm-zip');
const configStore = require('./config-store');

class SyncEngine {
  constructor() {
    this.mainWindow = null;
  }

  setMainWindow(win) { this.mainWindow = win; }

  // ---- File Filtering ----

  /**
   * Check if a relative file path should be excluded based on glob patterns.
   * Supported patterns: * (any non-slash), ** (any including slash), ? (single char), exact names
   */
  shouldExclude(relPath, excludePatterns) {
    if (!excludePatterns || excludePatterns.length === 0) return false;
    // Normalize to forward slashes
    const normalized = relPath.replace(/\\/g, '/');
    for (const pattern of excludePatterns) {
      if (this._globMatch(normalized, pattern.replace(/\\/g, '/'))) return true;
    }
    return false;
  }

  _globMatch(str, pattern) {
    // Convert glob to regex
    let regexStr = '^';
    let i = 0;
    while (i < pattern.length) {
      const c = pattern[i];
      if (c === '*') {
        if (pattern[i + 1] === '*') {
          // ** matches anything including /
          if (pattern[i + 2] === '/') {
            regexStr += '(?:.*/)?';
            i += 3;
          } else {
            regexStr += '.*';
            i += 2;
          }
        } else {
          // * matches anything except /
          regexStr += '[^/]*';
          i++;
        }
      } else if (c === '?') {
        regexStr += '[^/]';
        i++;
      } else if (c === '.') {
        regexStr += '\\.';
        i++;
      } else {
        regexStr += c;
        i++;
      }
    }
    regexStr += '$';
    try {
      return new RegExp(regexStr, 'i').test(str);
    } catch {
      return false;
    }
  }

  /**
   * Scan a directory and return a file tree structure for the UI.
   * Each node: { name, path, type: 'file'|'dir', size?, children?, excluded? }
   */
  async scanDirectory(dirPath, excludePatterns = [], basePath = null) {
    if (!basePath) basePath = dirPath;
    if (!fs.existsSync(dirPath)) return [];
    const result = [];
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(basePath, fullPath);
        const excluded = this.shouldExclude(relPath, excludePatterns);

        if (entry.isDirectory()) {
          const children = await this.scanDirectory(fullPath, excludePatterns, basePath);
          result.push({
            name: entry.name,
            relPath,
            type: 'dir',
            excluded,
            children
          });
        } else {
          let size = 0;
          try { 
            const stat = await fs.promises.stat(fullPath);
            size = stat.size; 
          } catch {}
          result.push({
            name: entry.name,
            relPath,
            type: 'file',
            size,
            sizeFormatted: this.formatSize(size),
            excluded
          });
        }
      }
    } catch {}
    return result;
  }

  sendProgress(data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed())
      this.mainWindow.webContents.send('sync:progress', data);
  }
  sendComplete(data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed())
      this.mainWindow.webContents.send('sync:complete', data);
  }
  sendError(data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed())
      this.mainWindow.webContents.send('sync:error', data);
  }

  async syncGame(gameId, direction = 'auto') {
    const game = configStore.getGame(gameId);
    if (!game) throw new Error('游戏不存在');
    const targets = configStore.getSyncTargets();
    if (targets.length === 0) throw new Error('未配置同步目标');
    const target = game.syncTargetId ? configStore.getSyncTarget(game.syncTargetId) : targets[0];
    if (!target) throw new Error('同步目标不存在');

    configStore.updateGame(gameId, { syncStatus: 'syncing' });
    this.sendProgress({ gameId, status: 'start', message: `开始同步 ${game.name}...` });

    try {
      if (direction === 'auto') direction = await this.determineDirection(game, target);
      if (direction === 'download') await this.createVersionBackup(game);

      if (direction === 'upload') await this.uploadSave(game, target);
      else if (direction === 'download') await this.downloadSave(game, target);
      else if (direction === 'conflict') {
        configStore.updateGame(gameId, { syncStatus: 'conflict' });
        this.sendProgress({ gameId, status: 'conflict', message: '存档冲突' });
        configStore.addSyncHistoryEntry({
          gameId, gameName: game.name, gameIcon: game.icon || '🎮',
          direction: 'conflict', status: 'conflict',
          targetName: target.name, targetType: target.type
        });
        return { status: 'conflict', gameId };
      }

      const now = new Date().toISOString();
      configStore.updateGame(gameId, { syncStatus: 'synced', lastSyncTime: now, lastSyncDirection: direction });
      this.sendComplete({ gameId, direction, message: `${game.name} 同步完成` });
      configStore.addSyncHistoryEntry({
        gameId, gameName: game.name, gameIcon: game.icon || '🎮',
        direction, status: 'success',
        targetName: target.name, targetType: target.type
      });
      return { status: 'success', gameId, direction };
    } catch (error) {
      configStore.updateGame(gameId, { syncStatus: 'error' });
      this.sendError({ gameId, message: error.message });
      configStore.addSyncHistoryEntry({
        gameId, gameName: game.name, gameIcon: game.icon || '🎮',
        direction: direction || 'unknown', status: 'error',
        errorMessage: error.message,
        targetName: target.name, targetType: target.type
      });
      throw error;
    }
  }

  async syncAllGames() {
    const games = configStore.getGames();
    const results = [];
    const total = games.length;
    if (total === 0) return results;

    for (let i = 0; i < total; i++) {
      const game = games[i];
      this.sendProgress({ 
        gameId: 'all', 
        status: 'batch_progress', 
        current: i + 1, 
        total, 
        gameName: game.name,
        message: `正在同步所有游戏 (${i + 1}/${total}): ${game.name}` 
      });
      
      try { 
        results.push(await this.syncGame(game.id, 'auto')); 
      } catch (e) { 
        results.push({ status: 'error', gameId: game.id, error: e.message }); 
      }
    }

    this.sendProgress({ 
      gameId: 'all', 
      status: 'batch_complete', 
      message: `全量同步完成，共处理 ${total} 个项目` 
    });
    return results;
  }

  async compareGame(gameId) {
    const game = configStore.getGame(gameId);
    if (!game) throw new Error('游戏不存在');
    const targets = configStore.getSyncTargets();
    if (targets.length === 0) return { status: 'no_target' };
    const target = game.syncTargetId ? configStore.getSyncTarget(game.syncTargetId) : targets[0];
    if (!target) return { status: 'no_target' };

    const localInfo = await this.getLocalInfo(game.localPath);
    let remoteInfo;
    if (game.packMode) {
      remoteInfo = await this.getRemoteInfoPacked(game, target);
    } else {
      const remotePath = this.getRemotePath(game, target);
      remoteInfo = await this.getRemoteInfo(remotePath, target);
    }

    if (!localInfo.exists && !remoteInfo.exists) return { status: 'empty', localInfo, remoteInfo };
    if (!localInfo.exists && remoteInfo.exists) return { status: 'remote_only', localInfo, remoteInfo };
    if (localInfo.exists && !remoteInfo.exists) return { status: 'local_only', localInfo, remoteInfo };

    if (!game.lastSyncTime) return { status: 'never_synced', localInfo, remoteInfo };

    const lastSync = new Date(game.lastSyncTime).getTime();
    const lt = localInfo.latestModified, rt = remoteInfo.latestModified;
    const TOLERANCE = 2000; // 2 seconds tolerance for clock drift/precision

    if (lt > lastSync + TOLERANCE && rt <= lastSync + TOLERANCE) return { status: 'local_newer', localInfo, remoteInfo };
    if (rt > lastSync + TOLERANCE && lt <= lastSync + TOLERANCE) return { status: 'remote_newer', localInfo, remoteInfo };
    if (lt > lastSync + TOLERANCE && rt > lastSync + TOLERANCE) return { status: 'conflict', localInfo, remoteInfo };
    return { status: 'synced', localInfo, remoteInfo };
  }

  async determineDirection(game, target) {
    const localInfo = await this.getLocalInfo(game.localPath);
    const remotePath = this.getRemotePath(game, target);
    const remoteInfo = await this.getRemoteInfo(remotePath, target);
    if (!localInfo.exists && !remoteInfo.exists) return 'none';
    if (!localInfo.exists && remoteInfo.exists) return 'download';
    if (localInfo.exists && !remoteInfo.exists) return 'upload';
    if (!game.lastSyncTime) return 'upload';
    const lastSync = new Date(game.lastSyncTime).getTime();
    const TOLERANCE = 2000;

    if (localInfo.latestModified > lastSync + TOLERANCE && remoteInfo.latestModified <= lastSync + TOLERANCE) return 'upload';
    if (remoteInfo.latestModified > lastSync + TOLERANCE && localInfo.latestModified <= lastSync + TOLERANCE) return 'download';
    if (localInfo.latestModified > lastSync + TOLERANCE && remoteInfo.latestModified > lastSync + TOLERANCE) return 'conflict';
    return 'synced';
  }

  async uploadSave(game, target) {
    const excludes = game.excludePatterns || [];
    if (game.packMode) {
      await this.packAndUpload(game, target, excludes);
    } else {
      this.sendProgress({ gameId: game.id, status: 'uploading', message: '正在上传...' });
      const remotePath = this.getRemotePath(game, target);
      if (target.type === 'local') await this.copyDirectory(game.localPath, remotePath, excludes);
      else if (target.type === 'webdav') await this.webdavUploadDir(game.localPath, remotePath, target, excludes);
    }
  }

  async downloadSave(game, target) {
    if (game.packMode) {
      await this.downloadAndUnpack(game, target);
    } else {
      this.sendProgress({ gameId: game.id, status: 'downloading', message: '正在下载...' });
      const remotePath = this.getRemotePath(game, target);
      if (target.type === 'local') await this.copyDirectory(remotePath, game.localPath);
      else if (target.type === 'webdav') await this.webdavDownloadDir(remotePath, game.localPath, target);
    }
  }

  // ---- Pack (Zip) Mode ----

  async packAndUpload(game, target, excludePatterns = []) {
    this.sendProgress({ gameId: game.id, status: 'uploading', message: '正在打包压缩...' });

    if (!fs.existsSync(game.localPath)) throw new Error(`源路径不存在: ${game.localPath}`);

    // Create zip with filtering
    const zip = new AdmZip();
    if (excludePatterns.length > 0) {
      this._addFolderToZipFiltered(zip, game.localPath, game.localPath, excludePatterns);
    } else {
      zip.addLocalFolder(game.localPath);
    }
    const zipBuffer = zip.toBuffer();
    const zipFileName = this.sanitizeName(game.name) + '.zip';

    this.sendProgress({ gameId: game.id, status: 'uploading', message: `正在上传压缩包 (${this.formatSize(zipBuffer.length)})...` });

    if (target.type === 'local') {
      const remoteDir = path.join(target.path, 'GameSync');
      fs.mkdirSync(remoteDir, { recursive: true });
      const remotZipPath = path.join(remoteDir, zipFileName);
      fs.writeFileSync(remotZipPath, zipBuffer);
    } else if (target.type === 'webdav') {
      const base = target.url.replace(/\/+$/, '');
      const remotePath = target.remotePath || '/GameSync';
      // Ensure remote directory
      const parts = remotePath.split('/').filter(Boolean);
      let cp = '';
      for (const p of parts) { cp += '/' + p; await this.webdavEnsureDir(`${base}${cp}`, target); }
      // Upload zip
      await this._webdavReq('PUT', `${base}${remotePath}/${zipFileName}`, target, {
        headers: { 'Content-Type': 'application/zip' },
        body: zipBuffer
      });
    }
  }

  async downloadAndUnpack(game, target) {
    this.sendProgress({ gameId: game.id, status: 'downloading', message: '正在下载压缩包...' });

    const zipFileName = this.sanitizeName(game.name) + '.zip';
    let zipBuffer;

    if (target.type === 'local') {
      const remoteDir = path.join(target.path, 'GameSync');
      const remoteZipPath = path.join(remoteDir, zipFileName);
      if (!fs.existsSync(remoteZipPath)) throw new Error('远端压缩包不存在');
      zipBuffer = await fs.promises.readFile(remoteZipPath);
    } else if (target.type === 'webdav') {
      const base = target.url.replace(/\/+$/, '');
      const remotePath = target.remotePath || '/GameSync';
      const res = await this._webdavReq('GET', `${base}${remotePath}/${zipFileName}`, target);
      if (res.status !== 200) throw new Error(`下载失败: HTTP ${res.status}`);
      zipBuffer = res.body;
    }

    this.sendProgress({ gameId: game.id, status: 'downloading', message: '正在解压还原...' });

    // Clear local path and extract
    await fs.promises.mkdir(game.localPath, { recursive: true });
    const zip = new AdmZip(zipBuffer);
    await new Promise((resolve, reject) => {
      zip.extractAllToAsync(game.localPath, true, false, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createVersionBackup(game) {
    if (!fs.existsSync(game.localPath)) return null;
    const versionsDir = configStore.getVersionsDir(game.id);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(versionsDir, `${ts}.zip`);

    // Zip the save folder asynchronously
    const zip = new AdmZip();
    await new Promise((resolve, reject) => {
      zip.addLocalFolderAsync(game.localPath, (success, err) => {
        if (!success) reject(err || new Error('Zip add failed'));
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      zip.writeZip(zipPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.cleanOldVersions(versionsDir, configStore.getSettings().maxVersions || 10);
    return { versionId: ts, path: zipPath };
  }

  getVersions(gameId) {
    const dir = configStore.getVersionsDir(gameId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(n => n.endsWith('.zip'))
      .map(n => {
        const fp = path.join(dir, n);
        const stat = fs.statSync(fp);
        const id = n.replace(/\.zip$/, '');
        return { id, date: id, size: stat.size, sizeFormatted: this.formatSize(stat.size), path: fp };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  async restoreVersion(gameId, versionId) {
    const game = configStore.getGame(gameId);
    if (!game) throw new Error('游戏不存在');
    const zipPath = path.join(configStore.getVersionsDir(gameId), `${versionId}.zip`);
    if (!fs.existsSync(zipPath)) throw new Error('版本不存在');

    // Backup current state first
    await this.createVersionBackup(game);

    // Extract zip to save path
    fs.mkdirSync(game.localPath, { recursive: true });
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(game.localPath, true);
    return { status: 'success' };
  }

  deleteVersion(gameId, versionId) {
    const zipPath = path.join(configStore.getVersionsDir(gameId), `${versionId}.zip`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }

  cleanOldVersions(dir, max) {
    const vs = fs.readdirSync(dir).filter(n => n.endsWith('.zip')).sort();
    while (vs.length > max) {
      const old = path.join(dir, vs.shift());
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
  }

  async getLocalInfo(dirPath) {
    if (!fs.existsSync(dirPath)) return { exists: false, fileCount: 0, totalSize: 0, latestModified: 0 };
    let fc = 0, ts = 0, lm = 0;
    const walk = async (d) => {
      try {
        const entries = await fs.promises.readdir(d, { withFileTypes: true });
        for (const e of entries) {
          const fp = path.join(d, e.name);
          if (e.isDirectory()) await walk(fp);
          else {
            fc++;
            const s = await fs.promises.stat(fp);
            ts += s.size;
            if (s.mtimeMs > lm) lm = s.mtimeMs;
          }
        }
      } catch {}
    };
    await walk(dirPath);
    return { exists: true, fileCount: fc, totalSize: ts, totalSizeFormatted: this.formatSize(ts), latestModified: lm, latestModifiedDate: new Date(lm).toLocaleString('zh-CN') };
  }

  async getRemoteInfo(remotePath, target) {
    if (target.type === 'local') return await this.getLocalInfo(remotePath);
    if (target.type === 'webdav') return await this.webdavGetInfo(remotePath, target);
    return { exists: false };
  }

  async getRemoteInfoPacked(game, target) {
    const zipFileName = this.sanitizeName(game.name) + '.zip';
    if (target.type === 'local') {
      const zipPath = path.join(target.path, 'GameSync', zipFileName);
      if (!fs.existsSync(zipPath)) return { exists: false, fileCount: 0, totalSize: 0, latestModified: 0 };
      const stat = await fs.promises.stat(zipPath);
      return { exists: true, fileCount: 1, totalSize: stat.size, totalSizeFormatted: this.formatSize(stat.size), latestModified: stat.mtimeMs, latestModifiedDate: new Date(stat.mtimeMs).toLocaleString('zh-CN'), packed: true };
    }
    // For WebDAV packed, fall back to normal remote info on the parent dir
    return await this.getRemoteInfo(`${target.remotePath || '/GameSync'}`, target);
  }

  getRemotePath(game, target) {
    const name = this.sanitizeName(game.name);
    if (target.type === 'local') return path.join(target.path, 'GameSync', name);
    if (target.type === 'webdav') return `${target.remotePath || '/GameSync'}/${name}`;
    return '';
  }

  sanitizeName(n) { return n.replace(/[<>:"/\\|?*]/g, '_').trim(); }

  async copyDirectory(src, dest, excludePatterns = [], basePath = null) {
    if (!basePath) basePath = src;
    if (!fs.existsSync(src)) throw new Error(`源路径不存在: ${src}`);
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(src, e.name), d = path.join(dest, e.name);
      const relPath = path.relative(basePath, s);
      if (this.shouldExclude(relPath, excludePatterns)) continue;
      if (e.isDirectory()) {
        await this.copyDirectory(s, d, excludePatterns, basePath);
      } else {
        await fs.promises.copyFile(s, d);
      }
    }
  }

  /**
   * Add folder contents to zip with exclude filtering.
   */
  _addFolderToZipFiltered(zip, dirPath, basePath, excludePatterns, zipDir = '') {
    for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, e.name);
      const relPath = path.relative(basePath, fullPath);
      if (this.shouldExclude(relPath, excludePatterns)) continue;
      const zipPath = zipDir ? zipDir + '/' + e.name : e.name;
      if (e.isDirectory()) {
        this._addFolderToZipFiltered(zip, fullPath, basePath, excludePatterns, zipPath);
      } else {
        zip.addLocalFile(fullPath, zipDir || undefined);
      }
    }
  }

  getDirSize(d) {
    let s = 0;
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        s += e.isDirectory() ? this.getDirSize(fp) : fs.statSync(fp).size;
      }
    } catch {}
    return s;
  }

  formatSize(b) {
    if (b === 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
  }

  // WebDAV helpers
  _webdavReq(method, urlStr, target, opts = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const c = url.protocol === 'https:' ? https : http;
      const h = { ...opts.headers };
      if (target.username && target.password)
        h['Authorization'] = 'Basic ' + Buffer.from(`${target.username}:${target.password}`).toString('base64');
      const req = c.request({ hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + (url.search || ''), method, headers: h, rejectUnauthorized: false }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  async webdavEnsureDir(urlStr, target) {
    const r = await this._webdavReq('MKCOL', urlStr, target);
    return r.status < 400 || r.status === 405;
  }

  async webdavUploadDir(localDir, remotePath, target, excludePatterns = [], basePath = null) {
    if (!basePath) basePath = localDir;
    const base = target.url.replace(/\/+$/, '');
    const parts = remotePath.split('/').filter(Boolean);
    let cp = '';
    for (const p of parts) { cp += '/' + p; await this.webdavEnsureDir(`${base}${cp}`, target); }
    const entries = await fs.promises.readdir(localDir, { withFileTypes: true });
    for (const e of entries) {
      const lp = path.join(localDir, e.name);
      const relPath = path.relative(basePath, lp);
      if (this.shouldExclude(relPath, excludePatterns)) continue;
      if (e.isDirectory()) await this.webdavUploadDir(lp, `${remotePath}/${e.name}`, target, excludePatterns, basePath);
      else {
        const data = await fs.promises.readFile(lp);
        await this._webdavReq('PUT', `${base}${remotePath}/${e.name}`, target, { headers: { 'Content-Type': 'application/octet-stream' }, body: data });
      }
    }
  }

  async webdavDownloadDir(remotePath, localDir, target) {
    const base = target.url.replace(/\/+$/, '');
    await fs.promises.mkdir(localDir, { recursive: true });
    const res = await this._webdavReq('PROPFIND', `${base}${remotePath}/`, target, {
      headers: { 'Content-Type': 'application/xml', 'Depth': '1' },
      body: '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
    });
    if (res.status >= 400) throw new Error(`WebDAV error: ${res.status}`);
    const entries = this.parseWebDAV(res.body.toString('utf-8'), remotePath);
    for (const e of entries) {
      const lp = path.join(localDir, e.name);
      if (e.isDir) await this.webdavDownloadDir(`${remotePath}/${e.name}`, lp, target);
      else {
        const r = await this._webdavReq('GET', `${base}${remotePath}/${e.name}`, target);
        if (r.status === 200) await fs.promises.writeFile(lp, r.body);
      }
    }
  }

  async webdavGetInfo(remotePath, target) {
    try {
      const base = target.url.replace(/\/+$/, '');
      const res = await this._webdavReq('PROPFIND', `${base}${remotePath}/`, target, {
        headers: { 'Content-Type': 'application/xml', 'Depth': '0' },
        body: '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
      });
      if (res.status >= 400) return { exists: false, fileCount: 0, totalSize: 0, latestModified: 0 };
      const xml = res.body.toString('utf-8');
      const m = xml.match(/<[^:]*:?getlastmodified>([^<]+)<\/[^:]*:?getlastmodified>/i);
      const lm = m ? new Date(m[1]).getTime() : 0;
      return { exists: true, fileCount: -1, totalSize: -1, latestModified: lm, latestModifiedDate: lm ? new Date(lm).toLocaleString('zh-CN') : '未知' };
    } catch { return { exists: false, fileCount: 0, totalSize: 0, latestModified: 0 }; }
  }

  parseWebDAV(xml, basePath) {
    const entries = [];
    const re = /<D:response>([\s\S]*?)<\/D:response>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const hr = m[1].match(/<D:href>([^<]+)<\/D:href>/i);
      if (!hr) continue;
      const href = decodeURIComponent(hr[1]);
      const name = href.split('/').filter(Boolean).pop();
      if (href.replace(/\/+$/, '') === basePath.replace(/\/+$/, '')) continue;
      const isDir = /<D:collection/i.test(m[1]);
      entries.push({ name, isDir, href });
    }
    return entries;
  }

  async testSyncTarget(target) {
    if (target.type === 'local') {
      try {
        fs.mkdirSync(target.path, { recursive: true });
        const tf = path.join(target.path, '.gamesync_test');
        fs.writeFileSync(tf, 'test'); fs.unlinkSync(tf);
        return { success: true, message: '本地路径可用' };
      } catch (e) { return { success: false, message: `路径不可用: ${e.message}` }; }
    } else if (target.type === 'webdav') {
      try {
        const r = await this._webdavReq('PROPFIND', target.url, target, { headers: { 'Depth': '0', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>' });
        return r.status < 400 ? { success: true, message: 'WebDAV 连接成功' } : { success: false, message: `HTTP ${r.status}` };
      } catch (e) { return { success: false, message: `连接失败: ${e.message}` }; }
    }
    return { success: false, message: '未知类型' };
  }
}

module.exports = new SyncEngine();
