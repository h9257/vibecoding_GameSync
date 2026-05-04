const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
  }

  create(mainWindow) {
    this.mainWindow = mainWindow;

    // Create a simple tray icon using nativeImage (16x16 blue square)
    const iconSize = 16;
    const canvas = Buffer.alloc(iconSize * iconSize * 4);
    for (let i = 0; i < iconSize * iconSize; i++) {
      const x = i % iconSize, y = Math.floor(i / iconSize);
      // Purple gradient icon
      canvas[i * 4] = 100 + Math.floor(x * 8);     // R
      canvas[i * 4 + 1] = 50 + Math.floor(y * 4);  // G
      canvas[i * 4 + 2] = 220;                       // B
      canvas[i * 4 + 3] = 255;                       // A
    }
    const icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

    this.tray = new Tray(icon);
    this.tray.setToolTip('GameSync - 游戏存档同步器');
    this.updateMenu();

    this.tray.on('double-click', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
  }

  updateMenu(syncingGame = null) {
    const statusLabel = syncingGame
      ? `正在同步: ${syncingGame}`
      : '✅ 就绪';

    const contextMenu = Menu.buildFromTemplate([
      { label: 'GameSync 存档同步器', enabled: false },
      { type: 'separator' },
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      {
        label: '显示主窗口',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }
      },
      {
        label: '同步所有游戏',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('sync:triggerAll');
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.destroy();
          }
          if (this.tray) {
            this.tray.destroy();
          }
          require('electron').app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = new TrayManager();
