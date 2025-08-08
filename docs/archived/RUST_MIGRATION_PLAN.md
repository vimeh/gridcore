# Incremental Rust Migration Plan for GridCore

## Overview

This document outlines a phased approach to migrate GridCore from TypeScript to Rust, maintaining full functionality at each phase. The migration starts with the core engine, then controller logic, and finally UI layers.

## Current Status (August 2025)

### ✅ Completed
- **Rust Core Engine**: Fully implemented at `gridcore-rs/gridcore-core/` with 243 tests passing
  - Phase 1: Fill engine with pattern detection and formula adjustment
  - Phase 2: References system with A1 notation and range operations
  - Phase 3: Workbook/Sheet abstractions with multi-sheet support
  - Formula parser and evaluator using chumsky
  - Dependency graph and topological calculation order
  - Command pattern for undo/redo operations
  - Comprehensive event system

### 🚧 In Progress
- **WASM Bindings**: Setup complete at `gridcore-rs/gridcore-wasm/`, needs build
- **TypeScript Adapter**: Started at `packages/core/src/rust-adapter/facade.ts`

### 📋 Next Steps
- Build and integrate WASM module
- Complete adapter implementation
- Switch core implementation with feature flags

## Current Architecture

- **@gridcore/core**: Core spreadsheet engine (formulas, cells, workbook) - *Ready to be replaced*
- **@gridcore/ui-core**: Shared UI logic (controllers, state machines, vim mode)
- **@gridcore/ui-web**: Canvas-based web UI
- **@gridcore/ui-desktop**: Tauri wrapper for desktop
- **@gridcore/ui-tui**: Terminal UI implementation

## Phase 1: Core Engine with WASM Bindings ✅ MOSTLY COMPLETE

### Goals

- ✅ Replace `@gridcore/core` with Rust implementation
- 🚧 Maintain 100% API compatibility via WASM
- 🚧 Zero breaking changes for existing TypeScript UI

### Actual Structure (Implemented)

```
gridcore-rs/
├── Cargo.toml                 # Workspace configuration
├── gridcore-core/             # ✅ Core engine (243 tests passing)
│   ├── src/
│   │   ├── lib.rs            
│   │   ├── command/          # ✅ Command pattern for undo/redo
│   │   ├── dependency/       # ✅ Dependency graph implementation
│   │   ├── domain/           # ✅ Cell domain model
│   │   ├── error/            # ✅ Error types
│   │   ├── evaluator/        # ✅ Formula evaluation engine
│   │   ├── facade/           # ✅ SpreadsheetFacade API
│   │   ├── fill/             # ✅ Fill engine (Phase 1)
│   │   ├── formula/          # ✅ Parser using chumsky
│   │   ├── references/       # ✅ Reference system (Phase 2)
│   │   ├── repository/       # ✅ Cell storage
│   │   ├── types/            # ✅ Core types (CellAddress, CellValue)
│   │   └── workbook/         # ✅ Workbook/Sheet (Phase 3)
│   └── tests/
├── gridcore-wasm/             # 🚧 WASM bindings (setup complete)
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs           # Needs implementation
│   └── package.json         # NPM package config
└── gridcore-controller/       # Future controller implementation
```

### Immediate Next Steps (WASM Integration)

#### 1. Build WASM Module

```bash
# Build the WASM module
cd gridcore-rs/gridcore-wasm
wasm-pack build --target web --out-dir pkg

# For Node.js environments
wasm-pack build --target nodejs --out-dir pkg-node

# Verify the build
ls -la pkg/
# Should contain:
# - gridcore_wasm_bg.wasm
# - gridcore_wasm.js
# - gridcore_wasm.d.ts
# - package.json
```

#### 2. Complete WASM Bindings

The `gridcore-rs/gridcore-wasm/src/lib.rs` needs to expose the facade:

```rust
use wasm_bindgen::prelude::*;
use gridcore_core::facade::SpreadsheetFacade as CoreFacade;
use gridcore_core::types::{CellAddress, CellValue};

#[wasm_bindgen]
pub struct WasmSpreadsheetFacade {
    inner: CoreFacade,
}

#[wasm_bindgen]
impl WasmSpreadsheetFacade {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Self {
            inner: CoreFacade::new(),
        }
    }

    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(&mut self, col: u32, row: u32, value: String) -> Result<(), JsValue> {
        let address = CellAddress::new(col, row);
        self.inner.set_cell_value(address, value)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    // ... other methods
}
```

#### 3. Complete TypeScript Adapter

Update `packages/core/src/rust-adapter/facade.ts`:

```typescript
import init, { WasmSpreadsheetFacade } from '../../../gridcore-rs/gridcore-wasm/pkg';

export class RustSpreadsheetFacade implements ISpreadsheetFacade {
    private wasmFacade?: WasmSpreadsheetFacade;
    private initPromise: Promise<void>;

    constructor() {
        this.initPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        await init();
        this.wasmFacade = new WasmSpreadsheetFacade();
    }

    async setCellValue(address: CellAddress, value: CellValue): Promise<Result<Cell>> {
        await this.initPromise;
        try {
            this.wasmFacade!.setCellValue(address.col, address.row, String(value));
            return ok(/* converted cell */);
        } catch (e) {
            return err(e as Error);
        }
    }
}
```

#### 4. Update Build Pipeline

Add to root `package.json`:

```json
{
  "scripts": {
    "build:wasm": "cd gridcore-rs/gridcore-wasm && wasm-pack build --target web --out-dir pkg",
    "prebuild": "bun run build:wasm",
    "postinstall": "bun run build:wasm"
  }
}
```

