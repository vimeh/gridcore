# GridCore Leptos UI

A Rust-based spreadsheet UI built with Leptos framework, migrating from the TypeScript implementation.

## Current Status

✅ **Phase 1: Basic Setup Complete**
- Trunk build configuration
- Leptos project structure  
- Basic app shell with placeholder UI
- CSS styling framework
- Successful WASM compilation

✅ **Phase 2: Working Canvas Grid**
- Functional canvas rendering with grid lines
- Row and column headers (A, B, C... and 1, 2, 3...)
- Active cell highlighting
- Mouse click cell selection
- Keyboard navigation (arrow keys and vim hjkl)
- Responsive canvas with proper sizing

## Architecture

The Leptos UI provides direct integration with Rust controllers, eliminating WASM wrapper overhead:

```
gridcore-ui/
├── src/
│   ├── main.rs           # Entry point
│   ├── app.rs            # Main App component (placeholder)
│   ├── components/       # UI components (to be implemented)
│   ├── rendering/        # Canvas rendering (to be implemented)
│   ├── interaction/      # Event handlers (to be implemented)
│   └── utils/            # DOM utilities (to be implemented)
├── style/
│   └── main.css          # Styles
├── index.html            # HTML template
└── Trunk.toml            # Build configuration
```

## Development

### Prerequisites
- Rust (stable)
- Trunk: `cargo install trunk`

### Build and Run
```bash
# Development server with hot reload
trunk serve

# Production build
trunk build --release
```

## Implementation Roadmap

### ✅ Completed
- Project setup and configuration
- Basic Leptos app structure
- Trunk build system
- CSS framework
- Canvas grid rendering with headers
- Viewport management
- Mouse click selection
- Keyboard navigation (arrows + vim)

✅ **Phase 3: Controller Integration Complete**
- Real SpreadsheetController connected
- SpreadsheetFacade integrated for data management
- Cell values rendered from facade
- SelectionManager integrated
- Formula bar connected for cell editing
- UI modes displayed in status bar
- Keyboard events handled through controller

### 🚧 Next Steps

#### Phase 4: Cell Editing Enhancement
- [ ] Implement inline cell editor overlay
- [ ] Add formula autocomplete
- [ ] Enhanced vim mode support

#### Phase 5: Advanced Features
- [ ] Column/row resizing
- [ ] Sheet tabs
- [ ] Status bar with modes

## Key Benefits Over TypeScript Version

1. **No WASM Boundary** - Direct access to Rust controllers
2. **Type Safety** - Compile-time guarantees across entire stack
3. **Performance** - Native Rust performance for calculations
4. **Smaller Bundle** - Single WASM module instead of multiple

## Technical Notes

### Canvas Rendering
Uses web-sys for direct canvas API access, maintaining pixel-perfect rendering from the TypeScript version.

### State Management
Leptos signals provide reactive state management, directly integrated with the SpreadsheetController.

### Event Handling
Native Rust event handlers with direct controller integration, no serialization needed.

## Migration from TypeScript

The migration preserves the architecture while leveraging Rust's strengths:

| TypeScript Component | Rust/Leptos Component | Status |
|---------------------|----------------------|---------|
| CanvasGrid.ts | canvas_grid.rs | Scaffold created |
| Viewport.ts | viewport.rs | Basic implementation |
| CellEditor.ts | cell_editor.rs | Scaffold created |
| SelectionManager.ts | Uses Rust SelectionManager | Direct integration |
| WebStateAdapter.ts | Direct UIStateMachine | No adapter needed |

## Testing

```bash
# Run tests
cargo test

# Run with browser testing
wasm-pack test --headless --firefox
```

## Contributing

The UI is being migrated incrementally. Focus areas:
1. Canvas rendering with web-sys
2. Event handling integration
3. Direct controller usage
4. Vim mode support