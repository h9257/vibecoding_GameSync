/**
 * App.js - 应用入口和事件绑定
 */

// ---- Targets Page Rendering ----
async function loadTargets() {
  try {
    const targets = await window.api.getSyncTargets();
    const container = document.getElementById('targets-list');
    const empty = document.getElementById('targets-empty');

    if (targets.length === 0) {
      container.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    container.style.display = 'block';
    empty.style.display = 'none';

    container.innerHTML = targets.map(t => {
      const icon = t.type === 'webdav' ? '🌐' : '📁';
      const pathText = t.type === 'webdav' ? t.url : t.path;
      const openBtn = t.type === 'local' ? `<button class="btn btn-secondary btn-sm btn-icon" data-open-target="${t.id}" data-path="${t.path}" title="打开文件夹">📂</button>` : '';
      return `
        <div class="target-card animate-fade-in" data-target-id="${t.id}">
          <div class="target-icon">${icon}</div>
          <div class="target-info">
            <div class="target-name">${t.name}</div>
            <div class="target-path" title="${pathText}">${pathText}</div>
          </div>
          <div class="target-actions">
            ${openBtn}
            <button class="btn btn-danger btn-sm btn-icon" data-remove-target="${t.id}" title="删除">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-open-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.api.openPath(btn.dataset.path);
      });
    });

    container.querySelectorAll('[data-remove-target]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await ui.confirm('确定删除此同步目标？');
        if (!ok) return;
        await window.api.removeSyncTarget(btn.dataset.removeTarget);
        ui.toast('同步目标已删除', 'success');
        loadTargets();
      });
    });
  } catch (e) {
    console.error('Failed to load targets:', e);
  }
}

// ---- Recent Sync Page ----
async function loadRecent() {
  const container = document.getElementById('recent-list');
  try {
    const history = await window.api.getSyncHistory();

    if (!history || history.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">暂无同步记录</div><div class="empty-desc">同步游戏存档后会在此显示完整的同步时间线</div></div>`;
      return;
    }

    // Group by date
    const groups = {};
    history.forEach(entry => {
      const date = new Date(entry.timestamp);
      const key = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    let html = '<div class="sync-timeline">';
    for (const [dateLabel, entries] of Object.entries(groups)) {
      html += `<div class="timeline-date-group">`;
      html += `<div class="timeline-date-label">${dateLabel}</div>`;
      html += `<div class="timeline-entries">`;
      entries.forEach(entry => {
        const dirInfo = formatDirection(entry.direction);
        const statusInfo = formatHistoryStatus(entry.status);
        const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const targetLabel = entry.targetName ? `<span class="history-target">${entry.targetType === 'webdav' ? '🌐' : '📁'} ${entry.targetName}</span>` : '';
        const errorMsg = entry.errorMessage ? `<div class="history-error">❌ ${entry.errorMessage}</div>` : '';

        html += `
          <div class="timeline-entry animate-fade-in ${statusInfo.entryClass}">
            <div class="timeline-dot ${dirInfo.dotClass}"></div>
            <div class="timeline-connector"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <div class="timeline-game">
                  <span class="timeline-game-icon">${entry.gameIcon || '🎮'}</span>
                  <span class="timeline-game-name">${entry.gameName}</span>
                </div>
                <span class="timeline-time">${time}</span>
              </div>
              <div class="timeline-details">
                <span class="timeline-direction ${dirInfo.class}">
                  <span class="direction-arrow">${dirInfo.arrow}</span>
                  ${dirInfo.label}
                </span>
                <span class="timeline-status ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>
                ${targetLabel}
              </div>
              ${errorMsg}
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    console.error('Failed to load sync history:', e);
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

function formatDirection(direction) {
  const map = {
    'upload':   { label: '上传', arrow: '↑', class: 'dir-upload',   dotClass: 'dot-upload' },
    'download': { label: '下载', arrow: '↓', class: 'dir-download', dotClass: 'dot-download' },
    'conflict': { label: '冲突', arrow: '⇄', class: 'dir-conflict', dotClass: 'dot-conflict' },
    'unknown':  { label: '未知', arrow: '?', class: 'dir-unknown',  dotClass: 'dot-unknown' }
  };
  return map[direction] || map['unknown'];
}

function formatHistoryStatus(status) {
  const map = {
    'success':  { label: '成功', icon: '✅', class: 'hs-success',  entryClass: 'entry-success' },
    'error':    { label: '失败', icon: '❌', class: 'hs-error',    entryClass: 'entry-error' },
    'conflict': { label: '冲突', icon: '⚠️', class: 'hs-conflict', entryClass: 'entry-conflict' }
  };
  return map[status] || { label: status, icon: '❓', class: '', entryClass: '' };
}

// ---- Settings ----
async function loadSettings() {
  try {
    const settings = await window.api.getSettings();
    ui.setToggle('toggle-auto-sync', settings.autoSyncEnabled);
    ui.setToggle('toggle-minimize-tray', settings.minimizeToTray);
    document.getElementById('input-sync-interval').value = settings.autoSyncIntervalMinutes || 30;
    document.getElementById('input-max-versions').value = settings.maxVersions || 10;

    // Load config directory
    const configDir = await window.api.getConfigDir();
    document.getElementById('config-dir-display').textContent = configDir || '未知';
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function saveSettings(updates) {
  try {
    await window.api.updateSettings(updates);
  } catch (e) {
    ui.toast('保存设置失败', 'error');
  }
}

// ---- App Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize dialogs
  dialogs.init();

  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      ui.switchPage(page);
      if (page === 'targets') loadTargets();
      if (page === 'recent') loadRecent();
      if (page === 'settings') loadSettings();
    });
  });

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.close());

  // Add game buttons
  document.getElementById('btn-add-game').addEventListener('click', () => dialogs.openAddGame());
  document.getElementById('btn-add-game-empty').addEventListener('click', () => dialogs.openAddGame());

  // Add target buttons
  document.getElementById('btn-add-target').addEventListener('click', () => dialogs.openAddTarget());
  document.getElementById('btn-add-target-empty')?.addEventListener('click', () => dialogs.openAddTarget());

  // Clear sync history
  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    const ok = await ui.confirm('确定要清空所有同步记录吗？此操作不可恢复。');
    if (!ok) return;
    await window.api.clearSyncHistory();
    ui.toast('同步记录已清空', 'success');
    loadRecent();
  });

  // Sync all
  document.getElementById('btn-sync-all').addEventListener('click', async () => {
    const targets = await window.api.getSyncTargets();
    if (targets.length === 0) {
      ui.toast('请先配置同步目标', 'warning');
      ui.switchPage('targets');
      return;
    }
    ui.toast('正在同步所有游戏...', 'info', 3000);
    try {
      const results = await window.api.syncAllGames();
      const success = results.filter(r => r.status === 'success').length;
      const errors = results.filter(r => r.status === 'error').length;
      ui.toast(`同步完成: ${success} 成功, ${errors} 失败`, success > 0 ? 'success' : 'error');
      await gameList.load();
    } catch (e) {
      ui.toast(`同步失败: ${e.message}`, 'error');
    }
  });

  // Settings toggles
  ui.initToggle('toggle-auto-sync', false, (v) => saveSettings({ autoSyncEnabled: v }));
  ui.initToggle('toggle-minimize-tray', true, (v) => saveSettings({ minimizeToTray: v }));

  document.getElementById('input-sync-interval').addEventListener('change', (e) => {
    saveSettings({ autoSyncIntervalMinutes: parseInt(e.target.value) || 30 });
  });
  document.getElementById('input-max-versions').addEventListener('change', (e) => {
    saveSettings({ maxVersions: parseInt(e.target.value) || 10 });
  });

  // Config directory buttons
  document.getElementById('btn-change-config-dir').addEventListener('click', async () => {
    const newDir = await window.api.selectFolder('选择新的数据存储目录');
    if (!newDir) return;
    const ok = await ui.confirm(`确定要将数据目录迁移到\n${newDir}\n吗？现有数据将自动复制到新位置。`);
    if (!ok) return;
    ui.toast('正在迁移数据...', 'info', 5000);
    const result = await window.api.changeConfigDir(newDir);
    if (result.success) {
      ui.toast(result.message, 'success');
      document.getElementById('config-dir-display').textContent = result.newPath;
    } else {
      ui.toast(result.message, 'error');
    }
  });

  document.getElementById('btn-open-config-dir').addEventListener('click', async () => {
    const dir = await window.api.getConfigDir();
    if (dir) window.api.openPath(dir);
  });

  document.getElementById('btn-reset-config-dir').addEventListener('click', async () => {
    const ok = await ui.confirm('确定要恢复默认数据目录吗？现有数据将自动复制回默认位置。');
    if (!ok) return;
    const result = await window.api.resetConfigDir();
    if (result.success) {
      ui.toast('已恢复默认目录', 'success');
      document.getElementById('config-dir-display').textContent = result.newPath;
    } else {
      ui.toast(result.message, 'error');
    }
  });

  // IPC events from main process
  if (window.api.onSyncProgress) {
    window.api.onSyncProgress((data) => {
      ui.updateStatusBar({ status: 'syncing', message: data.message });
    });
  }
  if (window.api.onSyncComplete) {
    window.api.onSyncComplete((data) => {
      ui.updateStatusBar({ status: 'ready' });
      gameList.load();
    });
  }
  if (window.api.onSyncError) {
    window.api.onSyncError((data) => {
      ui.updateStatusBar({ status: 'error', message: data.message });
      ui.toast(`同步错误: ${data.message}`, 'error');
    });
  }
  if (window.api.onAutoSyncTriggered) {
    window.api.onAutoSyncTriggered((data) => {
      ui.toast(`检测到存档变化，自动同步: ${data.gameName}`, 'info', 3000);
    });
  }

  // Load initial data
  await gameList.load();
  await loadSettings();
  loadTargets();
});
