# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Config

- **user.name:** hanmiao
- **user.email:** hanmiao20@qq.com

## Project Overview

GameSync is a Windows-only Electron desktop app for synchronizing game save files across devices. Supports local directory sync and WebDAV remote sync, with optional ZIP pack mode and automatic version backups. Built as a "Vibecoding" project (human-AI conversational collaboration).

## Commands

```bash
npm install          # Install dependencies
npm start            # Run in development (electron .)
npm run package      # Package x64 Windows executable via electron-packager → dist/
npm run package:arm64 # Package ARM64 Windows executable
npm run build        # Build NSIS installer via electron-builder
npm run pack         # Package to directory (no installer) via electron-builder
```

No test framework or linter is configured.

## Architecture

Standard Electron three-process model with `contextIsolation: true`, `nodeIntegration: false`.

### Main Process (`src/main/`)

- **main.js** — Entry point. Creates BrowserWindow, registers ~30 IPC handlers, manages app lifecycle and single-instance lock.
- **config-store.js** — JSON file-based config store (games, targets, settings, version history). Singleton. Supports data directory migration via `bootstrap.json` indirection.
- **sync-engine.js** — Core sync logic: upload/download (local copy or WebDAV), pack/unpack ZIP mode, version backup/restore, conflict detection by timestamp comparison.
- **game-database.js** — Hardcoded database of 24 preset games with Windows save paths using env var placeholders.
- **file-watcher.js** — `chokidar` watcher on game save dirs, 5s debounce, triggers auto-sync.
- **tray.js** — System tray icon and context menu.

### Preload (`src/preload/preload.js`)

Exposes `window.api` via `contextBridge` with ~25 methods covering all IPC channels plus event listeners for sync progress/completion/errors.

### Renderer (`src/renderer/`)

- **app.js** — Init, page navigation, settings, IPC callback binding.
- **game-list.js** — `GameList` class: loads/renders game cards with upload/download/sync/open actions.
- **dialogs.js** — `Dialogs` class: Add Game (preset + custom tabs, emoji picker), Add Target (local + WebDAV), Game Detail modals.
- **ui-manager.js** — `UIManager` class: page switching, modals, toasts, tabs, toggles, status bar, formatting helpers.

### Data Flow

```
Renderer → window.api (preload) → ipcRenderer → ipcMain (main.js)
                                                       ↓
                                            config-store / sync-engine / file-watcher
```

### Sync Flow

Sync direction determined by comparing local vs. remote timestamps against `lastSyncTime`. Modes: `upload`, `download`, `auto`, `conflict`. Two transfer modes: normal (recursive copy or WebDAV PUT/GET) and pack (ZIP compress first). Downloads auto-create version backups before overwriting.

## Runtime Data

Config stored at `%APPDATA%/gamesync/GameSync/`:
- `config.json` — games, targets, settings
- `bootstrap.json` — custom data directory pointer (if migrated)
- `versions/<gameId>/` — timestamped ZIP version backups (max 10 by default)

## Dependencies

Only two runtime deps: `adm-zip` (ZIP handling) and `chokidar` (file watching). Node.js 18+ required.
