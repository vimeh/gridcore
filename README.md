# GridCore

A high-performance spreadsheet application built entirely in Rust, compiled to WebAssembly for browser execution.

## Features

### Core Capabilities
- **Formula Engine**: Full formula parser and evaluator with Excel-compatible functions
- **Dependency Tracking**: Automatic cell dependency graph and recalculation
- **Undo/Redo**: Command pattern-based undo/redo system
- **Fill Patterns**: Smart fill detection for dates, numbers, and text patterns

### UI Features
- **Canvas Rendering**: High-performance canvas-based grid rendering
- **Vim Mode**: Complete vim keybindings for navigation and editing
- **Cell Editing**: Inline editing with formula autocomplete
- **Multiple Sheets**: Tab-based sheet management
- **Resizable Columns/Rows**: Mouse-based column and row resizing
- **Selection Stats**: Real-time statistics for selected cells

## Architecture

GridCore follows a clean three-layer architecture with clear separation of concerns:

- **gridcore-core**: Pure spreadsheet engine with formula parsing, evaluation, and data management. No UI dependencies.
- **gridcore-controller**: State management, viewport coordination, resize management, and vim mode implementation. Bridges core and UI.
- **gridcore-ui**: Pure rendering layer built with Leptos framework. Delegates all business logic to controller.

## Project Structure

```
gridcore/
├── gridcore-rs/               # Rust workspace
│   ├── gridcore-core/         # Core spreadsheet engine
│   ├── gridcore-controller/   # State management & behaviors
│   └── gridcore-ui/           # Leptos web UI (WASM)
├── tests/                     # End-to-end Playwright tests
├── package.json               # Test runner configuration
└── playwright.config.ts       # Playwright configuration
```

## Prerequisites

- **Rust** (stable toolchain)
- **Trunk** for serving the web UI: `cargo install trunk`
- **Bun** for running E2E tests (optional)
- **wasm-opt** for WASM optimization (optional): `cargo install wasm-opt --locked`

## Development

### Running the Application

```bash
# Navigate to the UI directory
cd gridcore-rs/gridcore-ui

# Start development server with hot reload (http://localhost:8080)
trunk serve

# Or build for production
trunk build --release
```

### Building Components

```bash
# Build all Rust components
cd gridcore-rs
cargo build

# Run all Rust tests
cargo test

# Run benchmarks
cargo bench

# Check code without building
cargo check

# Format code
cargo fmt

# Run linter
cargo clippy
```

### Running E2E Tests

```bash
# Install test dependencies
bun install

# Run Playwright tests
bun test:e2e

# Run tests with UI
bun test:e2e:ui

# Debug tests
bun test:e2e:debug
```
