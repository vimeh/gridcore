# UI Consolidation Plan: Making Web UI Downstream of TUI

## Executive Summary

This document outlines a plan to consolidate the TUI (Terminal User Interface), Web UI, and Desktop UI codebases by extracting shared UI logic into a dedicated ui-core package. Building upon the existing @gridcore/core engine, this ui-core layer will house common UI behaviors (like vim keybindings and state management) while making the Web UI consume the TUI's cleaner architecture. This approach will reduce code duplication, improve maintainability, and ensure consistent behavior across all interfaces.

## Current State Analysis

### Existing "Hydra Architecture"

The project already implements the foundational "Hydra Architecture" from the original PLAN.md:

- **@gridcore/core**: The headless spreadsheet engine with domain-driven design
  - Domain models (Cell, CellAddress, Formula)
  - Infrastructure (repositories, parsers, evaluators)
  - Application services (CalculationService, FormulaService)
- **ui-tui**: Terminal UI package
- **ui-web**: Browser UI package
- **ui-desktop**: Desktop UI package (using Tauri)

What's missing is a shared UI logic layer between the engine and the UI implementations.

### Architecture Comparison

#### TUI Architecture (Cleaner, More Centralized)

```
SpreadsheetTUI
├── TUIState (single source of truth)
├── VimBehavior (centralized vim logic)
├── Terminal (rendering abstraction)
└── Components (FormulaBar, Grid, StatusBar)
```

**Strengths:**

- Single `TUIState` object manages all application state
- `VimBehavior` class provides clear action/response pattern
- Direct mapping from keyboard input to actions
- Minimal abstraction layers
- Clear separation of concerns

#### Web UI Architecture (More Complex, Distributed)

```
CanvasGrid
├── SpreadsheetStateMachine (complex state management)
├── KeyboardHandler
│   └── GridVimBehavior (partial vim implementation)
├── SelectionManager
├── Multiple Renderers
└── Various Handlers
```

**Weaknesses:**

- State distributed across multiple systems
- Vim logic split between `GridVimBehavior`, `KeyboardHandler`, and state machine
- Complex state machine with discriminated unions adds cognitive overhead
- Multiple layers of indirection between input and action

### Code Duplication Analysis (Updated)

Both UIs implement identical features with different approaches:

1. **Vim Keybindings**

   - TUI: `VimBehavior.ts` with clean action-based approach
     - Returns `VimAction` objects describing what should happen
     - Self-contained state management with `VimState`
   - Web: `GridVimBehavior.ts` with callback-based approach
     - Uses callbacks instead of returning actions
     - Depends on external state and multiple collaborators
   - Duplicated: Command parsing, motion handling, mode transitions, number buffers

1. **State Management**

   - TUI: Simple object with direct property access
   - Web: Complex state machine with 523 lines
   - Both track: mode, cursor position, selections, editing state

1. **Two-Level Mode System** (Critical Architectural Difference)

   - Web UI correctly implements nested modes:
     - Spreadsheet level: navigation between cells vs editing a cell
     - Cell level: normal/insert/visual modes within the cell editor
   - TUI currently conflates these levels
   - Same key (e.g., 'j') means different things at different levels

1. **Navigation Logic**

   - Both implement: h/j/k/l, word motion, line jumps
   - Different implementations of the same algorithms

## Proposed Architecture

### High-Level Design

```
packages/
├── core/                       # Existing spreadsheet engine
│   ├── Domain Models           # Cell, Formula, etc.
│   ├── Infrastructure          # Parsers, Evaluators
│   └── Application Services    # Calculation, Formula services
├── ui-core/                    # New shared UI package
│   ├── SpreadsheetController   # UI logic coordinator
│   ├── VimBehavior             # Moved from TUI
│   ├── State Types             # Unified UI state interface
│   └── Action Dispatchers      # Common UI action handling
├── ui-tui/
│   ├── SpreadsheetTUI          # Extends Controller
│   └── Terminal Rendering      # TUI-specific only
├── ui-web/
│   ├── CanvasGrid             # Consumes Controller
│   └── Canvas Rendering       # Web-specific only
└── ui-desktop/
    └── Tauri Integration      # Reuses ui-web components
```

### Key Design Decisions

#### 1. Why TUI as the Foundation?

The TUI has evolved a cleaner architecture because:

- **Constraints breed clarity**: Terminal limitations forced simpler solutions
- **No legacy baggage**: Built more recently with lessons learned
- **Direct action mapping**: No need for complex state machines
- **Proven vim implementation**: Already handles all edge cases

#### 2. Controller Pattern

The `SpreadsheetController` will bridge UI concerns with the existing `SpreadsheetEngine`:

