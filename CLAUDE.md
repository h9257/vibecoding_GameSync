# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameSync is an Electron desktop app for Windows that synchronizes game save files across devices. It supports local folder and WebDAV sync targets, with features like pack mode (ZIP compression), version history, auto-sync via file watching, and 25+ preset game save paths. UI is in Simplified Chinese.

## Development Commands

```bash
npm start              # Run the Electron app
npm run dev            # Run with remote debugging (port 9222)
npm run package        # Package standalone x64 executable
npm run package:arm64  # Package for ARM64
npm run build          # Build NSIS installer (Windows)
npm run pack           # Package to directory without installer
```

There are no tests or linting configured.

## Architecture

### Process Model

- **Main process** (`src/main/`): Node.js backend with IPC handlers. All modules use singleton pattern (`module.exports = new ClassName()`).
- **Preload** (`src/preload/preload.js`): contextBridge exposing `window.api` with ~30 methods.
- **Renderer** (`src/renderer/`): Pure HTML/CSS/JS SPA with no framework. Four pages: Games, Recent Sync, Sync Targets, Settings.

### Key Modules

- `sync-engine.js`: Core sync logic. Direction detection compares local/remote timestamps against `lastSyncTime` (2s tolerance). Supports file copy (local) and raw HTTP PUT/GET/PROPFIND (WebDAV). Pack mode compresses to ZIP via `adm-zip`.
- `config-store.js`: JSON persistence at `%APPDATA%/gamesync/GameSync/config.json`. Handles games, targets, settings, history, versions.
- `game-database.js`: Hardcoded 25 preset games with Windows save paths using env vars (`%APPDATA%`, `%LOCALAPPDATA%`, `%USERPROFILE%`).
- `file-watcher.js`: chokidar-based auto-sync with 5-second debounce.

### IPC Pattern

Request-response via `ipcMain.handle` / `ipcRenderer.invoke`. Push notifications from main to renderer use `webContents.send` for channels: `sync:progress`, `sync:complete`, `sync:error`, `watcher:change`, `sync:autoTriggered`.

### File Filtering

`sync-engine.js` contains a custom glob-to-regex engine supporting `*`, `**`, `?` patterns for excluding files from sync. The directory scanner produces a tree structure for the UI filter tab.

## Key Dependencies

- `adm-zip`: ZIP operations for pack mode and version backups
- `chokidar`: File system watching for auto-sync
- WebDAV is implemented with raw Node.js `http`/`https` (no client library)

## Conventions

- No TypeScript, no bundler, no transpilation — raw JS loaded directly
- All main-process modules are singletons
- Dark theme via CSS custom properties in `src/renderer/styles/main.css`
- IDs generated with `Date.now().toString(36) + random`
- Config supports data directory migration via a bootstrap file in `%APPDATA%`
