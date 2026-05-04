/**
 * Game List - 游戏列表渲染和管理
 */
class GameList {
  constructor() {
    this.games = [];
  }

  async load() {
    try {
      this.games = await window.api.getGames();
      this.render();
      this.updateCount();
    } catch (e) {
      console.error('Failed to load games:', e);
    }
  }

  render() {
    const grid = document.getElementById('game-grid');
    const empty = document.getElementById('games-empty');

    if (this.games.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = this.games.map(game => this.renderCard(game)).join('');

    // Bind card events
    grid.querySelectorAll('.game-card').forEach(card => {
      const gameId = card.dataset.gameId;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.game-card-actions')) return;
        dialogs.openGameDetail(gameId);
      });
    });

    // Bind action buttons
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.closest('.game-card').dataset.gameId;
        const action = btn.dataset.action;
        this.handleAction(gameId, action);
      });
    });
  }

  renderCard(game) {
    const status = ui.formatSyncStatus(game.syncStatus || 'idle');
    const lastSync = ui.formatTimeAgo(game.lastSyncTime);
    const icon = game.icon || '🎮';
    const packBadge = game.packMode ? '<span style="font-size:10px;background:rgba(124,58,237,0.15);color:var(--accent-primary);padding:2px 6px;border-radius:8px;margin-left:6px">📦 打包</span>' : '';

    return `
      <div class="game-card hover-lift" data-game-id="${game.id}">
        <div class="game-card-header">
          <div class="game-icon">${icon}</div>
          <div class="game-info">
            <div class="game-name" title="${game.name}">${game.name}${packBadge}</div>
            <div class="game-path" title="${game.localPath}">${this.shortenPath(game.localPath)}</div>
          </div>
        </div>
        <div class="game-card-body">
          <span class="game-status ${status.class}">
            ${game.syncStatus === 'syncing' ? '<span class="sync-icon animate-spin">🔄</span>' : status.icon}
            ${status.label}
          </span>
          <span class="game-last-sync">${lastSync}</span>
        </div>
        <div class="game-card-actions">
          <button class="btn btn-secondary btn-sm" data-action="upload" title="上传存档">📤 上传</button>
          <button class="btn btn-secondary btn-sm" data-action="download" title="下载存档">📥 下载</button>
          <button class="btn btn-primary btn-sm" data-action="sync" title="智能同步">🔄 同步</button>
          <button class="btn btn-icon btn-secondary btn-sm" data-action="open" title="打开存档文件夹" style="margin-left:auto">📂</button>
        </div>
      </div>
    `;
  }

  async handleAction(gameId, action) {
    try {
      if (action === 'open') {
        const game = this.games.find(g => g.id === gameId);
        if (game) await window.api.openPath(game.localPath);
        return;
      }

      const dirMap = { upload: 'upload', download: 'download', sync: 'auto' };
      const direction = dirMap[action];
      if (!direction) return;

      // Check if targets exist
      const targets = await window.api.getSyncTargets();
      if (targets.length === 0) {
        ui.toast('请先添加同步目标', 'warning');
        ui.switchPage('targets');
        return;
      }

      ui.toast(`正在${action === 'upload' ? '上传' : action === 'download' ? '下载' : '同步'}...`, 'info', 2000);
      const result = await window.api.syncGame(gameId, direction);

      if (result.status === 'conflict') {
        ui.toast('存档冲突！请手动选择保留哪一方', 'warning', 6000);
      } else if (result.status === 'success') {
        ui.toast('同步完成！', 'success');
      }

      await this.load();
    } catch (e) {
      ui.toast(`同步失败: ${e.message}`, 'error');
      await this.load();
    }
  }

  updateCount() {
    const badge = document.getElementById('game-count');
    if (badge) badge.textContent = this.games.length;
    ui.updateStatusBar({ gameCount: this.games.length });
  }

  shortenPath(p) {
    if (!p) return '';
    if (p.length > 50) {
      const parts = p.split('\\');
      if (parts.length > 3) {
        return parts[0] + '\\...\\' + parts.slice(-2).join('\\');
      }
    }
    return p;
  }

  getGame(id) {
    return this.games.find(g => g.id === id);
  }
}

// Global instance
const gameList = new GameList();