- Own the UI state (based on `TUIState`)
- Delegate spreadsheet operations to `SpreadsheetEngine` from `@gridcore/core`
- Process all keyboard input through `VimBehavior`
- Emit events for UI updates
- Coordinate between UI state and engine state

```typescript
// Example API
class SpreadsheetController extends EventEmitter {
  private uiState: UIState;
  private engine: SpreadsheetEngine; // From @gridcore/core
  private vimBehavior: VimBehavior;
  
  handleKeyPress(key: string, meta: KeyMeta): void {
    const action = this.vimBehavior.handleKeyPress(key, meta, this.uiState);
    this.dispatchAction(action);
    
    // Update engine if needed
    if (action.type === 'setValue') {
      this.engine.setCellValue(action.address, action.value);
    }
    
    this.emit('stateChanged', this.uiState);
  }
  
  getUIState(): Readonly<UIState> {
    return this.uiState;
  }
}
```

#### 3. Type-Safe Nested State Design

To handle the two-level mode system (spreadsheet navigation vs cell editing) with full type safety:

```typescript
// Core shared state properties
interface CoreUIState {
  cursor: CellAddress;
  viewport: ViewportInfo;
}

// Cell editing mode types (when editing a cell)
type CellMode = "normal" | "insert" | "visual";

// Spreadsheet-level state with nested modes
type UIState = 
  | {
      spreadsheetMode: "navigation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      // No cell editing state when navigating
    }
  | {
      spreadsheetMode: "editing";
      cursor: CellAddress;
      viewport: ViewportInfo;
      cellMode: CellMode;           // Required when editing
      editingValue: string;         // The cell's text content
      cursorPosition: number;       // Position within the text
      visualStart?: number;         // For visual selection within cell
      editVariant?: "i" | "a" | "A" | "I" | "o" | "O";
    }
  | {
      spreadsheetMode: "command";
      cursor: CellAddress;
      viewport: ViewportInfo;
      commandValue: string;
    };

// Type guards for safe access
function isEditingMode(state: UIState): state is Extract<UIState, { spreadsheetMode: "editing" }> {
  return state.spreadsheetMode === "editing";
}

// Clear separation of keyboard handling
function handleKeyPress(state: UIState, key: string): UIState {
  if (state.spreadsheetMode === "editing") {
    // Delegate to cell-level vim behavior
    return handleCellModeKey(state, key);
  } else {
    // Handle spreadsheet navigation
    return handleSpreadsheetKey(state, key);
  }
}
```

This design:

