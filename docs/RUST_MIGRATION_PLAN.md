# Incremental Rust Migration Plan for GridCore

## Overview
This document outlines a phased approach to migrate GridCore from TypeScript to Rust, maintaining full functionality at each phase. The migration starts with the core engine, then controller logic, and finally UI layers.

## Current Architecture
- **@gridcore/core**: Core spreadsheet engine (formulas, cells, workbook)
- **@gridcore/ui-core**: Shared UI logic (controllers, state machines, vim mode)
- **@gridcore/ui-web**: Canvas-based web UI
- **@gridcore/ui-desktop**: Tauri wrapper for desktop
- **@gridcore/ui-tui**: Terminal UI implementation

## Phase 1: Core Engine with WASM Bindings (6-8 weeks)

### Goals
- Replace `@gridcore/core` with Rust implementation
- Maintain 100% API compatibility via WASM
- Zero breaking changes for existing TypeScript UI

### Structure
```
packages/gridcore-core-rust/
├── Cargo.toml
├── src/
│   ├── lib.rs                 # WASM entry points
│   ├── cell/
│   │   ├── mod.rs
│   │   ├── address.rs         # CellAddress implementation
│   │   ├── value.rs           # CellValue enum (Number, String, Formula, etc.)
│   │   └── storage.rs         # Sparse matrix storage
│   ├── formula/
│   │   ├── mod.rs
│   │   ├── parser.rs          # Formula parser (nom-based)
│   │   ├── evaluator.rs       # Expression evaluator
│   │   ├── functions.rs       # Built-in functions (SUM, AVERAGE, etc.)
│   │   └── dependencies.rs    # Dependency graph
│   ├── workbook/
│   │   ├── mod.rs
│   │   ├── sheet.rs           # Sheet management
│   │   ├── facade.rs          # SpreadsheetFacade API
│   │   └── events.rs          # Event system
│   └── wasm/
│       ├── mod.rs
│       ├── bindings.rs        # wasm-bindgen exports
│       └── bridge.rs          # TypeScript type conversions
├── pkg/                        # Generated WASM package
└── tests/
```

### Implementation Steps

#### 1. Core data structures (Week 1-2)
```rust
// Exact API match with TypeScript
#[wasm_bindgen]
pub struct CellAddress {
    row: u32,
    col: u32,
}

#[wasm_bindgen]
impl CellAddress {
    #[wasm_bindgen(js_name = "create")]
    pub fn create(row: u32, col: u32) -> Result<CellAddress, JsValue> {
        // Match TypeScript Result pattern
    }
    
    #[wasm_bindgen(js_name = "fromString")]
    pub fn from_string(addr: &str) -> Result<CellAddress, JsValue> {
        // Parse "A1" notation
    }
}
```

#### 2. Formula engine (Week 3-4)
```rust
pub struct FormulaEngine {
    parser: FormulaParser,
    evaluator: FormulaEvaluator,
    dependency_graph: DependencyGraph,
}
```

#### 3. WASM bindings (Week 5-6)
```rust
#[wasm_bindgen]
pub struct SpreadsheetFacade {
    sheet: Rc<RefCell<Sheet>>,
}

#[wasm_bindgen]
impl SpreadsheetFacade {
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(&mut self, address: &CellAddress, value: JsValue) {
        // Convert JsValue to CellValue
    }
}
```

#### 4. Testing & Integration (Week 7-8)
- Port existing TypeScript tests
- Benchmark against current implementation
- Drop-in replacement testing

### Integration Strategy
```typescript
// packages/core/src/index.ts
let coreImplementation;

if (process.env.USE_RUST_CORE === 'true') {
  // Use Rust WASM implementation
  const wasmCore = await import('@gridcore/core-rust');
  await wasmCore.init();
  coreImplementation = wasmCore;
} else {
  // Use existing TypeScript
  coreImplementation = await import('./typescript-impl');
}

export const { Workbook, Cell, CellAddress } = coreImplementation;
```

### Success Criteria
- [ ] All core TypeScript tests pass with Rust implementation
- [ ] No performance regression
- [ ] Zero breaking changes in API
- [ ] WASM bundle < 500KB

## Phase 2: Controller/UI Logic (4-6 weeks)

### Goals
- Port `@gridcore/ui-core` to Rust
- Maintain state machine compatibility
- Support both TypeScript and Rust UI consumers

