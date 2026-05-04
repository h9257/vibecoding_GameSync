const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ---- Window Controls ----
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // ---- Games ----
  getGames: () => ipcRenderer.invoke('games:list'),
  addGame: (game) => ipcRenderer.invoke('games:add', game),
  updateGame: (id, updates) => ipcRenderer.invoke('games:update', id, updates),
  removeGame: (id) => ipcRenderer.invoke('games:remove', id),

  // ---- Preset Game Database ----
  getPresetGames: () => ipcRenderer.invoke('presets:list'),
  searchPresetGames: (query) => ipcRenderer.invoke('presets:search', query),

  // ---- Sync Targets ----
  getSyncTargets: () => ipcRenderer.invoke('targets:list'),
  addSyncTarget: (target) => ipcRenderer.invoke('targets:add', target),
  updateSyncTarget: (id, updates) => ipcRenderer.invoke('targets:update', id, updates),
  removeSyncTarget: (id) => ipcRenderer.invoke('targets:remove', id),
  testSyncTarget: (target) => ipcRenderer.invoke('targets:test', target),

  // ---- Sync Operations ----
  syncGame: (gameId, direction) => ipcRenderer.invoke('sync:execute', gameId, direction),
  syncAllGames: () => ipcRenderer.invoke('sync:all'),
  compareGame: (gameId) => ipcRenderer.invoke('sync:compare', gameId),
  getSyncStatus: (gameId) => ipcRenderer.invoke('sync:status', gameId),

  // ---- Sync History ----
  getSyncHistory: () => ipcRenderer.invoke('history:list'),
  clearSyncHistory: () => ipcRenderer.invoke('history:clear'),

  // ---- Version Management ----
  getVersions: (gameId) => ipcRenderer.invoke('versions:list', gameId),
  restoreVersion: (gameId, versionId) => ipcRenderer.invoke('versions:restore', gameId, versionId),
  deleteVersion: (gameId, versionId) => ipcRenderer.invoke('versions:delete', gameId, versionId),

  // ---- Settings ----
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // ---- Config Directory ----
  getConfigDir: () => ipcRenderer.invoke('config:getDir'),
  changeConfigDir: (newDir) => ipcRenderer.invoke('config:changeDir', newDir),
  resetConfigDir: () => ipcRenderer.invoke('config:resetDir'),

  // ---- File Dialogs ----
  selectFolder: (title) => ipcRenderer.invoke('dialog:selectFolder', title),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

  // ---- File Watcher ----
  toggleAutoSync: (gameId, enabled) => ipcRenderer.invoke('watcher:toggle', gameId, enabled),

  // ---- Events from Main Process ----
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
  onSyncComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:complete', handler);
    return () => ipcRenderer.removeListener('sync:complete', handler);
  },
  onSyncError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:error', handler);
    return () => ipcRenderer.removeListener('sync:error', handler);
  },
  onFileChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('watcher:change', handler);
    return () => ipcRenderer.removeListener('watcher:change', handler);
  },
  onAutoSyncTriggered: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:autoTriggered', handler);
    return () => ipcRenderer.removeListener('sync:autoTriggered', handler);
  }
});
