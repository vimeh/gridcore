# GridCore

A multi-platform spreadsheet application with a headless core engine and multiple UI frontends.

## Architecture

GridCore follows the "Hydra Architecture" - one powerful core engine with multiple frontend interfaces:

- **Core Engine**: Pure TypeScript library handling all spreadsheet logic
- **Terminal UI**: Command-line interface for terminal usage
- **Web UI**: Browser-based interface built with Vite
- **Desktop UI**: Native desktop app (planned with Tauri)

## Project Structure

```
gridcore/
├── packages/
│   ├── core/          # Headless spreadsheet engine
│   ├── ui-tui/        # Terminal UI
│   ├── ui-web/        # Web UI (Vite)
│   └── ui-desktop/    # Desktop UI wrapper
├── package.json       # Root workspace config
└── tsconfig.json      # Shared TypeScript config
```

## Development

This project uses Bun workspaces for monorepo management.

### Install dependencies
```bash
bun install
```

### Run all packages in development
```bash
bun dev
```

### Build all packages
```bash
bun build
```

### Type checking
```bash
bun typecheck
```

## Package-specific commands

### Core Engine
```bash
cd packages/core
bun dev    # Build and watch
bun build  # Build for production
```

### Web UI
```bash
cd packages/ui-web
bun dev    # Start Vite dev server on http://localhost:3000
bun build  # Build for production
```

### Terminal UI
```bash
cd packages/ui-tui
bun dev    # Run the TUI
```

## Roadmap

- [x] Milestone 0: Foundation & Setup
- [ ] Milestone 1: Core Engine (Grid, Formula Parser, Calculation Engine)
- [ ] Milestone 2: Terminal UI
- [ ] Milestone 3: Web UI with Canvas rendering
- [ ] Milestone 4: Desktop UI with Tauri
- [ ] Milestone 5: Advanced Features
- [ ] Milestone 6: AI Layer