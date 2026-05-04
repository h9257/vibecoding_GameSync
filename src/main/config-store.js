const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigStore {
  constructor() {
    this.defaultDir = null;  // Set after app ready
    this.configDir = null;
    this.configPath = null;
    this.versionsDir = null;
    this.bootstrapPath = null;
    this.config = null;
  }

  /**
   * Initialize paths. Must be called after app.getPath is available.
   */
  initPaths() {
    this.defaultDir = path.join(app.getPath('userData'), 'GameSync');
    this.bootstrapPath = path.join(this.defaultDir, 'bootstrap.json');

    // Read bootstrap config to get actual data dir
    let dataDir = this.defaultDir;
    try {
      if (fs.existsSync(this.bootstrapPath)) {
        const bs = JSON.parse(fs.readFileSync(this.bootstrapPath, 'utf-8'));
        if (bs.configDir && fs.existsSync(bs.configDir)) {
          dataDir = bs.configDir;
        }
      }
    } catch (e) {
      console.error('Failed to read bootstrap config:', e);
    }

    this.setConfigDir(dataDir);
  }

  setConfigDir(dir) {
    this.configDir = dir;
    this.configPath = path.join(this.configDir, 'config.json');
    this.versionsDir = path.join(this.configDir, 'versions');
  }

  getConfigDir() {
    return this.configDir;
  }

  /**
   * Change config directory and migrate all data.
   * Returns { success, message, newPath }
   */
  async migrateDataDir(newDir) {
    if (newDir === this.configDir) {
      return { success: true, message: '路径未变更', newPath: this.configDir };
    }

    try {
      // Ensure new directory exists
      this.ensureDir(newDir);

      // Copy all files from old dir to new dir
      const oldDir = this.configDir;
      if (fs.existsSync(oldDir)) {
        this._copyDirRecursive(oldDir, newDir);
      }

      // Update bootstrap config
      this.ensureDir(path.dirname(this.bootstrapPath));
      fs.writeFileSync(this.bootstrapPath, JSON.stringify({ configDir: newDir }, null, 2), 'utf-8');

      // Switch to new dir
      this.setConfigDir(newDir);
      this.load();

      return { success: true, message: '数据目录已迁移', newPath: newDir };
    } catch (e) {
      return { success: false, message: `迁移失败: ${e.message}`, newPath: this.configDir };
    }
  }

  /**
   * Reset config directory to default location.
   */
  async resetDataDir() {
    return this.migrateDataDir(this.defaultDir);
  }

  _copyDirRecursive(src, dest) {
    this.ensureDir(dest);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this._copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  getDefaultConfig() {
    return {
      syncTargets: [],
      games: [],
      syncHistory: [],
      settings: {
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: 30,
        maxVersions: 10,
        maxHistoryEntries: 100,
        minimizeToTray: true,
        startMinimized: false,
        language: 'zh-CN'
      }
    };
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  load() {
    this.ensureDir(this.configDir);
    this.ensureDir(this.versionsDir);

    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        this.config = { ...this.getDefaultConfig(), ...JSON.parse(raw) };
      } catch (e) {
        console.error('Failed to load config, using defaults:', e);
        this.config = this.getDefaultConfig();
      }
    } else {
      this.config = this.getDefaultConfig();
      this.save();
    }
    return this.config;
  }

  save() {
    this.ensureDir(this.configDir);
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(key) {
    if (!this.config) this.load();
    return key ? this.config[key] : this.config;
  }

  set(key, value) {
    if (!this.config) this.load();
    this.config[key] = value;
    this.save();
  }

  // ---- Games ----

  getGames() {
    return this.get('games') || [];
  }

  addGame(game) {
    const games = this.getGames();
    game.id = game.id || this.generateId();
    game.addedAt = new Date().toISOString();
    game.lastSyncTime = null;
    game.syncStatus = 'idle';
    games.push(game);
    this.set('games', games);
    return game;
  }

  updateGame(id, updates) {
    const games = this.getGames();
    const idx = games.findIndex(g => g.id === id);
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...updates };
      this.set('games', games);
      return games[idx];
    }
    return null;
  }

  removeGame(id) {
    const games = this.getGames().filter(g => g.id !== id);
    this.set('games', games);
  }

  getGame(id) {
    return this.getGames().find(g => g.id === id) || null;
  }

  // ---- Sync Targets ----

  getSyncTargets() {
    return this.get('syncTargets') || [];
  }

  addSyncTarget(target) {
    const targets = this.getSyncTargets();
    target.id = target.id || this.generateId();
    target.createdAt = new Date().toISOString();
    targets.push(target);
    this.set('syncTargets', targets);
    return target;
  }

  updateSyncTarget(id, updates) {
    const targets = this.getSyncTargets();
    const idx = targets.findIndex(t => t.id === id);
    if (idx !== -1) {
      targets[idx] = { ...targets[idx], ...updates };
      this.set('syncTargets', targets);
      return targets[idx];
    }
    return null;
  }

  removeSyncTarget(id) {
    const targets = this.getSyncTargets().filter(t => t.id !== id);
    this.set('syncTargets', targets);
  }

  getSyncTarget(id) {
    return this.getSyncTargets().find(t => t.id === id) || null;
  }

  // ---- Settings ----

  getSettings() {
    return this.get('settings') || this.getDefaultConfig().settings;
  }

  updateSettings(updates) {
    const settings = { ...this.getSettings(), ...updates };
    this.set('settings', settings);
    return settings;
  }

  // ---- Sync History ----

  getSyncHistory() {
    const history = this.get('syncHistory') || [];
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  addSyncHistoryEntry(entry) {
    const history = this.get('syncHistory') || [];
    entry.id = this.generateId();
    entry.timestamp = entry.timestamp || new Date().toISOString();
    history.push(entry);

    // Trim old entries
    const max = this.getSettings().maxHistoryEntries || 100;
    while (history.length > max) {
      // Remove the oldest entry
      let oldestIdx = 0;
      let oldestTime = new Date(history[0].timestamp).getTime();
      for (let i = 1; i < history.length; i++) {
        const t = new Date(history[i].timestamp).getTime();
        if (t < oldestTime) { oldestTime = t; oldestIdx = i; }
      }
      history.splice(oldestIdx, 1);
    }

    this.set('syncHistory', history);
    return entry;
  }

  clearSyncHistory() {
    this.set('syncHistory', []);
  }

  // ---- Versions ----

  getVersionsDir(gameId) {
    const dir = path.join(this.versionsDir, gameId);
    this.ensureDir(dir);
    return dir;
  }

  // ---- Utilities ----

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new ConfigStore();
