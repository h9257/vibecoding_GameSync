/**
 * Dialogs - 对话框管理
 */
class Dialogs {
  constructor() {
    this.selectedPreset = null;
    this.currentDetailGameId = null;
  }

  init() {
    this.initAddGameDialog();
    this.initAddTargetDialog();
    this.initGameDetailDialog();
    this.initCloseButtons();
  }

  initCloseButtons() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => ui.closeAllModals());
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) ui.closeAllModals();
      });
    });
  }

  // ==== Add Game Dialog ====
  initAddGameDialog() {
    ui.initTabs('add-game-tabs', (tab) => {
      document.getElementById('tab-preset').style.display = tab === 'preset' ? 'block' : 'none';
      document.getElementById('tab-custom').style.display = tab === 'custom' ? 'block' : 'none';
    });

    document.getElementById('btn-confirm-add-game').addEventListener('click', () => this.confirmAddGame());
    document.getElementById('btn-browse-path').addEventListener('click', async () => {
      const p = await window.api.selectFolder('选择存档文件夹');
      if (p) document.getElementById('custom-game-path').value = p;
    });

    document.getElementById('preset-search-input').addEventListener('input', (e) => {
      this.filterPresets(e.target.value);
    });

    // Emoji Picker Logic
    const btnEmoji = document.getElementById('custom-game-icon-btn');
    const inputEmoji = document.getElementById('custom-game-icon');
    const dropdownEmoji = document.getElementById('emoji-picker-dropdown');
    
    const emojis = [
      // 游戏相关
      '🎮', '🕹️', '🎲', '💻', '⚔️', '🏎️', '⚽', '🎯', '🧩', '🏆',
      // 状态/标志
      '⭐', '🔥', '🔮', '🚀', '🗡️', '👑', '💎', '🛡️', '⚡', '💣',
      // 物品/工具
      '📱', '🔧', '📦', '🔑', '🔋', '📜', '💊', '🩸', '🎵', '🎨',
      // 场景/自然
      '🏰', '🌌', '🌍', '⛺', '🏝️', '❄️', '🌲', '🌋', '🌊', '☠️',
      // 生物/角色
      '👾', '👻', '👽', '🤖', '🐉', '🦖', '🦄', '🧛', '🧟', '🧙'
    ];
    dropdownEmoji.innerHTML = emojis.map(e => `<div class="emoji-option">${e}</div>`).join('');
    
    btnEmoji.addEventListener('click', () => {
      dropdownEmoji.style.display = dropdownEmoji.style.display === 'none' ? 'grid' : 'none';
    });
    
    dropdownEmoji.querySelectorAll('.emoji-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const selected = opt.textContent;
        btnEmoji.textContent = selected;
        inputEmoji.value = selected;
        dropdownEmoji.style.display = 'none';
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!btnEmoji.contains(e.target) && !dropdownEmoji.contains(e.target)) {
        dropdownEmoji.style.display = 'none';
      }
    });
  }

  async openAddGame(editGameId = null) {
    this.editingGameId = editGameId;
    this.selectedPreset = null;
    document.getElementById('preset-search-input').value = '';
    document.getElementById('custom-game-name').value = '';
    document.getElementById('custom-game-path').value = '';
    document.getElementById('custom-game-icon').value = '🎮';
    document.getElementById('custom-game-icon-btn').textContent = '🎮';
    document.getElementById('emoji-picker-dropdown').style.display = 'none';
    
    const tp = document.getElementById('toggle-preset-pack');
    const tc = document.getElementById('toggle-custom-pack');
    if (tp) tp.classList.remove('active');
    if (tc) tc.classList.remove('active');
    
    // Bind toggle clicks
    if (tp) tp.onclick = () => tp.classList.toggle('active');
    if (tc) tc.onclick = () => tc.classList.toggle('active');

    const titleEl = document.getElementById('add-game-modal-title');
    const btnEl = document.getElementById('btn-confirm-add-game');
    const tabsEl = document.getElementById('add-game-tabs');

    if (editGameId) {
      const game = gameList.getGame(editGameId);
      if (game) {
        titleEl.textContent = '编辑游戏';
        btnEl.textContent = '保存';
        tabsEl.style.display = 'none'; // Hide tabs when editing
        
        // Force switch to custom tab
        document.querySelector('#add-game-tabs .tab[data-tab="custom"]').click();
        
        document.getElementById('custom-game-name').value = game.name || '';
        document.getElementById('custom-game-path').value = game.localPath || '';
        document.getElementById('custom-game-icon').value = game.icon || '🎮';
        document.getElementById('custom-game-icon-btn').textContent = game.icon || '🎮';
        if (game.packMode && tc) tc.classList.add('active');
      }
    } else {
      titleEl.textContent = '添加游戏';
      btnEl.textContent = '添加';
      tabsEl.style.display = 'flex';
      // Default to preset tab
      document.querySelector('#add-game-tabs .tab[data-tab="preset"]').click();
    }

    await this.loadPresets();
    ui.openModal('modal-add-game');
  }

  async loadPresets() {
    try {
      const presets = await window.api.getPresetGames();
      this.renderPresets(presets);
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  }

  renderPresets(presets) {
    const list = document.getElementById('preset-list');
    list.innerHTML = presets.map(p => {
      const fs = require ? '' : '';
      return `
        <div class="preset-item" data-key="${p.key}">
          <span class="preset-icon">${p.icon}</span>
          <span class="preset-name">${p.name}</span>
          <span class="preset-category">${p.category}</span>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', () => {
        list.querySelectorAll('.preset-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedPreset = presets.find(p => p.key === item.dataset.key);
      });
    });
  }

  async filterPresets(query) {
    try {
      const results = query ? await window.api.searchPresetGames(query) : await window.api.getPresetGames();
      this.renderPresets(results);
    } catch (e) {
      console.error('Search error:', e);
    }
  }

  async confirmAddGame() {
    const activeTab = document.querySelector('#add-game-tabs .tab.active').dataset.tab;

    let game;
    if (activeTab === 'preset' && this.selectedPreset) {
      const packMode = document.getElementById('toggle-preset-pack')?.classList.contains('active') || false;
      game = {
        name: this.selectedPreset.name,
        localPath: this.selectedPreset.resolvedPath,
        icon: this.selectedPreset.icon,
        autoSync: false,
        packMode
      };
    } else if (activeTab === 'custom') {
      const name = document.getElementById('custom-game-name').value.trim();
      const pathVal = document.getElementById('custom-game-path').value.trim();
      const icon = document.getElementById('custom-game-icon').value.trim() || '🎮';
      const packMode = document.getElementById('toggle-custom-pack')?.classList.contains('active') || false;
      if (!name) { ui.toast('请输入游戏名称', 'warning'); return; }
      if (!pathVal) { ui.toast('请选择存档路径', 'warning'); return; }
      game = { name, localPath: pathVal, icon, autoSync: false, packMode };
    } else {
      ui.toast('请选择一个游戏或自定义添加', 'warning');
      return;
    }

    try {
      if (this.editingGameId) {
        await window.api.updateGame(this.editingGameId, game);
        ui.closeModal('modal-add-game');
        ui.toast(`已保存: ${game.name}`, 'success');
        
        // Update detail view if it's currently open
        if (this.currentDetailGameId === this.editingGameId) {
          this.openGameDetail(this.editingGameId);
        }
      } else {
        await window.api.addGame(game);
        ui.closeModal('modal-add-game');
        ui.toast(`已添加: ${game.name}${game.packMode ? ' (打包模式)' : ''}`, 'success');
      }
      await gameList.load();
    } catch (e) {
      ui.toast(`保存失败: ${e.message}`, 'error');
    }
  }

  // ==== Add Target Dialog ====
  initAddTargetDialog() {
    document.getElementById('target-type').addEventListener('change', (e) => {
      const isWebDAV = e.target.value === 'webdav';
      document.getElementById('target-local-fields').style.display = isWebDAV ? 'none' : 'block';
      document.getElementById('target-webdav-fields').style.display = isWebDAV ? 'block' : 'none';
    });

    document.getElementById('btn-browse-target').addEventListener('click', async () => {
      const p = await window.api.selectFolder('选择同步目标文件夹');
      if (p) document.getElementById('target-local-path').value = p;
    });

    document.getElementById('btn-test-target').addEventListener('click', () => this.testTarget());
    document.getElementById('btn-confirm-add-target').addEventListener('click', () => this.confirmAddTarget());
  }

  openAddTarget() {
    document.getElementById('target-name').value = '';
    document.getElementById('target-type').value = 'local';
    document.getElementById('target-local-path').value = '';
    document.getElementById('target-webdav-url').value = '';
    document.getElementById('target-webdav-user').value = '';
    document.getElementById('target-webdav-pass').value = '';
    document.getElementById('target-local-fields').style.display = 'block';
    document.getElementById('target-webdav-fields').style.display = 'none';
    document.getElementById('target-test-result').textContent = '';
    ui.openModal('modal-add-target');
  }

  buildTargetFromForm() {
    const type = document.getElementById('target-type').value;
    const name = document.getElementById('target-name').value.trim();
    if (!name) return null;

    if (type === 'local') {
      const path = document.getElementById('target-local-path').value.trim();
      if (!path) return null;
      return { name, type, path };
    } else {
      const url = document.getElementById('target-webdav-url').value.trim();
      if (!url) return null;
      return {
        name, type, url,
        remotePath: document.getElementById('target-webdav-path').value.trim() || '/GameSync',
        username: document.getElementById('target-webdav-user').value.trim(),
        password: document.getElementById('target-webdav-pass').value.trim()
      };
    }
  }

  async testTarget() {
    const target = this.buildTargetFromForm();
    if (!target) { ui.toast('请填写完整信息', 'warning'); return; }

    const result = document.getElementById('target-test-result');
    result.textContent = '测试中...';
    result.style.color = 'var(--text-muted)';

    try {
      const res = await window.api.testSyncTarget(target);
      result.textContent = res.message;
      result.style.color = res.success ? 'var(--success)' : 'var(--danger)';
    } catch (e) {
      result.textContent = `测试失败: ${e.message}`;
      result.style.color = 'var(--danger)';
    }
  }

  async confirmAddTarget() {
    const target = this.buildTargetFromForm();
    if (!target) {
      ui.toast('请填写名称和路径', 'warning');
      return;
    }
    try {
      await window.api.addSyncTarget(target);
      ui.closeModal('modal-add-target');
      ui.toast(`已添加同步目标: ${target.name}`, 'success');
      await loadTargets();
    } catch (e) {
      ui.toast(`添加失败: ${e.message}`, 'error');
    }
  }

  // ==== Game Detail Dialog ====
  initGameDetailDialog() {
    ui.initTabs('detail-tabs', (tab) => {
      document.getElementById('tab-detail-info').style.display = tab === 'detail-info' ? 'block' : 'none';
      document.getElementById('tab-detail-versions').style.display = tab === 'detail-versions' ? 'block' : 'none';
      if (tab === 'detail-versions') this.loadVersions();
    });

    document.getElementById('btn-delete-game').addEventListener('click', () => this.deleteCurrentGame());
    document.getElementById('btn-edit-game').addEventListener('click', () => {
      if (this.currentDetailGameId) {
        ui.closeModal('modal-game-detail');
        this.openAddGame(this.currentDetailGameId);
      }
    });
    document.getElementById('btn-detail-upload').addEventListener('click', () => {
      if (this.currentDetailGameId) gameList.handleAction(this.currentDetailGameId, 'upload');
    });
    document.getElementById('btn-detail-download').addEventListener('click', () => {
      if (this.currentDetailGameId) gameList.handleAction(this.currentDetailGameId, 'download');
    });
  }

  async openGameDetail(gameId) {
    this.currentDetailGameId = gameId;
    const game = gameList.getGame(gameId);
    if (!game) return;

    document.getElementById('detail-game-name').textContent = `${game.icon || '🎮'} ${game.name}`;

    // Load comparison info
    let compareInfo = '';
    try {
      const cmp = await window.api.compareGame(gameId);
      const statusText = {
        synced: '✅ 已同步，两端一致',
        local_newer: '📤 本地有更新，需要上传',
        remote_newer: '📥 远端有更新，需要下载',
        conflict: '⚠️ 两端都有更新，存在冲突',
        local_only: '📤 仅本地有存档',
        remote_only: '📥 仅远端有存档',
        never_synced: '🆕 尚未同步过',
        no_target: '⚠️ 未配置同步目标',
        empty: '📭 两端都没有存档'
      };
      compareInfo = `
        <div class="settings-section" style="margin-top:0">
          <div class="settings-section-title">📊 同步状态</div>
          <div style="font-size:14px;padding:8px 0">${statusText[cmp.status] || cmp.status}</div>
          ${cmp.localInfo ? `
          <div class="settings-row">
            <div>
              <div class="settings-row-label">本地存档</div>
              <div class="settings-row-desc">${cmp.localInfo.exists ? `${cmp.localInfo.fileCount} 个文件, ${cmp.localInfo.totalSizeFormatted}, 最后修改: ${cmp.localInfo.latestModifiedDate}` : '不存在'}</div>
            </div>
          </div>` : ''}
          ${cmp.remoteInfo ? `
          <div class="settings-row">
            <div>
              <div class="settings-row-label">远端存档</div>
              <div class="settings-row-desc">${cmp.remoteInfo.exists ? `最后修改: ${cmp.remoteInfo.latestModifiedDate || '未知'}` : '不存在'}</div>
            </div>
          </div>` : ''}
        </div>
      `;
    } catch (e) {
      compareInfo = `<div style="color:var(--text-muted);font-size:13px">无法获取同步状态</div>`;
    }

    document.getElementById('detail-info-content').innerHTML = `
      ${compareInfo}
      <div class="settings-section">
        <div class="settings-section-title">📋 游戏信息</div>
        <div class="settings-row">
          <div class="settings-row-label">存档路径</div>
          <div style="font-size:12px;color:var(--text-muted);word-break:break-all">${game.localPath}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">上次同步</div>
          <div style="font-size:12px;color:var(--text-muted)">${game.lastSyncTime ? new Date(game.lastSyncTime).toLocaleString('zh-CN') : '从未'}</div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">自动同步</div>
            <div class="settings-row-desc">存档变化时自动上传备份</div>
          </div>
          <div class="toggle ${game.autoSync ? 'active' : ''}" id="toggle-detail-autosync">
            <div class="toggle-track"></div>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">📦 打包模式</div>
            <div class="settings-row-desc">压缩为 ZIP 后同步，适合普通应用数据</div>
          </div>
          <div class="toggle ${game.packMode ? 'active' : ''}" id="toggle-detail-packmode">
            <div class="toggle-track"></div>
          </div>
        </div>
      </div>
    `;

    // Bind auto-sync toggle
    const toggle = document.getElementById('toggle-detail-autosync');
    if (toggle) {
      toggle.addEventListener('click', async () => {
        toggle.classList.toggle('active');
        const enabled = toggle.classList.contains('active');
        await window.api.toggleAutoSync(gameId, enabled);
        await gameList.load();
      });
    }

    // Bind pack mode toggle
    const packToggle = document.getElementById('toggle-detail-packmode');
    if (packToggle) {
      packToggle.addEventListener('click', async () => {
        packToggle.classList.toggle('active');
        const enabled = packToggle.classList.contains('active');
        await window.api.updateGame(gameId, { packMode: enabled });
        await gameList.load();
        ui.toast(enabled ? '已开启打包模式' : '已关闭打包模式', 'info', 2000);
      });
    }

    // Reset to info tab
    document.querySelectorAll('#detail-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#detail-tabs .tab[data-tab="detail-info"]').classList.add('active');
    document.getElementById('tab-detail-info').style.display = 'block';
    document.getElementById('tab-detail-versions').style.display = 'none';

    ui.openModal('modal-game-detail');
  }

  async loadVersions() {
    const container = document.getElementById('detail-versions-list');
    if (!this.currentDetailGameId) return;

    try {
      const versions = await window.api.getVersions(this.currentDetailGameId);
      if (versions.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:30px"><div class="empty-icon">📦</div><div class="empty-title">暂无版本历史</div><div class="empty-desc">同步操作时会自动创建版本备份</div></div>`;
        return;
      }

      container.innerHTML = `<div class="version-list">${versions.map(v => `
        <div class="version-item">
          <span class="version-date">📦 ${v.date}</span>
          <span class="version-size">${v.sizeFormatted}</span>
          <div class="version-actions">
            <button class="btn btn-secondary btn-sm" data-restore="${v.id}">还原</button>
            <button class="btn btn-danger btn-sm" data-delete-version="${v.id}">删除</button>
          </div>
        </div>
      `).join('')}</div>`;

      container.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await ui.confirm('确定要还原到此版本吗？当前存档会先自动备份。');
          if (!ok) return;
          try {
            await window.api.restoreVersion(this.currentDetailGameId, btn.dataset.restore);
            ui.toast('版本还原成功', 'success');
            this.loadVersions();
          } catch (e) { ui.toast(`还原失败: ${e.message}`, 'error'); }
        });
      });

      container.querySelectorAll('[data-delete-version]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await ui.confirm('确定删除此版本备份？');
          if (!ok) return;
          await window.api.deleteVersion(this.currentDetailGameId, btn.dataset.deleteVersion);
          ui.toast('版本已删除', 'success');
          this.loadVersions();
        });
      });
    } catch (e) {
      container.innerHTML = `<div style="color:var(--danger);font-size:13px">加载失败: ${e.message}</div>`;
    }
  }

  async deleteCurrentGame() {
    if (!this.currentDetailGameId) return;
    const game = gameList.getGame(this.currentDetailGameId);
    const ok = await ui.confirm(`确定要删除「${game?.name || ''}」吗？此操作不会删除实际的存档文件。`);
    if (!ok) return;
    try {
      await window.api.removeGame(this.currentDetailGameId);
      ui.closeModal('modal-game-detail');
      ui.toast('游戏已删除', 'success');
      await gameList.load();
    } catch (e) {
      ui.toast(`删除失败: ${e.message}`, 'error');
    }
  }
}

// Global instance
const dialogs = new Dialogs();
