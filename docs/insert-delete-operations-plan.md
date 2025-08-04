# Insert and Delete Operations Plan

## Executive Summary

This document outlines a comprehensive plan for implementing row and column insertion/deletion operations in gridcore. These operations are fundamental to spreadsheet functionality and require careful handling of formula references, data shifting, and undo/redo support. This plan builds upon the completed ui-core refactoring.

## Current State

### Completed UI-Core Architecture
- ✅ UIState with discriminated unions for different modes
- ✅ SpreadsheetController coordinating behaviors
- ✅ VimBehavior and CellVimBehavior for keyboard handling
- ✅ UIStateMachine for state transitions
- ✅ ResizeBehavior for column/row resize operations

### Gaps to Fill
- Grid has fixed dimensions with no insert/delete capability
- Cell references in formulas are static
- No infrastructure for shifting cell data
- Undo/redo exists but doesn't handle structural changes

## Requirements

### Functional Requirements

1. **Insert Operations**
   - Insert single or multiple rows/columns
   - Insert above/below for rows, left/right for columns
   - Preserve cell formatting and formulas
   - Update all formula references automatically

2. **Delete Operations**
   - Delete single or multiple rows/columns
   - Shift remaining data appropriately
   - Handle formula references to deleted cells
   - Warn about data loss when appropriate

3. **Formula Reference Updates**
   - Adjust all cell references when inserting/deleting
   - Handle absolute ($) and relative references correctly
   - Update named ranges
   - Manage circular reference detection

4. **Data Integrity**
   - Preserve data relationships
   - Maintain formula validity
   - Handle edge cases (deleting referenced cells)
   - Support undo/redo of structural changes

### Non-Functional Requirements

- Performance: Insert/delete 1000 rows in < 100ms
- Memory: Efficient storage of sparse data after deletions
- Correctness: No formula corruption or data loss
- Scalability: Support up to 1M rows/16K columns

## Architecture Design

### Core Domain Model Updates

```typescript
// In @gridcore/core
interface StructuralChange {
  type: "insertRow" | "insertColumn" | "deleteRow" | "deleteColumn";
  index: number;
  count: number;
  timestamp: number;
}

interface SpreadsheetEngine {
  // Insert operations
  insertRows(beforeRow: number, count: number): void;
  insertColumns(beforeCol: number, count: number): void;
  
  // Delete operations
  deleteRows(startRow: number, count: number): void;
  deleteColumns(startCol: number, count: number): void;
  
  // Bulk operations
  insertRowsAtMultiple(positions: number[], counts: number[]): void;
  deleteRowsAtMultiple(positions: number[], counts: number[]): void;
  
  // Query operations
  canDeleteRows(rows: number[]): { safe: boolean; warnings: string[] };
  canDeleteColumns(cols: number[]): { safe: boolean; warnings: string[] };
}

// Formula reference updater
interface ReferenceUpdater {
  updateForInsertRows(formula: string, row: number, count: number): string;
  updateForDeleteRows(formula: string, row: number, count: number): string;
  updateForInsertColumns(formula: string, col: number, count: number): string;
  updateForDeleteColumns(formula: string, col: number, count: number): string;
}
```

### Reference Update Algorithm

```typescript
class CellReferenceUpdater implements ReferenceUpdater {
  updateForInsertRows(formula: string, insertRow: number, count: number): string {
    return formula.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
      const rowNum = parseInt(row);
      if (rowNum >= insertRow) {
        return `${col}${rowNum + count}`;
      }
      return match;
    });
  }
  
  updateForDeleteRows(formula: string, deleteRow: number, count: number): string {
    return formula.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
      const rowNum = parseInt(row);
      if (rowNum >= deleteRow && rowNum < deleteRow + count) {
        // Reference to deleted cell
        return '#REF!';
      } else if (rowNum >= deleteRow + count) {
        return `${col}${rowNum - count}`;
      }
      return match;
    });
  }
  
  // Handle absolute references
  updateAbsoluteReference(ref: string, change: StructuralChange): string {
    const match = ref.match(/(\$?)([A-Z]+)(\$?)(\d+)/);
    if (!match) return ref;
    
    const [, colDollar, col, rowDollar, row] = match;
    const rowNum = parseInt(row);
    const colNum = this.columnToNumber(col);
    
    // Only update non-absolute parts
    if (change.type === "insertRow" && !rowDollar) {
      // Update row reference
    }
    // ... etc
  }
}
```

### Data Structure Optimization

