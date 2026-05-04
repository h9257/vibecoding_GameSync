const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const configStore = require('./config-store');
const gameDatabase = require('./game-database');
const syncEngine = require('./sync-engine');
const fileWatcher = require('./file-watcher');
const trayManager = require('./tray');
const devServer = require('./dev-server');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Open DevTools automatically for debugging (as requested)
  // mainWindow.webContents.openDevTools(); // 因为改用浏览器访问了，不需要再弹出 Electron 的调试窗口

  // Wire up modules
  syncEngine.setMainWindow(mainWindow);
  fileWatcher.setMainWindow(mainWindow);
  fileWatcher.setSyncEngine(syncEngine);

  // Tray
  trayManager.create(mainWindow);

  // Minimize to tray
  mainWindow.on('close', (e) => {
    const settings = configStore.getSettings();
    if (settings.minimizeToTray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Start file watchers
  fileWatcher.startAll();
}

// ---- IPC Handlers ----

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// Games
ipcMain.handle('games:list', () => configStore.getGames());
ipcMain.handle('games:add', (_, game) => {
  const added = configStore.addGame(game);
  if (added.autoSync) fileWatcher.watchGame(added.id);
  return added;
});
ipcMain.handle('games:update', (_, id, updates) => configStore.updateGame(id, updates));
ipcMain.handle('games:remove', (_, id) => {
  fileWatcher.unwatchGame(id);
  configStore.removeGame(id);
});

// Preset database
ipcMain.handle('presets:list', () => gameDatabase.getAll());
ipcMain.handle('presets:search', (_, q) => gameDatabase.search(q));

// Sync targets
ipcMain.handle('targets:list', () => configStore.getSyncTargets());
ipcMain.handle('targets:add', (_, t) => configStore.addSyncTarget(t));
ipcMain.handle('targets:update', (_, id, u) => configStore.updateSyncTarget(id, u));
ipcMain.handle('targets:remove', (_, id) => configStore.removeSyncTarget(id));
ipcMain.handle('targets:test', (_, t) => syncEngine.testSyncTarget(t));

// Sync operations
ipcMain.handle('sync:execute', (_, gameId, dir) => syncEngine.syncGame(gameId, dir));
ipcMain.handle('sync:all', () => syncEngine.syncAllGames());
ipcMain.handle('sync:compare', (_, gameId) => syncEngine.compareGame(gameId));
ipcMain.handle('sync:status', (_, gameId) => {
  const g = configStore.getGame(gameId);
  return g ? { status: g.syncStatus, lastSync: g.lastSyncTime } : null;
});

// Sync History
ipcMain.handle('history:list', () => configStore.getSyncHistory());
ipcMain.handle('history:clear', () => { configStore.clearSyncHistory(); return { status: 'ok' }; });

// Versions
ipcMain.handle('versions:list', (_, gameId) => syncEngine.getVersions(gameId));
ipcMain.handle('versions:restore', (_, gid, vid) => syncEngine.restoreVersion(gid, vid));
ipcMain.handle('versions:delete', (_, gid, vid) => { syncEngine.deleteVersion(gid, vid); return { status: 'ok' }; });

// Settings
ipcMain.handle('settings:get', () => configStore.getSettings());
ipcMain.handle('settings:update', (_, s) => configStore.updateSettings(s));

// Config directory management
ipcMain.handle('config:getDir', () => configStore.getConfigDir());
ipcMain.handle('config:changeDir', async (_, newDir) => configStore.migrateDataDir(newDir));
ipcMain.handle('config:resetDir', async () => configStore.resetDataDir());

// Dialogs
ipcMain.handle('dialog:selectFolder', async (_, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || '选择文件夹',
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('shell:openPath', (_, p) => shell.openPath(p));

// File watcher
ipcMain.handle('watcher:toggle', (_, gameId, enabled) => {
  fileWatcher.toggleWatch(gameId, enabled);
});

// File scanning for filter UI
ipcMain.handle('files:scan', (_, gameId) => {
  const game = configStore.getGame(gameId);
  if (!game) throw new Error('游戏不存在');
  return syncEngine.scanDirectory(game.localPath, game.excludePatterns || []);
});

// ---- App Lifecycle ----

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus the existing window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    configStore.initPaths();
    configStore.load();
    createWindow();
    // Start HTTP dev server for browser access
    devServer.start(3000);
  });

  app.on('window-all-closed', () => {
    fileWatcher.stopAll();
    trayManager.destroy();
    devServer.stop();
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
  });
}
