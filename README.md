# 🎮 GameSync - Windows 游戏存档同步器

<p align="center">
  <strong>跨设备同步你的游戏存档，再也不用担心存档丢失</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/🤖_Vibecoding-AI_Assisted-blueviolet?style=flat-square" />
  <img src="https://img.shields.io/badge/Platform-Windows-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Electron-33.x-47848F?style=flat-square&logo=electron" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

> [!IMPORTANT]
> **🤖 This is a Vibecoding Project!**
> 本项目是一个 **Vibecoding（氛围编程）** 项目 —— 完全通过人与 AI 协作对话的方式构建，开发者描述需求和想法，AI 负责编写所有代码。从架构设计、同步引擎、前端 UI 到打包发布，全部由 AI 辅助完成，展示了 Vibecoding 工作流的可能性。

---

## ✨ 功能特性

- 🔄 **双向同步** — 支持上传和下载存档，自动检测两端差异与冲突
- 📁 **多种同步目标** — 本地文件夹 / 云盘同步目录（OneDrive、Google Drive 等）/ WebDAV 服务器
- 📦 **打包模式** — 将存档文件夹压缩为 ZIP 后传输，适合文件数量多的应用数据
- 🕹️ **25+ 预置游戏** — 内置 Minecraft、Elden Ring、Stardew Valley、GTA V 等热门游戏的存档路径
- ⏱️ **自动同步** — 基于文件变动监控，检测到存档变化时自动备份
- 📜 **版本历史** — 每次同步自动创建压缩版本备份，支持一键回滚
- 🖥️ **系统托盘** — 最小化到托盘后台运行，不打扰游戏体验
- 🔒 **单实例锁** — 防止重复启动多个进程

## 🎮 支持的预置游戏

| 游戏 | 分类 | 游戏 | 分类 |
|------|------|------|------|
| ⛏️ Minecraft (Java/基岩版) | 沙盒 | ⚔️ Elden Ring | RPG |
| 🌾 Stardew Valley | RPG | 🗡️ Dark Souls III | RPG |
| 🐺 The Witcher 3 | RPG | 🤖 Cyberpunk 2077 | RPG |
| 🐉 Skyrim | RPG | ☢️ Fallout 4 | RPG |
| 🚗 GTA V | 动作 | 🤠 Red Dead Redemption 2 | 动作 |
| 🦋 Hollow Knight | 动作 | 🔥 Hades | Roguelike |
| 🌳 Terraria | 沙盒 | 🐟 Subnautica | 生存 |
| 🐾 Palworld | 生存 | ⚙️ Factorio | 建造 |
| ... 以及更多 | | | |

> 💡 也可以自定义添加任意游戏或应用的数据目录。

## 📸 截图

<!-- 如果有截图可以在这里添加 -->
<!-- ![主界面](screenshots/main.png) -->

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- Windows 10/11

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/h9257/vibecoding_GameSync.git
cd vibecoding_GameSync

# 安装依赖
npm install

# 启动开发模式
npm start
```

### 打包为可执行文件

```bash
# 打包 x64 版本（大多数 Windows 电脑）
npm run package

# 打包 ARM64 版本（Surface Pro X / 骁龙笔记本等）
npm run package:arm64
```

打包产物位于 `dist/GameSync-win32-x64/` 目录，其中 `GameSync.exe` 可直接运行。

## 🏗️ 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── main.js              # 应用入口 & IPC 处理
│   ├── config-store.js      # 配置存储（支持自定义数据目录）
│   ├── sync-engine.js       # 同步引擎（上传/下载/打包/版本管理）
│   ├── game-database.js     # 预置游戏存档路径数据库
│   ├── file-watcher.js      # 文件变动监控（chokidar）
│   └── tray.js              # 系统托盘管理
├── preload/
│   └── preload.js           # IPC 安全桥接（contextBridge）
└── renderer/                # 渲染进程（前端 UI）
    ├── index.html           # 主页面
    ├── js/
    │   ├── app.js            # 应用初始化 & 事件绑定
    │   ├── dialogs.js        # 对话框逻辑（添加/编辑游戏、同步目标）
    │   ├── game-list.js      # 游戏列表渲染
    │   └── ui-manager.js     # UI 工具函数
    └── styles/
        ├── main.css          # 主样式（暗色主题）
        └── components.css    # 组件样式
```

## ⚙️ 配置说明

### 数据存储位置

默认数据目录：`%APPDATA%/gamesync/GameSync/`

```
GameSync/
├── config.json       # 应用配置（游戏列表、同步目标、设置）
├── versions/         # 版本历史（每个游戏的存档备份，zip 格式）
│   └── <gameId>/
│       ├── 2026-04-22T13-00-00-000Z.zip
│       └── ...
└── bootstrap.json    # 引导文件（记录自定义数据目录路径）
```

> 数据目录可在 **设置 → 📂 数据目录** 中更改，迁移时会自动复制所有数据。

### 同步目标类型

| 类型 | 说明 |
|------|------|
| **本地文件夹** | 外部硬盘、NAS 挂载目录、OneDrive/Google Drive 等云盘同步文件夹 |
| **WebDAV** | 支持 WebDAV 协议的服务器（坚果云、Nextcloud、群晖 等） |

## 📦 打包模式

对于文件数量多但总体积不大的数据（如浏览器配置、IDE 设置），可以开启**打包模式**：

- 上传时：将整个文件夹压缩为 `.zip` 后作为单个文件上传
- 下载时：下载 `.zip` 后自动解压到目标目录
- 大幅减少 WebDAV 的请求次数，提升传输效率

## 🛠️ 技术栈

- **框架**: [Electron](https://www.electronjs.org/) 33.x
- **文件监控**: [chokidar](https://github.com/paulmillr/chokidar) 3.x
- **压缩**: [adm-zip](https://github.com/cthackers/adm-zip)
- **打包**: [electron-packager](https://github.com/electron/packager) / [electron-builder](https://www.electron.build/)
- **前端**: 原生 HTML/CSS/JS（暗色主题，无框架依赖）

## 📝 开发命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动开发模式 |
| `npm run package` | 打包 x64 可执行文件 |
| `npm run package:arm64` | 打包 ARM64 可执行文件 |
| `npm run build` | 构建 NSIS 安装包 |
| `npm run pack` | 仅打包为目录（不生成安装包） |

## 🤖 关于 Vibecoding

本项目是一个典型的 **Vibecoding（氛围编程）** 实践案例。

**什么是 Vibecoding？** Vibecoding 是一种全新的软件开发方式——开发者不直接编写代码，而是通过自然语言与 AI 对话，描述需求、提出想法、反馈问题，由 AI 完成所有代码的编写、调试和优化。

**本项目的 Vibecoding 过程：**

1. 🗣️ **需求描述** — "我需要做一个 Windows 游戏存档同步器"
2. 📐 **架构设计** — AI 生成实施计划，用户确认方向
3. 🔨 **逐步构建** — 通过对话迭代实现：同步引擎 → UI 界面 → 打包模式 → 版本历史 → 配置管理
4. 🐛 **实时调试** — 遇到问题直接描述现象，AI 定位并修复
5. 📦 **打包发布** — 从 exe 打包到 GitHub 推送，全程 AI 辅助

> 整个项目从零到可发布，全部代码均由 AI 在对话中生成。

## 📄 License

[MIT](LICENSE)
