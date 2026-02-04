# Terminal IDE

A terminal-first IDE orchestrator for managing multiple AI agents and shells in parallel. Built with Electron, React, and TypeScript.

## Features

- **Multi-Agent Support** - Run Claude Code, Cursor, Aider, and other AI coding assistants side-by-side
- **Git Worktree Isolation** - Spin up isolated terminal sessions in separate Git worktrees for parallel development
- **Customizable Grid Layout** - Arrange terminal panels in a flexible grid configuration
- **Session Management** - Track and manage multiple terminal sessions with activity feeds
- **Inter-Session Messaging** - Send messages between terminal sessions
- **Auto-Updates** - Automatic updates via GitHub releases

## Installation

Download the latest release from the [Releases](https://github.com/JoshLeonard/agent-cli-ide/releases) page.

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build and run the app
npm start
```

### Build Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build:all    # Build all three processes (main, preload, renderer)
npm start            # Build everything and launch Electron
npm run pack         # Build unpacked app for testing
npm run dist         # Build installer
npm run release      # Build and publish to GitHub (requires GH_TOKEN)
```

## Architecture

Three-process Electron architecture:

```
src/
├── main/           # Main process (Electron)
│   ├── index.ts    # App entry, window creation
│   ├── ipc/        # IPC message handlers
│   ├── session/    # Terminal session wrapper
│   └── services/   # Core services (SessionRegistry, GitWorktreeManager, etc.)
├── preload/        # Preload scripts (context isolation)
├── renderer/       # React UI
│   ├── App.tsx     # Root component
│   ├── components/ # UI components (layout, sidebar, terminal, messaging)
│   └── stores/     # Zustand state management
└── shared/         # Shared types and IPC definitions
```

### Session Types

- **Attached** - Terminal running in the project directory
- **Isolated** - Terminal running in a Git worktree (separate branch copy)

## Tech Stack

- Electron 28
- React 18
- TypeScript 5.3
- Vite 5.0
- xterm.js 5.5 + node-pty 1.0
- Zustand 4.5
- electron-builder + electron-updater

## License

MIT
