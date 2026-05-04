/**
 * UI Manager - 管理 UI 状态和通用功能
 */
class UIManager {
  constructor() {
    this.currentPage = 'games';
    this.toastId = 0;
  }

  // ---- Navigation ----
  switchPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById(`page-${pageName}`);
    const nav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (page) page.classList.add('active');
    if (nav) nav.classList.add('active');
    this.currentPage = pageName;
  }

  // ---- Modal ----
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('visible');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('visible');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
  }

  // ---- Toast Notifications ----
  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const id = ++this.toastId;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = `toast-${id}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="ui.removeToast(${id})">&times;</button>
    `;
    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(() => this.removeToast(id), duration);
    }
    return id;
  }

  removeToast(id) {
    const toast = document.getElementById(`toast-${id}`);
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 200);
    }
  }

  // ---- Tabs ----
  initTabs(containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        if (callback) callback(tabName);
      });
    });
  }

  // ---- Toggle ----
  initToggle(id, initialState, callback) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    if (initialState) toggle.classList.add('active');
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const active = toggle.classList.contains('active');
      if (callback) callback(active);
    });
  }

  setToggle(id, state) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    if (state) toggle.classList.add('active');
    else toggle.classList.remove('active');
  }

  // ---- Status Bar ----
  updateStatusBar(data) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const games = document.getElementById('status-games');
    const lastSync = document.getElementById('status-last-sync');

    if (data.status === 'syncing') {
      dot.className = 'status-dot warning';
      text.textContent = data.message || '同步中...';
    } else if (data.status === 'error') {
      dot.className = 'status-dot error';
      text.textContent = data.message || '同步出错';
    } else {
      dot.className = 'status-dot';
      text.textContent = '就绪';
    }

    if (data.gameCount !== undefined) {
      games.textContent = `${data.gameCount} 个游戏`;
    }
    if (data.lastSync) {
      lastSync.textContent = `上次同步: ${data.lastSync}`;
    }
  }

  // ---- Format helpers ----
  formatSyncStatus(status) {
    const map = {
      'synced': { label: '已同步', class: 'status-synced', icon: '✅' },
      'syncing': { label: '同步中', class: 'status-syncing', icon: '🔄' },
      'pending': { label: '待同步', class: 'status-pending', icon: '⏳' },
      'conflict': { label: '冲突', class: 'status-pending', icon: '⚠️' },
      'error': { label: '错误', class: 'status-error', icon: '❌' },
      'idle': { label: '未同步', class: 'status-idle', icon: '⏸️' }
    };
    return map[status] || map['idle'];
  }

  formatTimeAgo(dateStr) {
    if (!dateStr) return '从未';
    const now = Date.now();
    const d = new Date(dateStr).getTime();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小时前`;
    const days = Math.floor(hrs / 24);
    return `${days} 天前`;
  }

  // ---- Confirm dialog (simple) ----
  confirm(message) {
    return new Promise((resolve) => {
      // Use a simple browser confirm for now
      resolve(window.confirm(message));
    });
  }
}

// Global instance
const ui = new UIManager();
