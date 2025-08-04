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

#### 4. State Adaptation Layer

Web UI specific needs will be handled by adapters:

```typescript
// Maps core state to web UI needs
class WebStateAdapter {
  static toCanvasState(coreState: CoreState): CanvasState {
    return {
      // Map TUI modes to web state machine states
      navigationMode: coreState.mode === 'normal' ? 'navigation' : 'editing',
      editingSubstate: this.mapEditingMode(coreState),
      // ... other mappings
    };
  }
}
```

## Implementation Plan

### Phase 1: Extract Core Package (Week 1)

1. Create `packages/ui-core` structure using Bun workspace
1. Design nested `UIState` types with proper discriminated unions
1. Move `VimBehavior` from TUI to ui-core (adapt to support two-level modes)
1. Create `SpreadsheetController` base class
1. Implement separate `CellVimBehavior` for cell-level editing
1. Set up package exports and dependencies
1. Add @gridcore/core as dependency for SpreadsheetEngine

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
1. **Bug Fixes Once**: Fix vim behavior bugs in one place
1. **Consistent Behavior**: Both UIs behave identically
1. **Easier Testing**: Test core logic without UI concerns
1. **Type Safety**: Nested state types prevent invalid state combinations

### Long-term Benefits

1. **Faster Feature Development**: Add features to controller, get them in both UIs
1. **Better Maintainability**: Single source of truth for business logic
1. **Easier Onboarding**: New developers learn one system
1. **Platform Flexibility**: Could add mobile UI, VS Code extension, etc.

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

### Alternative 3: Full Rewrite

**Rejected because**: Too risky, would lose battle-tested code

## Conclusion

By making the Web UI downstream of the TUI architecture, we can:

- Eliminate code duplication
- Ensure consistent behavior
- Reduce maintenance burden
- Enable faster feature development
- Maintain the unique strengths of each UI

The TUI's simpler architecture, born from terminal constraints, provides a solid foundation for both interfaces. This consolidation will make the codebase more maintainable and extensible for future UI platforms.
