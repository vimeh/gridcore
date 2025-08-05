# Column and Row Selection Plan

## Executive Summary

This document outlines a plan to implement full column and row selection capabilities in the gridcore spreadsheet, building on the existing visual selection infrastructure and the completed ui-core refactoring. The implementation will support both keyboard-driven (vim-style) and mouse-driven selection patterns across all UI platforms.

## Current State

### Completed UI-Core Architecture
- ✅ UIState with discriminated unions for different modes
- ✅ VimBehavior for spreadsheet-level navigation
- ✅ CellVimBehavior for cell-level editing
- ✅ ResizeBehavior for keyboard-driven resize operations
- ✅ SpreadsheetController coordinating all behaviors
- ✅ UIStateMachine for state transitions

### Gaps to Fill
- Visual selection mode exists but only supports cell ranges
- Row selection is partially implemented in navigation mode
- No column selection capability
- Selection state is managed in UIState but doesn't distinguish selection types

## Requirements

### Functional Requirements

1. **Column Selection**
   - Select entire column(s) with keyboard shortcuts
   - Visual indicator for selected columns
   - Support multi-column selection
   - Integration with existing vim visual mode

2. **Row Selection**
   - Complete row selection implementation
   - Visual indicator for selected rows  
   - Support multi-row selection
   - Consistent with column selection behavior

3. **Selection Operations**
   - Copy/paste entire rows/columns
   - Delete contents of selected rows/columns
   - Apply formatting to entire rows/columns
   - Fill operations across selections

4. **Keyboard Navigation**
   - Vim-style commands for column/row selection
   - Extend selection with Shift+navigation
   - Jump to column/row boundaries

### Non-Functional Requirements

- Performance: Selection of 10,000+ rows should be instant
- Memory: Efficient representation of large selections
- Consistency: Same behavior across TUI and Web UI

## Architecture Design

### State Representation

Building on the existing UIState architecture in ui-core:

```typescript
// Extend the selection types in UIState
type SelectionType = 
  | { type: "cell"; address: CellAddress }
  | { type: "range"; start: CellAddress; end: CellAddress }
  | { type: "column"; columns: number[] }  // New
  | { type: "row"; rows: number[] }        // New
  | { type: "multi"; selections: Selection[] }; // For complex selections

interface Selection {
  type: SelectionType;
  anchor?: CellAddress; // For extending selections
}

// Extend existing UIState types to add visual selection mode
type UIState =
  | {
      spreadsheetMode: "navigation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      selection?: Selection; // Optional selection in navigation
    }
  | {
      spreadsheetMode: "visual";  // New mode
      cursor: CellAddress;
      viewport: ViewportInfo;
      selection: Selection; // Required in visual mode
      visualMode: "char" | "line" | "block" | "column" | "row"; // Selection type
      anchor: CellAddress; // Where selection started
    }
  | // ... existing modes (editing, command, resize)

// New factory functions to add to UIState.ts
export function createVisualState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  visualMode: VisualMode,
  anchor: CellAddress,
  selection: Selection
): UIState {
  return {
    spreadsheetMode: "visual",
    cursor,
    viewport,
    visualMode,
    anchor,
    selection,
  };
}
```

### Core Domain Model Updates

```typescript
// In @gridcore/core
interface SpreadsheetEngine {
  // New selection methods
  selectColumn(col: number): void;
  selectRow(row: number): void;
  selectColumns(start: number, end: number): void;
  selectRows(start: number, end: number): void;
  
  // Operations on selections
  getCellsInSelection(selection: Selection): CellAddress[];
  getSelectionBounds(selection: Selection): { 
    minRow: number; 
    maxRow: number; 
    minCol: number; 
    maxCol: number; 
  };
}
```

### Integration with Existing VimBehavior

```typescript
// Extend VimBehavior in ui-core/src/behaviors/VimBehavior.ts
// Add new visual mode commands to the existing command map

// Column/row selection commands to add to VimBehavior
const visualSelectionCommands = {
  // Visual mode transitions
  'v': { action: 'enterVisualChar', description: 'Character-wise visual' },
  'V': { action: 'enterVisualLine', description: 'Line-wise visual (row)' },
  'Ctrl+v': { action: 'enterVisualBlock', description: 'Block-wise visual' },
  'gC': { action: 'enterVisualColumn', description: 'Column-wise visual' },
  
  // In visual mode navigation extends selection
  'h': { action: 'extendLeft', description: 'Extend selection left' },
  'j': { action: 'extendDown', description: 'Extend selection down' },
  'k': { action: 'extendUp', description: 'Extend selection up' },
  'l': { action: 'extendRight', description: 'Extend selection right' },
  
  // Column/row specific
  'aC': { action: 'selectEntireColumn', description: 'Select entire column' },
  'aR': { action: 'selectEntireRow', description: 'Select entire row' },
  'iC': { action: 'selectColumnData', description: 'Select column data only' },
  'iR': { action: 'selectRowData', description: 'Select row data only' },
};

// Selection state transitions for UIStateMachine
const visualTransitions = {
  "navigation.ENTER_VISUAL_CHAR": (state: UIState): UIState => {
    return createVisualState(
      state.cursor,
      state.viewport,
      "char",
      state.cursor,
      { type: { type: "cell", address: state.cursor } }
    );
  },
  
  "navigation.ENTER_VISUAL_LINE": (state: UIState): UIState => {
    return createVisualState(
      state.cursor,
      state.viewport,
      "line",
      state.cursor,
      { type: { type: "row", rows: [state.cursor.row] } }
    );
  },
  
  "navigation.ENTER_VISUAL_COLUMN": (state: UIState): UIState => {
    return createVisualState(
      state.cursor,
      state.viewport,
      "column",
      state.cursor,
      { type: { type: "column", columns: [state.cursor.col] } }
    );
  },
  
  "visual.EXIT_VISUAL": (state: UIState): UIState => {
    return createNavigationState(state.cursor, state.viewport);
  },
};
```

