# GridCore Architecture

## Overview

GridCore follows a clean three-layer architecture designed for maintainability, testability, and performance. Each layer has distinct responsibilities with clear boundaries.

```
┌─────────────────────────────────────────┐
│           gridcore-ui                   │
│  (Pure Rendering - Leptos/WebAssembly)  │
│  • Event capture                        │
│  • Canvas rendering                     │
│  • Thin controller wrappers             │
└──────────────────┬──────────────────────┘
                   │ Delegates to
┌──────────────────▼──────────────────────┐
│        gridcore-controller              │
│     (State & Coordination Layer)        │
│  • ViewportManager                      │
│  • ResizeManager                        │
│  • SelectionManager                     │
│  • Vim mode behaviors                   │
│  • Event interpretation                 │
└──────────────────┬──────────────────────┘
                   │ Uses
┌──────────────────▼──────────────────────┐
│          gridcore-core                  │
│      (Pure Business Logic)              │
│  • Formula engine                       │
│  • Cell calculations                    │
│  • Undo/redo system                     │
│  • Data structures                      │
└─────────────────────────────────────────┘
```

## Layer Responsibilities

### gridcore-core (Foundation Layer)
**Purpose**: Pure spreadsheet business logic with zero UI dependencies

**Key Components**:
- `SpreadsheetFacade`: Main API for spreadsheet operations
- `FormulaEngine`: Formula parsing and evaluation
- `UndoRedoManager`: Command pattern implementation
- `CellRepository`: Cell data storage and retrieval
- `DependencyTracker`: Cell dependency graph management

**Rules**:
- NO imports from controller or UI layers
- NO web-specific types (DOM, events, etc.)
- Pure Rust with standard library only
- All operations must be deterministic and testable

### gridcore-controller (Coordination Layer)
**Purpose**: Bridges core business logic with UI, managing state and coordination

**Key Components**:
- `SpreadsheetController`: Main controller orchestrating all managers
- `ViewportManager`: Viewport state and calculations
  - Scroll position management
  - Visible bounds calculation
  - Cell-to-pixel conversions
- `ResizeManager`: Column/row resize operations
  - Resize state tracking
  - Size constraints enforcement
  - Hover detection logic
- `SelectionManager`: Selection state and operations
- `UIStateMachine`: Mode transitions (Normal, Insert, Visual, etc.)

**Rules**:
- Can import from core layer only
- NO direct UI rendering
- Provides clean API for UI layer
- Manages all state transitions

### gridcore-ui (Presentation Layer)
**Purpose**: Pure rendering and event capture, zero business logic

**Key Components**:
- `Viewport`: Thin wrapper around controller's ViewportManager
- `ResizeHandler`: Delegates resize operations to controller
- `CanvasGrid`: Renders grid based on controller state
- `CellEditor`: Captures input, delegates to controller
- Event handlers: Capture and forward to controller

**Rules**:
- ONLY imports from controller layer
- NO business logic or calculations
- Pure rendering based on controller state
- Event capture and delegation only

## Data Flow

### User Input Flow
```
User Action → UI Event Handler → Controller Method → Core Operation → State Update
                                                                            ↓
Canvas Render ← UI Component Update ← Controller State Changed ← ─────────┘
```

### Example: Cell Edit
1. User types in cell (UI layer captures keypress)
2. UI forwards event to controller
3. Controller interprets event based on current mode
4. Controller calls core's `set_cell_value()`
5. Core updates cell and recalculates dependencies
6. Controller notifies UI of state change
7. UI re-renders affected cells

## Key Design Patterns

### 1. Delegation Pattern
UI components delegate all logic to controller:
```rust
// UI Viewport delegates to controller
pub fn get_column_width(&self, col: usize) -> f64 {
    self.controller.borrow()
        .get_viewport_manager()
        .get_column_width(col)
}
```

### 2. Manager Pattern
Controller uses specialized managers for different concerns:
- ViewportManager for viewport operations
- ResizeManager for resize operations
- SelectionManager for selection state

### 3. Command Pattern
Core uses commands for undo/redo support:
```rust
pub trait Command {
    fn execute(&mut self, sheet: &mut Sheet) -> Result<()>;
    fn undo(&mut self, sheet: &mut Sheet) -> Result<()>;
}
```

### 4. Observer Pattern
UI observes controller state changes through Leptos signals

## Benefits

### 1. Testability
- Core logic tested without UI
- Controller tested with mock UI
- Each layer tested independently

### 2. Maintainability
- Clear responsibilities
- Easy to locate functionality
- Changes isolated to layers

### 3. Reusability
- Core usable in different contexts (CLI, server)
- Controller supports multiple UI implementations
- Managers reusable across features

### 4. Performance
- Minimal cross-boundary calls
- Efficient state updates
- Optimized rendering pipeline

## Migration Guidelines

When adding new features:

1. **Identify the layer**:
   - Business logic → Core
   - State management → Controller
   - User interaction → UI

2. **Follow the flow**:
   - UI captures event
   - Controller processes event
   - Core performs operation
   - State flows back to UI

3. **Maintain boundaries**:
   - Never skip layers
   - Don't mix responsibilities
   - Keep thin wrappers in UI

## Example: Adding a New Feature

### Task: Add cell comments feature

1. **Core Layer**:
   ```rust
   // In gridcore-core
   struct CellComment {
       text: String,
       author: String,
       timestamp: DateTime,
   }
   
   impl Cell {
       pub fn set_comment(&mut self, comment: CellComment) { ... }
       pub fn get_comment(&self) -> Option<&CellComment> { ... }
   }
   ```

2. **Controller Layer**:
   ```rust
   // In gridcore-controller
   impl SpreadsheetController {
       pub fn add_comment(&mut self, address: CellAddress, text: String) {
           let comment = CellComment::new(text, self.current_user());
           self.facade.set_cell_comment(address, comment);
           self.notify_ui_update();
       }
   }
   ```

3. **UI Layer**:
   ```rust
   // In gridcore-ui
   fn handle_comment_submit(text: String) {
       controller.borrow_mut().add_comment(current_cell, text);
       render_comment_indicator();
   }
   ```

## Anti-patterns to Avoid

❌ **Business logic in UI**:
```rust
// BAD: UI calculating cell positions
fn get_cell_x(&self, col: usize) -> f64 {
    let mut x = 0.0;
    for c in 0..col {
        x += self.column_widths[c];  // UI shouldn't manage this
    }
    x
}
```

❌ **UI types in Core**:
```rust
// BAD: Core using web types
use web_sys::MouseEvent;  // Core should never import web types
```

❌ **Direct Core access from UI**:
```rust
// BAD: UI directly calling core
self.facade.set_cell_value(address, value);  // Should go through controller
```

✅ **Correct approach**:
```rust
// GOOD: UI delegates to controller
self.controller.borrow_mut().set_cell_value(address, value);
```

## Future Considerations

### Potential Enhancements
1. **Plugin System**: Controllers could support plugins
2. **Multiple UIs**: Same controller, different renderers (Canvas, WebGL, Terminal)
3. **Server Mode**: Core running on server, controller managing sessions
4. **Collaborative Editing**: Controller managing multi-user state

### Scalability
The architecture scales well:
- Add managers to controller for new features
- Extend core without affecting UI
- Swap UI implementations without touching logic

## Conclusion

This architecture ensures GridCore remains maintainable, testable, and performant as it grows. By maintaining strict layer boundaries and clear responsibilities, the codebase stays organized and developer-friendly.