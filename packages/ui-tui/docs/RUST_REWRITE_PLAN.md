# Rust TUI Rewrite Plan

## Architecture Overview

### Technology Stack
- **Terminal Backend**: `crossterm` (cross-platform terminal manipulation)
- **TUI Framework**: `ratatui` (immediate-mode rendering with widgets)
- **Async Runtime**: `tokio` (for event handling and async operations)
- **Additional Libraries**:
  - `unicode-width` for text measurement
  - `tui-textarea` or custom implementation for text editing
  - `serde` + `serde_json` for state serialization
  - `anyhow` for error handling
  - `clap` for CLI arguments

## Project Structure

```
gridcore-tui-rust/
├── Cargo.toml
├── src/
│   ├── main.rs                 # Entry point and signal handling
│   ├── app.rs                  # Main TUI application controller
│   ├── framework/
│   │   ├── mod.rs
│   │   ├── terminal.rs         # Terminal abstraction over crossterm
│   │   ├── buffer.rs           # Optimized buffer implementation
│   │   └── event.rs            # Event handling system
│   ├── components/
│   │   ├── mod.rs
│   │   ├── grid.rs             # Spreadsheet grid widget
│   │   ├── formula_bar.rs      # Formula input widget
│   │   ├── status_bar.rs       # Status display widget
│   │   └── base.rs             # Component trait definition
│   ├── vim/
│   │   ├── mod.rs
│   │   ├── mode.rs             # Vim mode state machine
│   │   ├── motion.rs           # Movement commands
│   │   ├── operator.rs         # Operators (d, c, y, etc.)
│   │   └── text_object.rs      # Text object handling
│   ├── viewport/
│   │   ├── mod.rs
│   │   └── manager.rs          # Viewport and scrolling logic
│   ├── state/
│   │   ├── mod.rs
│   │   ├── adapter.rs          # Core state transformation
│   │   └── types.rs            # State type definitions
│   └── core/
│       ├── mod.rs
│       └── bindings.rs         # FFI bindings to @gridcore/core
└── tests/
    ├── integration/
    └── unit/
```

## Implementation Phases

### Phase 1: Core Framework (Week 1)
1. **Terminal Abstraction**
   - Implement `Terminal` wrapper around crossterm
   - Raw mode management
   - Key event parsing with full modifier support
   - ANSI escape sequence handling

2. **Optimized Buffer**
   - Port `OptimizedBuffer` with dirty region tracking
   - RGB color support
   - Drawing primitives (lines, boxes, text)
   - Efficient diff-based rendering

3. **Event System**
   - Async event loop with tokio
   - Keyboard input handling
   - Terminal resize events
   - Signal handling (SIGINT, SIGTERM)

### Phase 2: Component System (Week 2)
1. **Component Trait**
   ```rust
   trait Component {
       fn render(&self, area: Rect, buf: &mut Buffer);
       fn handle_event(&mut self, event: Event) -> Option<Action>;
   }
   ```

2. **Grid Component**
   - Cell rendering with scrolling
   - Column/row headers
   - Selection highlighting
   - Mode-specific overlays

3. **Formula Bar**
   - Text input with cursor
   - Syntax highlighting
   - Horizontal scrolling

4. **Status Bar**
   - Mode indicators
   - Cell position display
   - Keyboard shortcuts

### Phase 3: Vim Implementation (Week 3)
1. **Mode State Machine**
   - Normal, Insert, Visual, Command modes
   - Mode transitions
   - Count/register prefixes

2. **Motion System**
   - Basic movements (hjkl, w, b, e)
   - Line movements (0, $, ^)
   - Word/paragraph navigation

3. **Operators and Text Objects**
   - Delete, change, yank operations
   - Inner/around text objects
   - Dot repeat functionality

### Phase 4: Core Integration (Week 4)
1. **FFI Bindings**
   - Create Rust bindings to @gridcore/core JavaScript
   - Option 1: Use Node.js embedding with neon/node-bindgen
   - Option 2: Port core logic to Rust (larger effort)
   - Option 3: Use WebAssembly bridge

2. **State Management**
   - Port `StateAdapter` logic
   - Reactive state updates
   - Undo/redo integration

3. **Formula Processing**
   - Formula parsing and highlighting
   - Autocomplete suggestions
   - Error display

### Phase 5: Testing & Polish (Week 5)
1. **Testing Infrastructure**
   - Unit tests for all components
   - Integration tests for workflows
   - Mock terminal for testing

2. **Performance Optimization**
   - Profile and optimize rendering
   - Minimize allocations
   - Optimize viewport calculations

3. **Documentation**
   - API documentation
   - User guide
   - Development guide

## Key Design Decisions

### 1. Immediate vs Retained Mode
Use Ratatui's immediate mode rendering for simplicity and performance, matching the current TypeScript implementation's approach.

### 2. Async Architecture
Leverage Rust's async/await with tokio for:
- Non-blocking keyboard input
- Concurrent state updates
- Future network operations

### 3. Core Integration Strategy
Start with FFI bindings to existing JavaScript core, then gradually port to Rust:
- Phase 1: Use Node.js embedding
- Phase 2: Port formula parser
- Phase 3: Port cell engine
- Phase 4: Full Rust implementation