```typescript
// Sparse storage for efficient insert/delete
class SparseGrid {
  private cells: Map<string, Cell>;
  private rowOffsets: number[] = []; // Track inserted/deleted rows
  private colOffsets: number[] = []; // Track inserted/deleted columns
  
  insertRows(beforeRow: number, count: number): void {
    // Shift existing cells
    const updates = new Map<string, Cell>();
    
    this.cells.forEach((cell, key) => {
      const { row, col } = this.parseKey(key);
      if (row >= beforeRow) {
        const newKey = this.makeKey(row + count, col);
        updates.set(newKey, cell);
        this.cells.delete(key);
      }
    });
    
    updates.forEach((cell, key) => this.cells.set(key, cell));
    this.rowOffsets.push({ at: beforeRow, offset: count });
  }
  
  private virtualToPhysical(row: number, col: number): [number, number] {
    // Apply accumulated offsets
    let physicalRow = row;
    for (const offset of this.rowOffsets) {
      if (row >= offset.at) {
        physicalRow += offset.offset;
      }
    }
    return [physicalRow, col];
  }
}
```

### Undo/Redo Support

```typescript
interface StructuralCommand extends Command {
  type: "structural";
  change: StructuralChange;
  affectedCells: Map<string, Cell>; // Backup of affected cells
  affectedFormulas: Map<string, string>; // Original formulas
}

class InsertRowsCommand implements StructuralCommand {
  constructor(
    private row: number,
    private count: number,
    private engine: SpreadsheetEngine
  ) {}
  
  execute(): void {
    // Backup affected formulas
    this.affectedFormulas = this.engine.getFormulasInRange({
      startRow: this.row,
      endRow: Infinity
    });
    
    // Perform insertion
    this.engine.insertRows(this.row, this.count);
  }
  
  undo(): void {
    // Delete the inserted rows
    this.engine.deleteRows(this.row, this.count);
    
    // Restore original formulas
    this.affectedFormulas.forEach((formula, address) => {
      this.engine.setFormula(address, formula);
    });
  }
}
```

### UI State Management

```typescript
// Extend existing UIState types with insert/delete modes
type UIState = 
  | {
      spreadsheetMode: "insert";
      cursor: CellAddress;
      viewport: ViewportInfo;
      insertType: "row" | "column";
      insertPosition: "before" | "after";
      count: number;
      targetIndex: number;
    }
  | {
      spreadsheetMode: "delete";
      cursor: CellAddress;
      viewport: ViewportInfo;
      deleteType: "row" | "column"; 
      selection: number[]; // Indices to delete
      confirmationPending: boolean;
    }
  | // ... existing states (navigation, editing, command, resize)

// Factory functions to add to UIState.ts
export function createInsertState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  insertType: "row" | "column",
  insertPosition: "before" | "after"
): UIState {
  return {
    spreadsheetMode: "insert",
    cursor,
    viewport,
    insertType,
    insertPosition,
    count: 1,
    targetIndex: insertType === "row" ? cursor.row : cursor.col,
  };
}

export function createDeleteState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  deleteType: "row" | "column",
  selection: number[]
): UIState {
  return {
    spreadsheetMode: "delete",
    cursor,
    viewport,
    deleteType,
    selection,
    confirmationPending: true,
  };
}
```

## Integration with VimBehavior

```typescript
// Extend VimBehavior command map with structural commands
const structuralCommands = {
  // Insert operations (avoid conflict with existing 'i' for insert mode)
  'gir': { action: 'insertRowBefore', description: 'Insert row before current' },
  'giR': { action: 'insertRowAfter', description: 'Insert row after current' },
  'gic': { action: 'insertColumnBefore', description: 'Insert column before current' },
  'giC': { action: 'insertColumnAfter', description: 'Insert column after current' },
  
  // Delete operations (integrate with existing 'd' operator)
  'dr': { action: 'deleteRow', description: 'Delete current row' },
  'dc': { action: 'deleteColumn', description: 'Delete current column' },
  'dR': { action: 'deleteRows', description: 'Delete selected rows' },
  'dC': { action: 'deleteColumns', description: 'Delete selected columns' },
  
  // Count support through existing number buffer
  // '5gir' would insert 5 rows before current
  // '3dc' would delete 3 columns
};

// State transitions for UIStateMachine
const structuralTransitions = {
  "navigation.INSERT_ROW_BEFORE": (state: UIState): UIState => {
    return createInsertState(state.cursor, state.viewport, "row", "before");
  },
  
  "navigation.DELETE_ROW": (state: UIState): UIState => {
    return createDeleteState(
      state.cursor,
      state.viewport,
      "row",
      [state.cursor.row]
    );
  },
  
  "insert.CONFIRM_INSERT": (state: UIState): UIState => {
    // Execute insert operation via SpreadsheetController
    // Return to navigation mode
    return createNavigationState(state.cursor, state.viewport);
  },
  
  "delete.CONFIRM_DELETE": (state: UIState): UIState => {
    // Execute delete operation via SpreadsheetController
    // Return to navigation mode
    return createNavigationState(state.cursor, state.viewport);
  },
};
```

## Implementation Phases

### Phase 1: Extend UIState and SpreadsheetController
1. Add insert/delete modes to UIState discriminated union
2. Create factory functions for insert/delete states
3. Add structural transitions to UIStateMachine
4. Extend SpreadsheetController with structural operations
5. Write unit tests for new state transitions