### Structure
```
packages/gridcore-controller-rust/
├── src/
│   ├── lib.rs
│   ├── state/
│   │   ├── mod.rs
│   │   ├── machine.rs         # UIStateMachine
│   │   ├── spreadsheet.rs     # SpreadsheetState
│   │   └── transitions.rs     # State transitions
│   ├── controller/
│   │   ├── mod.rs
│   │   ├── spreadsheet.rs     # SpreadsheetController
│   │   └── events.rs          # Event handling
│   ├── behaviors/
│   │   ├── mod.rs
│   │   ├── vim.rs             # Vim mode implementation
│   │   ├── selection.rs       # Selection management
│   │   └── resize.rs          # Column/row resizing
│   └── wasm/
│       └── bindings.rs        # WASM exports for TypeScript
```

### Implementation Steps

#### 1. State machine core (Week 1-2)
```rust
pub enum SpreadsheetMode {
    Normal,
    Editing,
    Visual,
    Command,
}

pub struct UIStateMachine {
    current_state: SpreadsheetMode,
    context: StateContext,
}
```

#### 2. Controller logic (Week 3-4)
```rust
#[wasm_bindgen]
pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
    viewport_manager: Box<dyn ViewportManager>,
}
```

#### 3. Vim mode (Week 5-6)
- Port complex vim behavior state machine
- Maintain exact command compatibility

### Integration Strategy
```typescript
// Gradual migration - both implementations side by side
import { SpreadsheetController as TSController } from './typescript';
import { SpreadsheetController as RustController } from '@gridcore/controller-rust';

const Controller = USE_RUST_CONTROLLER ? RustController : TSController;
```

### Success Criteria
- [ ] State machine behavior identical
- [ ] Vim mode fully functional
- [ ] Event handling maintains 60fps

## Phase 3: Web UI Migration (6-8 weeks)

### Goals
- Replace canvas rendering with Rust
- Start with web-sys (Canvas2D), optionally upgrade to wgpu later
- Maintain Tauri desktop compatibility

### Structure
```
packages/gridcore-web-rust/
├── src/
│   ├── lib.rs
│   ├── rendering/
│   │   ├── mod.rs
│   │   ├── canvas.rs          # Canvas2D operations
│   │   ├── grid.rs            # Grid rendering
│   │   ├── headers.rs         # Row/column headers
│   │   └── selection.rs       # Selection overlay
│   ├── components/
│   │   ├── mod.rs
│   │   ├── viewport.rs        # Virtual scrolling
│   │   ├── formula_bar.rs     # Formula bar (DOM-based initially)
│   │   └── status_bar.rs      # Status bar
│   ├── interaction/
│   │   ├── mod.rs
│   │   ├── mouse.rs           # Mouse event handling
│   │   └── keyboard.rs        # Keyboard events
│   └── app.rs                 # Main application entry
```

### Implementation Approach

#### 1. Canvas rendering (Week 1-3)
```rust
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

pub struct CanvasRenderer {
    canvas: HtmlCanvasElement,
    ctx: CanvasRenderingContext2d,
    viewport: Viewport,
}

impl CanvasRenderer {
    pub fn render_grid(&self, cells: &CellData) {
        // Direct port of TypeScript rendering logic
    }
}
```

#### 2. Event handling (Week 4-5)
```rust
pub struct MouseHandler {
    canvas: HtmlCanvasElement,
    on_cell_click: Closure<dyn FnMut(MouseEvent)>,
}
```

#### 3. Component integration (Week 6-8)
- Keep FormulaBar and StatusBar in TypeScript initially
- Rust grid communicates via events/callbacks

### Progressive Enhancement Path
```
Stage 1: web-sys with Canvas2D (matches current performance)
     ↓
Stage 2: Optimize hot paths (virtual scrolling, selection)
     ↓
Stage 3: Evaluate wgpu upgrade (if needed for performance)
```

### Success Criteria
- [ ] Canvas rendering matches TypeScript pixel-perfect
- [ ] Scrolling performance maintained or improved
- [ ] Tauri desktop app continues working

## Phase 4: TUI Implementation (3-4 weeks)

### Goals
- Pure Rust terminal UI
- Share controller logic with web UI
- Better performance than current TypeScript TUI

### Structure
```
packages/gridcore-tui-rust/
├── src/
│   ├── main.rs
│   ├── app.rs                 # Application state
│   ├── ui/
│   │   ├── mod.rs
│   │   ├── grid.rs            # Grid widget
│   │   ├── formula_bar.rs     # Formula bar widget
│   │   └── status_bar.rs      # Status bar widget
│   └── event.rs               # Terminal event handling
```