### 4. Memory Management
- Use `Arc<RwLock<T>>` for shared state
- Minimize cloning with borrowing
- Pool allocations for buffers

## Migration Path

1. **Parallel Development**: Build Rust TUI alongside TypeScript version
2. **Feature Parity**: Match all existing functionality
3. **Performance Testing**: Benchmark against TypeScript version
4. **Gradual Rollout**: Beta test with subset of users
5. **Full Migration**: Replace TypeScript version

## Benefits of Rust Rewrite

1. **Performance**
   - 10-50x faster rendering
   - Lower memory usage
   - Zero-cost abstractions

2. **Reliability**
   - Memory safety guarantees
   - No null pointer exceptions
   - Compile-time error checking

3. **Distribution**
   - Single binary deployment
   - No runtime dependencies
   - Smaller distribution size

4. **Cross-platform**
   - Native performance on all platforms
   - Better Windows terminal support
   - Consistent behavior

## Challenges & Solutions

1. **JavaScript Core Integration**
   - Challenge: Interfacing with existing TypeScript core
   - Solution: Use node-bindgen or gradual port to Rust

2. **Complex Vim Behavior**
   - Challenge: Replicating all vim modes and commands
   - Solution: Incremental implementation with comprehensive testing

3. **Async Complexity**
   - Challenge: Managing async state updates
   - Solution: Use actor pattern with message passing

4. **Testing Terminal UI**
   - Challenge: Testing interactive terminal behavior
   - Solution: Mock terminal backend for deterministic testing

## Estimated Timeline

- **Week 1**: Core framework
- **Week 2**: Component system
- **Week 3**: Vim implementation
- **Week 4**: Core integration
- **Week 5**: Testing & polish
- **Total**: 5 weeks for MVP, 8-10 weeks for feature parity

## Current TypeScript Implementation Analysis

### Core Components
The existing TypeScript TUI consists of:

1. **Framework Layer** (`src/framework/`)
   - `Terminal.ts`: Raw mode, ANSI escapes, key parsing
   - `OptimizedBuffer.ts`: Double buffering with dirty regions
   - `Renderable.ts`: Component hierarchy and positioning

2. **Components** (`src/components/`)
   - `Grid.ts`: ~1000 lines - Main spreadsheet rendering
   - `FormulaBar.ts`: ~300 lines - Formula editing with highlighting
   - `StatusBar.ts`: ~200 lines - Mode and position display

3. **State Management** (`src/adapters/`)
   - `StateAdapter.ts`: Transforms core state to display format
   - Reactive updates via getter functions

4. **Viewport** (`src/viewport/`)
   - `TUIViewportManager.ts`: Scrolling and visible area calculations
   - Column width and row height management

### Key Features to Port

1. **Vim Modes**
   - Normal mode navigation (hjkl, gg, G, etc.)
   - Insert mode editing
   - Visual mode selection
   - Command mode (:w, :q, etc.)
   - Resize mode for columns/rows

2. **Cell Operations**
   - Formula editing with syntax highlighting
   - Multi-cell selection
   - Copy/paste operations
   - Undo/redo support

3. **Display Features**
   - Column/row headers with labels
   - Cell borders and grid lines
   - Mode-specific UI overlays
   - Resize preview with delta display

4. **Performance Optimizations**
   - Dirty region tracking
   - Viewport culling
   - Efficient diff rendering
   - Minimal terminal I/O

## Implementation Notes

### Rust-Specific Considerations

1. **Error Handling**
   ```rust
   use anyhow::{Result, Context};
   
   fn render_cell(&self, cell: &Cell) -> Result<String> {
       // Use ? operator for error propagation
       let value = self.format_value(cell)
           .context("Failed to format cell value")?;
       Ok(value)
   }
   ```

2. **State Management Pattern**
   ```rust
   struct AppState {
       grid: Arc<RwLock<GridState>>,
       vim: Arc<RwLock<VimState>>,
       viewport: Arc<RwLock<ViewportState>>,
   }
   ```

3. **Event Loop Structure**
   ```rust
   async fn run_event_loop(mut app: App) -> Result<()> {
       loop {
           terminal.draw(|f| app.render(f))?;
           
           if let Event::Key(key) = event::read()? {
               if !app.handle_key(key)? {
                   break;
               }
           }
       }
       Ok(())
   }
   ```

### Testing Strategy

1. **Unit Tests**
   - Test each component in isolation
   - Mock dependencies using traits
   - Property-based testing for vim motions

2. **Integration Tests**
   - End-to-end workflows
   - Snapshot testing for rendering
   - Regression tests for vim behaviors

3. **Performance Benchmarks**
   - Rendering throughput
   - Memory usage
   - Startup time
   - Large spreadsheet handling

## Next Steps

1. **Prototype Development**
   - Create minimal Rust TUI with ratatui
   - Implement basic grid rendering
   - Add simple keyboard navigation

2. **Core Integration Research**
   - Evaluate FFI options (neon, wasm-bindgen)
   - Prototype JavaScript interop
   - Benchmark performance overhead

3. **Team Discussion**
   - Review architecture proposal
   - Decide on migration timeline
   - Allocate development resources

4. **Development Setup**
   - Initialize Rust project structure
   - Configure CI/CD pipeline
   - Set up testing framework