- Makes invalid states impossible (can't have `cellMode` without being in editing state)
- Clearly separates the two levels of interaction
- Maintains type safety throughout
- Supports all the complex Web UI features (resize mode, visual block selection)

### Type Safety Guarantees

The consolidated architecture maintains and enhances type safety through multiple layers:

#### 1. **Compile-Time Safety**
```typescript
// ✅ Valid state construction
const navState: UIState = {
  spreadsheetMode: "navigation",
  cursor: { row: 0, col: 0 },
  viewport: { /* ... */ }
};

// ❌ TypeScript error: cellMode doesn't exist on navigation state
navState.cellMode = "insert"; // Error!

// ✅ Type guard ensures safe access
if (isEditingMode(state)) {
  console.log(state.cellMode);       // No error
  console.log(state.editingValue);   // No error
}
```

#### 2. **Runtime Validation**
```typescript
// State machine validates transitions at runtime
const result = stateMachine.transition({
  type: "ENTER_INSERT_MODE"
});

if (!result.ok) {
  // TypeScript knows this is an error case
  console.error(result.error); // string error message
} else {
  // TypeScript knows this is the success case
  const newState: UIState = result.value;
}
```

#### 3. **Action Type Safety**
```typescript
// Actions are strongly typed with discriminated unions
type Action =
  | { type: "START_EDITING"; editMode?: InsertMode }
  | { type: "ENTER_VISUAL_MODE"; visualType: VisualMode; anchor?: CellAddress }
  | { type: "EXIT_TO_NAVIGATION" };

// ❌ Invalid action types caught at compile time
stateMachine.transition({ type: "INVALID_ACTION" }); // Error!
```

#### 4. **Transition Safety**
```typescript
// Each transition handler is type-checked
private enterInsertMode(
  state: UIState, 
  action: Extract<Action, { type: "ENTER_INSERT_MODE" }>
): Result<UIState> {
  // TypeScript ensures we handle the correct state shape
  if (state.spreadsheetMode !== "editing" || 
      state.cellMode !== "normal") {
    return { ok: false, error: "Invalid state for this transition" };
  }
  
  // Return type is validated
  return {
    ok: true,
    value: {
      ...state,
      cellMode: "insert",
      // All required fields must be present
    }
  };
}
```

#### 4. Lightweight State Machine for ui-core

The ui-core package will include a lightweight state machine that provides the benefits of formal state management without the complexity:

```typescript
// In ui-core/src/state/UIStateMachine.ts
export class UIStateMachine {
  private state: UIState;
  private transitions: Map<string, TransitionHandler>;
  private listeners: Array<(state: UIState) => void> = [];
  
  constructor(initialState?: UIState) {
    this.state = initialState || { spreadsheetMode: "navigation", /* ... */ };
    
    // Define valid transitions using the nested state types
    this.transitions = new Map([
      ["navigation.START_EDITING", this.startEditing.bind(this)],
      ["editing.EXIT_TO_NAVIGATION", this.exitToNavigation.bind(this)],
      ["editing.normal.ENTER_INSERT", this.enterInsert.bind(this)],
      ["editing.insert.EXIT_INSERT", this.exitInsert.bind(this)],
      ["editing.normal.ENTER_VISUAL", this.enterVisual.bind(this)],
      // ... other transitions
    ]);
  }
  
  transition(action: Action): Result<UIState> {
    const key = this.getTransitionKey(this.state, action);
    const handler = this.transitions.get(key);
    
    if (!handler) {
      return { ok: false, error: `Invalid transition: ${key}` };
    }
    
    const result = handler(this.state, action);
    if (result.ok) {
      this.state = result.value;
      this.notifyListeners();
    }
    
    return result;
  }
  
  // Helper methods for common transitions
  startEditingMode(editMode?: InsertMode): Result<UIState> {
    return this.transition({ type: "START_EDITING", editMode });
  }
  
  subscribe(listener: (state: UIState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}
```

Benefits of this approach:
- **Type Safety**: Transitions are validated against the UIState types
- **Debugging**: Clear trace of state changes via transition history
- **Visualization**: Can generate state diagrams from the transition map
- **Flexibility**: UIs can choose to use the state machine or update state directly
- **Familiarity**: Web UI developers can continue using state machine patterns

#### 5. State Visualization and Documentation

The ui-core package will include tools for generating state diagrams:

```typescript
// In ui-core/src/state/StateVisualizer.ts
export class StateVisualizer {
  static generateMermaidDiagram(stateMachine: UIStateMachine): string {
    // Generate Mermaid diagram from transition map
    // Similar to existing Web UI's stateMachineVisualizer.ts
  }
  
  static generateHTMLDocumentation(stateMachine: UIStateMachine): string {
    // Generate interactive HTML documentation
  }
}
```

This enables all UIs to benefit from visual documentation of state transitions.

#### 6. State Adaptation Layer

Web UI specific needs will be handled by adapters:

```typescript
// Maps core state to web UI needs
class WebStateAdapter {
  private stateMachine: UIStateMachine;
  
  constructor() {
    this.stateMachine = new UIStateMachine();
  }
  
  // Web UI can choose to use state machine or direct updates
  handleAction(action: Action): UIState {
    const result = this.stateMachine.transition(action);
    if (!result.ok) {
      console.warn(`Invalid transition: ${result.error}`);
      return this.stateMachine.getState();
    }
    return result.value;
  }
}
```

## Feature Classification: Shared vs Platform-Specific

### Shared Features (ui-core)

These features will be implemented once in ui-core and used by all UIs:

1. **Vim Keybindings**
   - Mode management (normal, insert, visual, command)
   - Motion commands (h/j/k/l, w/b/e, 0/$, gg/G)
   - Operators (d/c/y/p)
   - Count prefixes and repeat commands
   - Both spreadsheet-level and cell-level vim behaviors

2. **State Management**
   - Type-safe UIState with discriminated unions
   - Lightweight state machine with transition validation
   - State visualization and documentation generation
   - Event-driven updates

3. **Core Navigation**
   - Cell cursor movement
   - Selection management (single cell, ranges, visual modes)
   - Viewport scrolling
   - Jump-to navigation (Ctrl+G)

4. **Editing Operations**
   - Cell value updates
   - Formula editing
   - Undo/redo coordination
   - Copy/paste operations

### Platform-Specific Features

#### Web UI Only
1. **Mouse Interactions**
   - Click to select cells
   - Drag to select ranges
   - Column/row resize via drag
   - Context menus

2. **InteractionMode**
   - Toggle between "normal" and "keyboard-only" modes
   - Affects how UI responds to mouse events

3. **Resize Mode**
   - Interactive column/row resizing
   - Visual feedback during resize
   - Snap-to-grid behavior

4. **Canvas Rendering**
   - Hardware-accelerated drawing
   - Smooth scrolling
   - Zoom levels

#### TUI Only
1. **Terminal Constraints**
   - Character-based rendering
   - Limited color palette
   - No mouse support (by design)

2. **Terminal-Specific UI**
   - Box-drawing characters for grid
   - ASCII-based selection indicators
   - Terminal bell for alerts

### Extension Points

The architecture provides hooks for platform-specific features:

```typescript
interface PlatformAdapter {
  // Override to add platform-specific state
  extendState?(baseState: UIState): PlatformState;
  
  // Handle platform-specific actions
  handlePlatformAction?(action: PlatformAction): void;
  
  // Platform-specific rendering
  render(state: UIState): void;
}
```

## Implementation Plan

### Phase 1: Extract Core Package (Week 1)

1. Create `packages/ui-core` structure using Bun workspace
2. Design nested `UIState` types with proper discriminated unions
3. Implement lightweight `UIStateMachine` class with transition validation
4. Move `VimBehavior` from TUI to ui-core (adapt to support two-level modes)
5. Create `SpreadsheetController` base class that uses the state machine
6. Implement separate `CellVimBehavior` for cell-level editing
7. Port `StateVisualizer` from Web UI for diagram generation
8. Set up package exports and dependencies
9. Add @gridcore/core as dependency for SpreadsheetEngine

### Phase 2: Refactor TUI (Week 2)

1. Make `SpreadsheetTUI` use `SpreadsheetController`
1. Replace direct vim handling with controller
1. Update rendering to use controller state
1. Test all vim commands still work

### Phase 3: Refactor Web UI (Weeks 3-4)

1. Create `WebStateAdapter` for state mapping
1. Replace `SpreadsheetStateMachine` with controller + adapter
1. Update `KeyboardHandler` to delegate to controller
1. Remove `GridVimBehavior` in favor of shared `VimBehavior`
1. Update renderers to use adapted state

### Phase 4: Testing & Polish (Week 5)

1. Comprehensive testing of both UIs
1. Performance profiling
1. Documentation updates
1. Migration guide for extensions

## Benefits

### Immediate Benefits

1. **Reduced Code Size**: ~40% reduction in vim-related code
2. **Bug Fixes Once**: Fix vim behavior bugs in one place
3. **Consistent Behavior**: Both UIs behave identically
4. **Easier Testing**: Test core logic without UI concerns
5. **Type Safety**: Nested state types prevent invalid state combinations
6. **State Machine Benefits**:
   - **Formal Verification**: Only valid state transitions are possible
   - **Visual Documentation**: Auto-generated state diagrams
   - **Debugging**: Clear trace of how system reached current state
   - **Predictability**: No surprise state changes
   - **Testability**: Each transition can be unit tested in isolation

### Long-term Benefits

1. **Faster Feature Development**: Add features to controller, get them in both UIs
2. **Better Maintainability**: Single source of truth for business logic
3. **Easier Onboarding**: New developers learn one system
4. **Platform Flexibility**: Could add mobile UI, VS Code extension, etc.
5. **Living Documentation**: State diagrams always match implementation
6. **Confidence in Changes**: State machine catches invalid transitions early

## Risks and Mitigations

### Risk 1: Web UI Regression

**Mitigation**: Keep existing web UI working during transition, extensive test suite

### Risk 2: Performance Impact

**Mitigation**: Profile critical paths, optimize adapter layer, use memoization

### Risk 3: Lost Web-Specific Features

**Mitigation**: Careful audit of web-only features, ensure extension points exist

### Risk 4: Conflicts with Web UI Mode Consolidation

**Mitigation**: This plan is compatible with the archived MODE_CONSOLIDATION_PLAN.md - both aim to simplify mode management, just at different levels

## Success Metrics

1. **Code Reduction**: Target 30-40% less code overall
1. **Bug Reduction**: Single fix location for logic bugs
1. **Test Coverage**: 90%+ coverage of core package
1. **Performance**: No regression in either UI
1. **Developer Velocity**: 50% faster to add new features

## Alternatives Considered

### Alternative 1: Extract from Web UI Instead

**Rejected because**: Web UI is more complex and would require more refactoring of TUI

### Alternative 2: Keep Separate Implementations

**Rejected because**: Continued divergence, duplicate maintenance burden

## Conclusion

By making the Web UI downstream of the TUI architecture, we can:

- Eliminate code duplication
- Ensure consistent behavior
- Reduce maintenance burden
- Enable faster feature development
- Maintain the unique strengths of each UI

The TUI's simpler architecture, born from terminal constraints, provides a solid foundation for both interfaces. This consolidation will make the codebase more maintainable and extensible for future UI platforms.