### Implementation
```rust
use ratatui::{Frame, Terminal};
use gridcore_controller_rust::SpreadsheetController;

pub struct SpreadsheetTUI {
    controller: SpreadsheetController,
    terminal: Terminal<CrosstermBackend<Stdout>>,
}

impl SpreadsheetTUI {
    pub fn draw(&mut self, frame: &mut Frame) {
        // Render grid using ratatui widgets
        let grid = Grid::new(&self.controller);
        frame.render_widget(grid, chunks[0]);
    }
}
```

### Success Criteria
- [ ] TUI renders at 60fps in terminal
- [ ] Memory usage < 50MB for large spreadsheets
- [ ] Keyboard responsiveness < 16ms

## Migration Timeline

```
Months:  1   2   3   4   5   6
        ├───┼───┼───┼───┼───┼───┤
Core:   ████████
Controller:     ██████
Web UI:             ████████
TUI:                      ████
Testing: ███ ███ ███ ███ ███ ███
```

## Technology Stack

### Core Technologies
- **Formula Parsing**: nom or pest
- **WASM Bindings**: wasm-bindgen
- **Serialization**: serde with bincode
- **Testing**: wasm-bindgen-test

### Rendering Options
- **Phase 3 Initial**: web-sys (Canvas2D API)
- **Phase 3 Future**: wgpu (if performance requires)
- **Phase 4**: ratatui (terminal UI)

### Development Tools
- **Build**: wasm-pack for WASM modules
- **Dev Server**: trunk for web development
- **Testing**: cargo test + wasm-bindgen-test
- **Benchmarking**: criterion.rs

## Risk Mitigation

### 1. Feature Flags for Gradual Rollout
```typescript
const FEATURE_FLAGS = {
  USE_RUST_CORE: process.env.RUST_CORE === 'true',
  USE_RUST_CONTROLLER: process.env.RUST_CONTROLLER === 'true',
  USE_RUST_RENDERER: process.env.RUST_RENDERER === 'true',
};
```

### 2. Parallel Development Tracks
- Maintain TypeScript version during migration
- A/B test Rust components with subset of users
- Feature flag controlled rollout

### 3. Comprehensive Testing Strategy
- Port all existing tests to Rust
- Add integration tests between TS and Rust components
- Performance benchmarks at each phase
- Automated regression testing

## Expected Benefits

### Performance Improvements
- **Core Engine**: 10-100x faster formula evaluation
- **Memory Usage**: 50% reduction in memory footprint
- **Rendering**: Native 60fps with millions of cells
- **Startup Time**: < 100ms application startup

### Development Benefits
- **Type Safety**: Eliminate runtime type errors
- **Memory Safety**: No memory leaks or segfaults
- **Single Codebase**: Share logic between web/desktop/terminal
- **Predictable Performance**: No GC pauses

### User Benefits
- **Responsiveness**: Instant feedback on all operations
- **Large Files**: Handle million-cell spreadsheets smoothly
- **Battery Life**: Reduced CPU usage on laptops
- **Native Feel**: Platform-specific optimizations

## Success Metrics

### Overall Project Success
- [ ] 60fps scrolling with 1M cells
- [ ] < 100ms formula recalculation for 10k dependencies
- [ ] < 50MB memory for 100k cell spreadsheet
- [ ] Native performance on all platforms
- [ ] Single codebase maintenance

### Migration Success
- [ ] Zero breaking changes for users
- [ ] Gradual rollout without disruption
- [ ] Performance improvements at each phase
- [ ] Maintainable and well-documented code

## Next Steps

1. **Set up Rust workspace** with cargo workspaces
2. **Create gridcore-core-rust** package
3. **Implement CellAddress** as proof of concept
4. **Set up WASM build pipeline**
5. **Create integration tests** with TypeScript
6. **Begin incremental migration** with feature flags

## Conclusion

This incremental approach allows us to:
- **Validate performance gains early** with the core engine
- **Maintain a working product** throughout migration
- **Learn and adjust** strategy based on each phase
- **Minimize risk** by keeping TypeScript fallbacks
- **Measure success** with clear metrics at each stage

The key insight is that the current architecture already separates concerns well (core, controller, rendering), making this incremental approach very feasible and low-risk.