# GridCore

A high-performance spreadsheet application built entirely in Rust, compiled to WebAssembly for browser execution.

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

## Architecture Benefits

The clean three-layer architecture provides:

- **Separation of Concerns**: Business logic in controller, rendering in UI
- **Reusability**: Controller can support multiple UI implementations
- **Testability**: Business logic tested without UI dependencies
- **Maintainability**: Each layer has clear, focused responsibilities
- **Performance**: Optimized data flow with minimal cross-boundary calls

## Technology Stack

- **Rust**: Core language for all components
- **Leptos**: Reactive web framework for the UI
- **WebAssembly**: Compilation target for browser execution
- **Web-sys**: Direct DOM and Canvas API access
- **Trunk**: Build tool and development server
- **Playwright**: End-to-end testing framework

## Performance

The Rust implementation provides significant performance benefits:
- Zero-cost abstractions and compile-time optimizations
- Direct WASM compilation without JavaScript overhead
- Efficient memory management without garbage collection
- Optimized WASM bundle with brotli compression support

## Current Status

✅ **Completed**
- Full Rust migration from TypeScript
- Core spreadsheet engine with formula support
- Leptos UI with canvas rendering
- Vim mode implementation
- Cell editing with autocomplete
- Column/row resizing
- Multiple sheet support
- E2E test suite
- **Architecture refactoring**: Clean separation between UI rendering and business logic
- **ViewportManager**: Centralized viewport state management in controller
- **ResizeManager**: Dedicated resize operations management in controller

🚧 **In Progress**
- Performance optimizations
- Additional formula functions
- Extended vim mode features
- Fixing reference toggle tests

## Contributing

GridCore is built with Rust and modern web technologies. Key areas for contribution:

1. **Formula Functions**: Implement additional Excel-compatible functions
2. **Performance**: Optimize calculation engine and rendering
3. **Features**: Add charting, data validation, or import/export capabilities
4. **Testing**: Expand test coverage for edge cases

See individual README files in each crate for specific development instructions.

## License

[License information to be added]