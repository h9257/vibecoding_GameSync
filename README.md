# 🎮 GameSync - 游戏存档同步大师

<p align="center">
  <strong>跨设备同步你的游戏存档，再也不用担心存档丢失</strong>
</p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows-blue?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Electron-33.x-47848F?style=flat-square&logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/🤖_Vibecoding-AI_Assisted-blueviolet?style=flat-square" alt="Vibecoding" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

> [!IMPORTANT]
> **🤖 关于本项目 (Vibecoding)**  
> 本项目是一个彻底的 **Vibecoding（氛围编程）** 实践项目。开发者仅负责描述需求、提出想法、反馈问题，而**所有的架构设计、代码编写、性能优化和打包配置均由 AI 独立完成**。
> 这展现了 AI 辅助开发在桌面级复杂应用中的巨大潜力。

---

## ✨ 核心特性

- ⚡ **高性能异步引擎** — 彻底重构的底层 I/O 引擎。目录扫描、ZIP 压缩打包、文件读写均采用全异步非阻塞架构，即使处理包含数万个文件的庞大存档，UI 依然保持丝滑，告别卡顿。
- 🔄 **智能双向同步** — 自动检测本地与远程的数据差异，提供清晰的上传、下载操作，智能提示冲突状态。
- 📁 **多协议目标支持** — 不仅支持本地目录（适合挂载的 NAS 或云同步盘），还原生支持 **WebDAV** 服务器（坚果云、Nextcloud 等）。
- 🛡️ **自定义文件过滤** — 内置强大的文件过滤机制，可轻松排除无需同步的庞大 Mod 文件或日志缓存，大幅节约同步时间与空间。
- ⏳ **时间轴与版本历史** — 每次同步都会在本地和云端自动创建 `.zip` 格式的历史版本备份。通过直观的时间轴，随时一键“时光倒流”，挽回错误的覆盖。
- 📦 **智能打包模式** — 针对文件极其细碎的游戏，开启打包模式后会将其作为一个整体 ZIP 传输，极大地优化网络和磁盘 I/O 效率。
- 🕹️ **内置 25+ 热门游戏预设** — 一键添加《艾尔登法环》、《赛博朋克2077》、《我的世界》、《星露谷物语》等主流大作，免去手动寻找存档路径的烦恼。
- 👁️ **无感后台监控** — 自动监控存档目录的文件变动，静默完成备份；支持开机自启和最小化到系统托盘，绝不打扰你的游戏体验。

---

## 📸 界面预览

*(你可以稍后在此处补充应用的运行截图)*
<!-- ![主界面](screenshots/main.png) -->
<!-- ![版本时间轴](screenshots/timeline.png) -->

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+ 或更高版本
- Windows 10 / Windows 11

### 源码运行

```bash
# 克隆项目
git clone https://github.com/h9257/vibecoding_GameSync.git
cd vibecoding_GameSync

# 安装依赖
npm install

# 启动开发模式 (附带 Chrome 开发者工具)
npm start
```

### 构建与打包可执行程序

如果你想生成发给其他用户使用的安装包或绿色版：

```bash
# 构建所有 Windows 版本 (x64 + ARM64)
npm run build:all

# 仅构建 x64 版本
npm run build:win32x64

# 仅构建 ARM64 版本 (骁龙处理器笔记本)
npm run build:win32arm64
```

打包产物通常会生成在 `dist/` 目录下。

---

## 🏗️ 项目架构

本项目基于 `Electron` 构建，前后端分离清晰：

```text
src/
├── main/                    # Electron 主进程 (Node.js)
│   ├── main.js              # 应用生命周期管理
│   ├── sync-engine.js       # ⚡ 核心异步同步引擎 (队列、I/O)
│   ├── file-watcher.js      # 基于 chokidar 的变动监控
│   ├── config-store.js      # 配置与状态持久化
│   └── game-database.js     # 预置游戏数据库
├── preload/
│   └── preload.js           # 严格的 ContextBridge 安全通信层
└── renderer/                # 渲染进程 (纯净 HTML/CSS/JS)
    ├── index.html           # UI 结构
    ├── js/                  
    │   ├── app.js           # 渲染层控制器
    │   ├── ui-manager.js    # DOM 操作与动画管理
    │   └── dialogs.js       # 交互弹窗逻辑
    └── styles/              # 原生 CSS 暗色主题系统
```

---

## ⚙️ 数据与配置管理

GameSync 默认将你的应用配置和本地历史版本存放在：  
`%APPDATA%/gamesync/GameSync/`

如果你希望将所有配置和备份文件转移到其他磁盘（比如从 C 盘移到 D 盘），可以在软件的 **设置 → 📂 数据目录** 中一键更改，软件会自动无损迁移所有数据。