### Integration Strategy with Feature Flags

```typescript
// packages/core/src/index.ts
import type { ISpreadsheetFacade } from './application/SpreadsheetFacade';

let facadeFactory: () => Promise<ISpreadsheetFacade>;

if (process.env.USE_RUST_CORE === 'true' || process.env.NODE_ENV === 'production') {
  // Use Rust WASM implementation
  facadeFactory = async () => {
    const { RustSpreadsheetFacade } = await import('./rust-adapter/facade');
    const facade = new RustSpreadsheetFacade();
    await facade.ensureInitialized();
    return facade;
  };
} else {
  // Use existing TypeScript
  facadeFactory = async () => {
    const { SpreadsheetFacade } = await import('./application/SpreadsheetFacade');
    return new SpreadsheetFacade();
  };
}

export const createSpreadsheetFacade = facadeFactory;

// Re-export types (unchanged)
export * from './domain/models/CellAddress';
export * from './domain/models/CellValue';
// ... other exports
```

### Testing Strategy

```typescript
// packages/core/src/rust-adapter/facade.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { RustSpreadsheetFacade } from './facade';
import { SpreadsheetFacade } from '../application/SpreadsheetFacade';

describe('Rust vs TypeScript Parity', () => {
  let rustFacade: RustSpreadsheetFacade;
  let tsFacade: SpreadsheetFacade;

  beforeAll(async () => {
    rustFacade = new RustSpreadsheetFacade();
    await rustFacade.ensureInitialized();
    tsFacade = new SpreadsheetFacade();
  });

  test('identical results for formula evaluation', async () => {
    // Test that both implementations produce same results
  });

  test('performance comparison', async () => {
    // Benchmark Rust vs TypeScript
  });
});
```

### Success Criteria

- [x] Rust core implementation complete (243 tests passing)
- [ ] WASM module builds successfully
- [ ] TypeScript adapter complete
- [ ] All core TypeScript tests pass with Rust implementation
- [ ] Performance improvement of 5-10x for large spreadsheets
- [ ] WASM bundle < 500KB
- [ ] Zero breaking changes in API

## Phase 2: Controller/UI Logic

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

#### 1. State machine core

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

#### 2. Controller logic

```rust
#[wasm_bindgen]
pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
    viewport_manager: Box<dyn ViewportManager>,
}
```

#### 3. Vim mode

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

## Phase 3: Web UI Migration

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

#### 1. Canvas rendering

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

#### 2. Event handling

```rust
pub struct MouseHandler {
    canvas: HtmlCanvasElement,
    on_cell_click: Closure<dyn FnMut(MouseEvent)>,
}
```

#### 3. Component integration

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

## Phase 4: TUI Implementation

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

## Immediate Action Items

### Week 1: WASM Integration (Current Priority)
1. **Build WASM module** 
   ```bash
   cd gridcore-rs/gridcore-wasm && wasm-pack build --target web --out-dir pkg
   ```
2. **Implement WASM bindings** in `gridcore-rs/gridcore-wasm/src/lib.rs`
3. **Complete TypeScript adapter** in `packages/core/src/rust-adapter/facade.ts`
4. **Add build scripts** to package.json
5. **Test WASM loading** in browser and Node.js environments

### Week 2: Testing & Validation
1. **Port TypeScript test suite** to test Rust implementation
2. **Create parity tests** comparing Rust and TypeScript outputs
3. **Performance benchmarks** for large spreadsheets
4. **Memory usage profiling**
5. **Fix any API compatibility issues**

### Week 3: Gradual Rollout
1. **Implement feature flags** in packages/core/src/index.ts
2. **Enable in development** environment first
3. **Run parallel testing** with both implementations
4. **Monitor for issues** and performance metrics
5. **Document any behavioral differences**

### Week 4: Production Migration
1. **Enable for beta users** with opt-in flag
2. **Monitor error rates** and performance
3. **Full production rollout** if metrics are good
4. **Archive TypeScript implementation** to separate branch
5. **Update all documentation**

## Known Issues & Cleanup Tasks

### Rust Code Cleanup
- [ ] Remove unused imports (shown in compiler warnings):
  - `std::ops::Range` in references/parser.rs
  - `CellValue` in workbook/sheet.rs
  - `SheetProperties` in workbook/workbook.rs
  - `FormulaParser` in workbook/workbook.rs
  - `HashSet` in workbook/workbook.rs
  - Various imports in sheet_manager.rs
- [ ] Run `cargo clippy` for additional linting
- [ ] Run `cargo fmt` for consistent formatting

### WASM Optimization
- [ ] Configure wasm-opt for size optimization
- [ ] Enable SIMD instructions if targeting modern browsers
- [ ] Consider using wee_alloc for smaller WASM size
- [ ] Profile and optimize hot paths

### TypeScript Integration
- [ ] Ensure all Result types are properly mapped
- [ ] Handle async initialization gracefully
- [ ] Implement proper error boundaries
- [ ] Add TypeScript type definitions for WASM module

## Conclusion

This incremental approach allows us to:

- **Validate performance gains early** with the core engine (already seeing 243 passing tests)
- **Maintain a working product** throughout migration
- **Learn and adjust** strategy based on each phase
- **Minimize risk** by keeping TypeScript fallbacks via feature flags
- **Measure success** with clear metrics at each stage

The Rust implementation is essentially complete and tested. The remaining work is primarily integration - building the WASM module, completing the adapter layer, and ensuring seamless interoperability with the existing TypeScript UI components.