### Selection Manager Integration with SpreadsheetController

```typescript
// Extend SpreadsheetController to handle selections
export class SelectionManager {
  private controller: SpreadsheetController;
  
  constructor(controller: SpreadsheetController) {
    this.controller = controller;
  }
  
  updateSelection(state: UIState): Selection | undefined {
    if (!isVisualMode(state)) {
      return undefined;
    }
    
    const { anchor, cursor, visualMode } = state;
    
    switch (visualMode) {
      case "char":
        return this.createCharSelection(anchor, cursor);
      case "line":
        return this.createLineSelection(anchor, cursor);
      case "block":
        return this.createBlockSelection(anchor, cursor);
      case "column":
        return this.createColumnSelection(anchor, cursor);
      case "row":
        return this.createRowSelection(anchor, cursor);
    }
  }
  
  private createColumnSelection(anchor: CellAddress, cursor: CellAddress): Selection {
    const startCol = Math.min(anchor.col, cursor.col);
    const endCol = Math.max(anchor.col, cursor.col);
    const columns = [];
    for (let col = startCol; col <= endCol; col++) {
      columns.push(col);
    }
    return { type: { type: "column", columns } };
  }
  
  private createRowSelection(anchor: CellAddress, cursor: CellAddress): Selection {
    const startRow = Math.min(anchor.row, cursor.row);
    const endRow = Math.max(anchor.row, cursor.row);
    const rows = [];
    for (let row = startRow; row <= endRow; row++) {
      rows.push(row);
    }
    return { type: { type: "row", rows } };
  }
}
```

## Visual Design

### Column Selection Indicators

```
     A       B       C       D       E
   [===]   [   ]   [   ]   [   ]   [   ]  <- Column headers highlighted
 1 | * |   |   |   |   |   |   |   |   |
 2 | * |   |   |   |   |   |   |   |   |
 3 | * |   |   |   |   |   |   |   |   |
```

### Row Selection Indicators

```
     A     B     C     D     E
 1 [***********************]  <- Entire row highlighted
 2 |   |   |   |   |   |   |
 3 |   |   |   |   |   |   |
```

### Multi-Column Selection

```
     A       B       C       D       E
   [===]   [===]   [===]   [   ]   [   ]
 1 | * |   | * |   | * |   |   |   |   |
 2 | * |   | * |   | * |   |   |   |   |
```

## Implementation Phases

### Phase 1: Extend UIState and VimBehavior
1. Add visual selection mode to UIState discriminated union
2. Create visual state factory functions
3. Extend VimBehavior with visual mode commands
4. Add visual mode transitions to UIStateMachine
5. Write unit tests for new state transitions

### Phase 2: Implement SelectionManager
1. Create SelectionManager class in ui-core
2. Integrate with SpreadsheetController
3. Implement selection creation algorithms
4. Add selection bounds calculation
5. Write comprehensive tests

### Phase 3: Update Behaviors
1. Extend VimBehavior command map with visual commands
2. Add visual mode handling to handleKeyPress
3. Implement selection extension logic
4. Update ResizeBehavior for visual selections
5. Test all vim command sequences

### Phase 4: UI Implementation
1. Update TUI renderer for column/row highlights
2. Update Web UI canvas renderer
3. Add visual feedback for selections
4. Implement selection animations (Web UI)
5. Cross-platform testing

### Phase 5: Operations on Selections
1. Implement copy/paste for columns/rows
2. Add delete operations
3. Support bulk operations on selections
4. Integration with undo/redo
5. Performance optimization

## Testing Strategy

### Unit Tests
- Selection state management
- Bounds calculation for large selections
- Vim command parsing and execution
- Selection history management

### Integration Tests
- Column selection → copy → paste workflow
- Row selection → delete → undo workflow
- Multi-column selection operations
- Keyboard and mouse interaction combinations

### Performance Tests
- Select all columns (1000+ columns)
- Select all rows (100,000+ rows)
- Memory usage for large selections
- Rendering performance with selections

## Performance Considerations

### Efficient Selection Representation
```typescript
// Instead of storing every selected cell
type ColumnSelection = {
  type: "column";
  columns: number[]; // Just column indices
}

// Lazy evaluation for cell iteration
function* iterateColumnCells(col: number, maxRow: number) {
  for (let row = 0; row <= maxRow; row++) {
    yield { row, col };
  }
}
```

### Rendering Optimization
- Only render visible portion of selection
- Use CSS classes for Web UI instead of per-cell styling
- Batch DOM updates for selection changes

## Success Metrics

1. **Performance**: Column selection of 10,000 rows < 10ms
2. **Memory**: Selection state < 1KB for typical use cases  
3. **Completeness**: All Excel-equivalent selection operations supported
4. **Consistency**: Identical behavior across TUI and Web UI
5. **Usability**: Vim users find commands intuitive

## Future Extensions

1. **Named Ranges**: Save selections as named ranges
2. **Selection Formulas**: SUM(A:A) for entire columns
3. **Conditional Selection**: Select cells matching criteria
4. **Selection Macros**: Record and replay selection patterns
5. **Mouse Gestures**: Click column header to select