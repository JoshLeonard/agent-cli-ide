# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal IDE - an Electron-based terminal orchestrator for managing multiple AI agents (Claude Code, Cursor, Aider) and shells in parallel. Uses Git worktrees for isolated terminal sessions with a customizable grid layout.

## Build and Run Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build:all    # Build all three processes (main, preload, renderer)
npm start            # Build everything and launch Electron
```

Individual builds:
- `npm run build:main` - Main process only
- `npm run build:preload` - Preload process only
- `npm run build:renderer` - Renderer process only (Vite)

Note: `node-pty` requires native rebuild via `electron-rebuild` (runs in postinstall).

## Testing

```bash
npm test              # Run tests in watch mode
npm test -- --run     # Run tests once (CI mode)
npm run test:ui       # Run with UI dashboard
npm run test:coverage # Generate coverage report
```

Test configurations:
- `vitest.config.ts` - Main process tests (Node environment)
- `vitest.config.renderer.ts` - Renderer tests (jsdom environment)

See [TESTING.md](./TESTING.md) for detailed testing guidelines and best practices.

## Architecture

Three-process Electron architecture:

**Main Process** (`src/main/`)
- `index.ts` - App entry, window creation
- `ipc/handlers.ts` - All IPC message handlers
- `session/Session.ts` - Individual terminal session wrapper
- `services/` - Core services:
  - `SessionRegistry.ts` - Session lifecycle
  - `GitWorktreeManager.ts` - Worktree creation/deletion
  - `AgentService.ts` - Agent discovery & config
  - `AgentStatusTracker.ts` - Agent activity state
  - `ActivityFeedService.ts` - Event logging
  - `MessagingService.ts` - Inter-session messaging
  - `PersistenceService.ts` - State persistence
  - `EventBus.ts` - App-wide pub/sub
  - `AutoUpdater.ts` - GitHub release auto-updates

**Preload Process** (`src/preload/`)
- Context isolation layer exposing safe APIs to renderer

**Renderer Process** (`src/renderer/`)
- `App.tsx` - Root component (large file)
- `components/` - React UI
  - `layout/` - GridLayout, TerminalPanel
  - `sidebar/` - SessionSidebar, ActivityFeed
  - `terminal/` - TerminalContainer (xterm wrapper)
  - `messaging/` - QuickSendDialog
- `stores/` - Zustand state (layoutStore, projectStore, etc.)

**Shared Types** (`src/shared/types/`)
- Type definitions shared between all processes
- IPC channel definitions in `ipc.ts`

## Key Patterns

**Session Types:**
- Attached: Terminal in project directory
- Isolated: Terminal in Git worktree (separate branch copy)

**State Management:**
- Zustand stores in renderer
- EventBus for cross-service communication in main
- Disk persistence for sessions, layout, activity

**IPC Channels:** Prefixed by domain (e.g., `session:create`, `agent:list`, `worktree:remove`)

## Tech Stack

- Electron 28, React 18, TypeScript 5.3
- Vite 5.0 for renderer bundling
- xterm 5.5 + node-pty 1.0 for terminal emulation
- Zustand 4.5 for state management
- electron-builder 26.7 + electron-updater for packaging and auto-updates

## Building & Releasing

**Build Commands:**
```bash
npm run dist           # Build installer without publishing
npm run release        # Build and publish to GitHub (requires GH_TOKEN)
npm run pack           # Build unpacked app for testing
```

**Release output:** `C:/temp/terminal-ide-release/`
- `Terminal IDE Setup X.X.X.exe` - Windows installer
- `latest.yml` - Version manifest for auto-updater
- `*.blockmap` - Delta update support

**Publishing with gh CLI** (alternative to `npm run release`):
```bash
npm run dist
gh release create vX.X.X --title "vX.X.X" \
  "C:/temp/terminal-ide-release/Terminal IDE Setup X.X.X.exe" \
  "C:/temp/terminal-ide-release/latest.yml" \
  "C:/temp/terminal-ide-release/Terminal IDE Setup X.X.X.exe.blockmap"
```

**Auto-Update Flow:**
- `AutoUpdater.ts` service checks GitHub releases on startup (production only)
- Renderer can access via `window.terminalIDE.updater` API
- Updates download manually, install on app quit

**GitHub Config:** Releases hosted at `JoshLeonard/agent-cli-ide`
