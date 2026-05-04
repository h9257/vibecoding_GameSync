/**
 * API Shim - 浏览器兼容层
 * 当在浏览器中打开时（无 Electron preload），提供基于 HTTP fetch 的 window.api 实现
 * 使得同一套前端代码可以同时在 Electron 和浏览器中运行
 */
(function () {
  // If window.api already exists (Electron preload injected it), skip
  if (window.api) return;

  console.log('%c[API Shim] 🌐 Running in browser mode — using HTTP API', 'color: #3b82f6; font-weight: bold');

  const API_BASE = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`;

  async function apiCall(endpoint, body = null) {
    const opts = {
      method: body !== null ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  }

  window.api = {
    // ---- Window Controls (no-op in browser) ----
    minimize: () => console.log('[Browser] minimize — no-op'),
    maximize: () => console.log('[Browser] maximize — no-op'),
    close: () => { if (confirm('关闭此页面？')) window.close(); },

    // ---- Games ----
    getGames: () => apiCall('/games'),
    addGame: (game) => apiCall('/games/add', game),
    updateGame: (id, updates) => apiCall('/games/update', { id, updates }),
    removeGame: (id) => apiCall('/games/remove', { id }),

    // ---- Preset Game Database ----
    getPresetGames: () => apiCall('/presets'),
    searchPresetGames: (query) => apiCall('/presets/search', { query }),

    // ---- Sync Targets ----
    getSyncTargets: () => apiCall('/targets'),
    addSyncTarget: (target) => apiCall('/targets/add', target),
    updateSyncTarget: (id, updates) => apiCall('/targets/update', { id, updates }),
    removeSyncTarget: (id) => apiCall('/targets/remove', { id }),
    testSyncTarget: (target) => apiCall('/targets/test', target),

    // ---- Sync Operations ----
    syncGame: (gameId, direction) => apiCall('/sync/execute', { gameId, direction }),
    syncAllGames: () => apiCall('/sync/all'),
    compareGame: (gameId) => apiCall('/sync/compare', { gameId }),
    getSyncStatus: (gameId) => apiCall(`/sync/status/${gameId}`),

    // ---- Sync History ----
    getSyncHistory: () => apiCall('/history'),
    clearSyncHistory: () => apiCall('/history/clear'),

    // ---- Version Management ----
    getVersions: (gameId) => apiCall(`/versions/${gameId}`),
    restoreVersion: (gameId, versionId) => apiCall('/versions/restore', { gameId, versionId }),
    deleteVersion: (gameId, versionId) => apiCall('/versions/delete', { gameId, versionId }),

    // ---- Settings ----
    getSettings: () => apiCall('/settings'),
    updateSettings: (settings) => apiCall('/settings/update', settings),

    // ---- Config Directory ----
    getConfigDir: () => apiCall('/config/dir'),
    changeConfigDir: (newDir) => apiCall('/config/changeDir', { newDir }),
    resetConfigDir: () => apiCall('/config/resetDir'),

    // ---- File Dialogs (browser fallback) ----
    selectFolder: (title) => {
      const result = prompt(title || '请输入文件夹路径:');
      return Promise.resolve(result || null);
    },
    openPath: (filePath) => {
      alert(`📂 文件路径:\n${filePath}\n\n(浏览器模式下无法直接打开文件夹)`);
      return Promise.resolve();
    },

    // ---- File Watcher ----
    toggleAutoSync: (gameId, enabled) => apiCall('/watcher/toggle', { gameId, enabled }),

    // ---- File Scanning ----
    scanFiles: (gameId) => apiCall(`/files/scan/${gameId}`),

    // ---- Events (polling-based in browser) ----
    onSyncProgress: (callback) => { window._syncProgressCb = callback; return () => {}; },
    onSyncComplete: (callback) => { window._syncCompleteCb = callback; return () => {}; },
    onSyncError: (callback) => { window._syncErrorCb = callback; return () => {}; },
    onFileChange: (callback) => { window._fileChangeCb = callback; return () => {}; },
    onAutoSyncTriggered: (callback) => { window._autoSyncCb = callback; return () => {}; }
  };
})();
