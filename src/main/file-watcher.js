const chokidar = require('chokidar');
const configStore = require('./config-store');

class FileWatcher {
  constructor() {
    this.watchers = new Map(); // gameId -> watcher
    this.mainWindow = null;
    this.syncEngine = null;
    this.debounceTimers = new Map();
  }

  setSyncEngine(engine) { this.syncEngine = engine; }
  setMainWindow(win) { this.mainWindow = win; }

  watchGame(gameId) {
    const game = configStore.getGame(gameId);
    if (!game) return;
    this.unwatchGame(gameId);
    try {
      const watcher = chokidar.watch(game.localPath, {
        persistent: true, ignoreInitial: true, depth: 10,
        awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
      });
      watcher.on('change', (fp) => this.onFileChange(gameId, fp, 'change'));
      watcher.on('add', (fp) => this.onFileChange(gameId, fp, 'add'));
      watcher.on('unlink', (fp) => this.onFileChange(gameId, fp, 'delete'));
      this.watchers.set(gameId, watcher);
      console.log(`[Watcher] Watching: ${game.name} -> ${game.localPath}`);
    } catch (e) {
      console.error(`[Watcher] Error watching ${gameId}:`, e);
    }
  }

  unwatchGame(gameId) {
    const w = this.watchers.get(gameId);
    if (w) { w.close(); this.watchers.delete(gameId); }
    const t = this.debounceTimers.get(gameId);
    if (t) { clearTimeout(t); this.debounceTimers.delete(gameId); }
  }

  onFileChange(gameId, filePath, type) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('watcher:change', { gameId, filePath, type });
    }
    // Debounce auto-sync
    const existing = this.debounceTimers.get(gameId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(gameId);
      this.triggerAutoSync(gameId);
    }, 5000);
    this.debounceTimers.set(gameId, timer);
  }

  async triggerAutoSync(gameId) {
    const settings = configStore.getSettings();
    if (!settings.autoSyncEnabled) return;
    const game = configStore.getGame(gameId);
    if (!game || !game.autoSync) return;
    console.log(`[Watcher] Auto-syncing: ${game.name}`);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:autoTriggered', { gameId, gameName: game.name });
    }
    try {
      if (this.syncEngine) await this.syncEngine.syncGame(gameId, 'upload');
    } catch (e) {
      console.error(`[Watcher] Auto-sync error:`, e);
    }
  }

  startAll() {
    const games = configStore.getGames();
    for (const g of games) {
      if (g.autoSync) this.watchGame(g.id);
    }
  }

  stopAll() {
    for (const [id] of this.watchers) this.unwatchGame(id);
  }

  toggleWatch(gameId, enabled) {
    if (enabled) this.watchGame(gameId);
    else this.unwatchGame(gameId);
    configStore.updateGame(gameId, { autoSync: enabled });
  }
}

module.exports = new FileWatcher();