### Phase 2: Core Infrastructure
1. Implement ReferenceUpdater for formula adjustments
2. Add structural change tracking to SpreadsheetEngine
3. Create SparseGrid data structure
4. Implement basic insert/delete operations
5. Write comprehensive unit tests

### Phase 3: VimBehavior Integration
1. Add structural commands to VimBehavior command map
2. Implement count support for bulk operations
3. Add confirmation flow for delete operations
4. Create visual feedback for operations
5. Test vim command sequences

### Phase 4: Formula Intelligence
1. Parse and update all reference types (A1, R1C1, ranges)
2. Handle absolute vs relative references
3. Update named ranges
4. Implement #REF! error handling
5. Test formula integrity

### Phase 5: Performance & Scale
1. Optimize for bulk operations
2. Implement lazy formula updates
3. Add progress indicators for large operations
4. Memory optimization for sparse grids
5. Performance benchmarking

### Phase 6: Advanced Features
1. Smart insert (detect patterns and copy)
2. Insert/delete with format preservation
3. Undo/redo for structural changes
4. Conflict resolution for concurrent edits
5. Import/export with structure preservation

## Edge Cases and Error Handling

### Deletion Warnings
```typescript
interface DeletionWarning {
  type: "formulaReference" | "namedRange" | "dataLoss";
  message: string;
  affectedCells: CellAddress[];
}

class DeletionAnalyzer {
  analyze(rows: number[]): DeletionWarning[] {
    const warnings: DeletionWarning[] = [];
    
    // Check formula references
    const formulas = this.engine.getAllFormulas();
    formulas.forEach(({ address, formula }) => {
      const refs = this.extractReferences(formula);
      const affected = refs.filter(ref => 
        rows.includes(ref.row)
      );
      
      if (affected.length > 0) {
        warnings.push({
          type: "formulaReference",
          message: `Cell ${address} references deleted cells`,
          affectedCells: affected
        });
      }
    });
    
    return warnings;
  }
}
```

### Circular Reference Prevention
```typescript
class CircularReferenceDetector {
  checkAfterStructuralChange(change: StructuralChange): boolean {
    // Re-evaluate dependency graph after insert/delete
    const graph = this.buildDependencyGraph();
    return this.hasCycles(graph);
  }
}
```

## Testing Strategy

### Unit Tests
- Reference update algorithms
- Formula parsing and rewriting
- Data shifting logic
- Undo/redo command execution

### Integration Tests
- Insert row → update formulas → calculate
- Delete column → handle #REF! → undo
- Bulk operations → performance validation
- Complex formula updates (VLOOKUP, etc.)

### Stress Tests
- Insert 10,000 rows
- Delete 50% of columns randomly
- Rapid insert/delete/undo sequences
- Memory usage under heavy operations

## Performance Optimization

### Lazy Formula Updates
```typescript
class LazyFormulaUpdater {
  private pendingUpdates: Map<string, StructuralChange[]> = new Map();
  
  scheduleUpdate(cellAddress: string, change: StructuralChange): void {
    if (!this.pendingUpdates.has(cellAddress)) {
      this.pendingUpdates.set(cellAddress, []);
    }
    this.pendingUpdates.get(cellAddress)!.push(change);
  }
  
  flushUpdates(): void {
    this.pendingUpdates.forEach((changes, address) => {
      const cell = this.engine.getCell(address);
      if (cell?.formula) {
        const updatedFormula = this.applyChanges(cell.formula, changes);
        this.engine.setFormula(address, updatedFormula);
      }
    });
    this.pendingUpdates.clear();
  }
}
```

### Batched Operations
```typescript
class BatchedStructuralChanges {
  private changes: StructuralChange[] = [];
  
  addInsertRows(row: number, count: number): void {
    this.changes.push({ type: "insertRow", index: row, count });
  }
  
  execute(): void {
    // Sort changes to apply in correct order
    const sorted = this.sortChangesForExecution(this.changes);
    
    // Apply all changes in single transaction
    this.engine.beginTransaction();
    try {
      sorted.forEach(change => this.applyChange(change));
      this.engine.commitTransaction();
    } catch (e) {
      this.engine.rollbackTransaction();
      throw e;
    }
  }
}
```

## Success Metrics

1. **Performance**: Insert/delete 1000 rows < 100ms
2. **Correctness**: Zero formula corruption after operations
3. **Usability**: Intuitive vim commands with visual feedback
4. **Reliability**: 100% undo/redo success rate
5. **Scalability**: Handle 1M+ row spreadsheets

## Future Considerations

1. **Collaborative Editing**: Conflict resolution for simultaneous structural changes
2. **Smart Operations**: AI-powered insert predictions
3. **Template System**: Insert pre-formatted row/column templates
4. **API Access**: Programmatic insert/delete via plugins
5. **History Tracking**: Detailed audit log of structural changes