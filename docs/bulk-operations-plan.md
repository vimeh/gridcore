# Bulk Cell Operations Plan

## Executive Summary

This document outlines a comprehensive plan for implementing bulk operations on cells in gridcore. Bulk operations enable users to efficiently update, format, and manipulate multiple cells simultaneously, significantly improving productivity for large-scale data manipulation tasks. This plan builds upon the completed ui-core refactoring.

## Current State

### Completed UI-Core Architecture
- ✅ UIState with discriminated unions for different modes
- ✅ SpreadsheetController coordinating all behaviors
- ✅ VimBehavior with command parsing and execution
- ✅ UIStateMachine for state transitions
- ✅ Command mode infrastructure for complex operations

### Gaps to Fill
- Single cell editing only
- No find and replace functionality
- No bulk formatting capabilities
- Limited copy/paste operations
- No batch update mechanisms

## Requirements

### Functional Requirements

1. **Find and Replace**
   - Find text/values across entire sheet or selection
   - Replace with text, formulas, or values
   - Support regex patterns
   - Case-sensitive/insensitive options
   - Preview changes before applying

2. **Bulk Value Updates**
   - Set multiple cells to same value
   - Apply mathematical operations (add, multiply, etc.)
   - Conditional updates based on current values
   - Fill patterns (series, dates, custom)

3. **Bulk Formatting**
   - Apply number formats to selections
   - Set cell styles (font, color, borders)
   - Conditional formatting rules
   - Clear formatting options

4. **Batch Operations**
   - Convert formulas to values
   - Transform text (uppercase, lowercase, trim)
   - Split/merge cell contents
   - Data validation rules

5. **Smart Fill Operations**
   - Auto-detect patterns
   - Fill series (numeric, date, custom)
   - Smart formula copying
   - Preserve relative references

### Non-Functional Requirements

- Performance: Update 100,000 cells in < 1 second
- Memory: Efficient handling of large selections
- Atomicity: All-or-nothing operation execution
- Undo: Single undo for entire bulk operation

## Architecture Design

### Core Domain Model

```typescript
// In @gridcore/core
interface BulkOperation {
  type: string;
  selection: Selection;
  options: Record<string, any>;
  preview(): OperationPreview;
  execute(): OperationResult;
  estimateTime(): number;
}

interface OperationPreview {
  affectedCells: number;
  changes: Map<CellAddress, CellChange>;
  warnings: string[];
}

interface CellChange {
  before: CellValue;
  after: CellValue;
  formula?: string;
}

interface SpreadsheetEngine {
  // Bulk operations
  bulkUpdate(operation: BulkOperation): OperationResult;
  findAndReplace(options: FindReplaceOptions): OperationResult;
  fillSeries(start: CellAddress, end: CellAddress, pattern: FillPattern): void;
  applyToSelection(selection: Selection, fn: (cell: Cell) => Cell): void;
  
  // Batch processing
  beginBatch(): BatchContext;
  commitBatch(context: BatchContext): void;
  rollbackBatch(context: BatchContext): void;
}
```

### Operation Types

```typescript
// Find and Replace
interface FindReplaceOperation extends BulkOperation {
  type: "findReplace";
  findPattern: string | RegExp;
  replaceWith: string;
  options: {
    caseSensitive: boolean;
    wholeCell: boolean;
    searchFormulas: boolean;
    useRegex: boolean;
  };
}

// Bulk Value Update
interface BulkValueOperation extends BulkOperation {
  type: "bulkValue";
  operation: 
    | { type: "set"; value: CellValue }
    | { type: "add"; value: number }
    | { type: "multiply"; value: number }
    | { type: "formula"; formula: string }
    | { type: "transform"; fn: (value: CellValue) => CellValue };
}

// Fill Series
interface FillSeriesOperation extends BulkOperation {
  type: "fillSeries";
  pattern: 
    | { type: "linear"; start: number; step: number }
    | { type: "growth"; start: number; multiplier: number }
    | { type: "date"; start: Date; increment: Duration }
    | { type: "custom"; values: CellValue[] }
    | { type: "auto"; samples: CellValue[] }; // Auto-detect pattern
}

// Bulk Format
interface BulkFormatOperation extends BulkOperation {
  type: "bulkFormat";
  format: {
    numberFormat?: string;
    font?: FontStyle;
    fill?: FillStyle;
    borders?: BorderStyle;
    alignment?: AlignmentStyle;
  };
}
```

### Pattern Detection Engine

```typescript
class PatternDetector {
  detectPattern(samples: CellValue[]): FillPattern | null {
    // Try different pattern types
    const patterns = [
      this.detectLinearPattern,
      this.detectGrowthPattern,
      this.detectDatePattern,
      this.detectTextPattern,
      this.detectCustomPattern
    ];
    
    for (const detector of patterns) {
      const pattern = detector(samples);
      if (pattern && pattern.confidence > 0.8) {
        return pattern;
      }
    }
    
    return null;
  }
  
  private detectLinearPattern(samples: number[]): LinearPattern | null {
    if (samples.length < 2) return null;
    
    const differences = [];
    for (let i = 1; i < samples.length; i++) {
      differences.push(samples[i] - samples[i-1]);
    }
    
    // Check if differences are constant
    const avgDiff = differences.reduce((a, b) => a + b) / differences.length;
    const variance = differences.reduce((sum, diff) => 
      sum + Math.pow(diff - avgDiff, 2), 0
    ) / differences.length;
    
    if (variance < 0.01) {
      return {
        type: "linear",
        start: samples[0],
        step: avgDiff,
        confidence: 1 - variance
      };
    }
    
    return null;
  }
  
  private detectDatePattern(samples: string[]): DatePattern | null {
    const dates = samples.map(s => new Date(s)).filter(d => !isNaN(d.getTime()));
    if (dates.length < 2) return null;
    
    // Check for consistent intervals
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(dates[i].getTime() - dates[i-1].getTime());
    }
    
    // Detect common intervals (daily, weekly, monthly)
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const DAY = 24 * 60 * 60 * 1000;
    
    if (Math.abs(avgInterval - DAY) < DAY * 0.1) {
      return {
        type: "date",
        start: dates[0],
        increment: { days: 1 },
        confidence: 0.95
      };
    }
    
    // Check for monthly pattern
    // ... more pattern detection logic
    
    return null;
  }
}
```

### Batch Processing System

```typescript
class BatchProcessor {
  private operations: BulkOperation[] = [];
  private affectedCells: Set<string> = new Set();
  private originalValues: Map<string, CellValue> = new Map();
  
  addOperation(operation: BulkOperation): void {
    // Check for conflicts
    const preview = operation.preview();
    for (const [address] of preview.changes) {
      const key = `${address.row},${address.col}`;
      if (this.affectedCells.has(key)) {
        throw new Error(`Cell ${key} already affected by another operation`);
      }
    }
    
    this.operations.push(operation);
    preview.changes.forEach((change, address) => {
      const key = `${address.row},${address.col}`;
      this.affectedCells.add(key);
      if (!this.originalValues.has(key)) {
        this.originalValues.set(key, change.before);
      }
    });
  }
  
  execute(): BatchResult {
    const results: OperationResult[] = [];
    
    try {
      // Execute all operations
      for (const operation of this.operations) {
        results.push(operation.execute());
      }
      
      return {
        success: true,
        operationCount: this.operations.length,
        cellsModified: this.affectedCells.size,
        results
      };
    } catch (error) {
      // Rollback on error
      this.rollback();
      throw error;
    }
  }
  
  private rollback(): void {
    // Restore original values
    this.originalValues.forEach((value, key) => {
      const [row, col] = key.split(',').map(Number);
      this.engine.setCellValue({ row, col }, value);
    });
  }
}
```

### Integration with Command Mode

Since command mode already exists in UIState, we'll leverage it for bulk operations:

```typescript
// Extend command mode to handle bulk operations
interface CommandParser {
  parse(command: string): BulkCommand | null;
}

class BulkCommandParser implements CommandParser {
  private patterns = {
    // Find and replace: :s/pattern/replacement/flags
    findReplace: /^:(%?)s\/(.+?)\/(.+?)\/([gi]*)$/,
    // Bulk set: :set value
    bulkSet: /^:set\s+(.+)$/,
    // Math operations: :add 10, :mul 2
    mathOp: /^:(add|sub|mul|div)\s+(-?\d+\.?\d*)$/,
    // Fill operations: :fill down, :fill series
    fill: /^:fill\s+(down|up|left|right|series)$/,
    // Transform: :upper, :lower, :trim
    transform: /^:(upper|lower|trim|clean)$/,
    // Format: :format currency, :format percent
    format: /^:format\s+(\w+)$/,
  };
  
  parse(command: string): BulkCommand | null {
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const match = command.match(pattern);
      if (match) {
        return this.createCommand(type, match);
      }
    }
    return null;
  }
}

// Extend SpreadsheetController to handle bulk operations
export class BulkOperationHandler {
  constructor(
    private controller: SpreadsheetController,
    private engine: SpreadsheetEngine
  ) {}
  
  handleCommand(state: UIState): Result<UIState> {
    if (!isCommandMode(state)) {
      return { ok: false, error: "Not in command mode" };
    }
    
    const command = this.parser.parse(state.commandValue);
    if (!command) {
      return { ok: false, error: "Invalid command" };
    }
    
    // Execute bulk operation
    const selection = this.getSelectionFromState(state);
    const operation = this.createOperation(command, selection);
    
    // Show preview or execute immediately based on command
    if (command.requiresPreview) {
      return this.showPreview(state, operation);
    } else {
      return this.execute(state, operation);
    }
  }
}
```

### UI Components

```typescript
// Find and Replace Dialog
interface FindReplaceDialog {
  show(): void;
  onFind: (pattern: string, options: FindOptions) => void;
  onReplace: (pattern: string, replacement: string, options: ReplaceOptions) => void;
  onReplaceAll: (pattern: string, replacement: string, options: ReplaceOptions) => void;
  showPreview(preview: OperationPreview): void;
}

// Bulk Operation Progress
interface BulkOperationProgress {
  show(title: string, total: number): void;
  update(current: number): void;
  setMessage(message: string): void;
  close(): void;
}

// Operation Preview Component
interface OperationPreviewComponent {
  show(preview: OperationPreview): void;
  onConfirm: () => void;
  onCancel: () => void;
  highlightChanges(changes: Map<CellAddress, CellChange>): void;
}
```

## Implementation Phases

### Phase 1: Extend Command Mode Infrastructure
1. Create BulkCommandParser for command mode
2. Integrate with existing SpreadsheetController
3. Add bulk operation state to UIStateMachine
4. Extend command mode autocomplete
5. Write unit tests for command parsing

### Phase 2: Core Bulk Operation Framework
1. Design BulkOperation interface and base classes
2. Implement BatchProcessor with transaction support
3. Create operation preview system
4. Add undo/redo support for bulk operations
5. Write unit tests for core operations

### Phase 3: Find and Replace
1. Implement find algorithm with regex support
2. Create replace logic with preview
3. Add command mode syntax (vim-style :s//)
4. Integrate with existing command infrastructure
5. Test edge cases and performance

### Phase 4: Fill Operations
1. Implement PatternDetector for auto-detection
2. Create fill algorithms for each pattern type
3. Add smart fill with formula adjustment
4. Implement fill direction commands
5. Test pattern detection accuracy

### Phase 5: Bulk Updates & Transforms
1. Implement value transformation operations
2. Add mathematical operations
3. Create conditional update logic
4. Implement format operations
5. Performance optimization

### Phase 6: UI Polish
1. Create progress indicators
2. Implement operation preview
3. Enhance command mode UI for bulk ops
4. Create visual feedback
5. Cross-platform testing

## Performance Optimization

### Lazy Evaluation
```typescript
class LazyBulkOperation implements BulkOperation {
  private generator: Generator<CellChange>;
  
  constructor(
    private selection: Selection,
    private transform: (cell: Cell) => Cell
  ) {
    this.generator = this.createGenerator();
  }
  
  private *createGenerator(): Generator<CellChange> {
    for (const address of this.selection) {
      const cell = this.engine.getCell(address);
      const newCell = this.transform(cell);
      yield {
        address,
        before: cell.value,
        after: newCell.value
      };
    }
  }
  
  preview(limit: number = 100): OperationPreview {
    const changes = new Map<CellAddress, CellChange>();
    let count = 0;
    
    for (const change of this.generator) {
      changes.set(change.address, change);
      if (++count >= limit) break;
    }
    
    return {
      affectedCells: this.selection.count(),
      changes,
      warnings: []
    };
  }
}
```

### Parallel Processing
```typescript
class ParallelBulkProcessor {
  async execute(operation: BulkOperation): Promise<OperationResult> {
    const chunks = this.chunkSelection(operation.selection, 1000);
    const workers = new Array(navigator.hardwareConcurrency || 4);
    
    // Process chunks in parallel
    const results = await Promise.all(
      chunks.map((chunk, i) => 
        this.processChunk(chunk, operation, workers[i % workers.length])
      )
    );
    
    return this.mergeResults(results);
  }
  
  private chunkSelection(selection: Selection, size: number): Selection[] {
    // Divide selection into chunks for parallel processing
    // ...
  }
}
```

## Testing Strategy

### Unit Tests
- Pattern detection algorithms
- Bulk operation execution
- Transaction rollback
- Formula reference updates
- Performance benchmarks

### Integration Tests
- Find and replace workflows
- Fill series operations
- Bulk format application
- Undo/redo of bulk operations
- Cross-operation conflicts

### Performance Tests
- 100K cell updates
- Complex regex patterns
- Large fill operations
- Memory usage monitoring
- UI responsiveness

## Success Metrics

1. **Performance**: Update 100K cells in < 1 second
2. **Accuracy**: 99%+ pattern detection accuracy
3. **Usability**: < 3 clicks for common operations
4. **Reliability**: Zero data corruption
5. **Efficiency**: 10x faster than cell-by-cell updates

## Future Enhancements

1. **AI-Powered Operations**: ML-based pattern detection
2. **Macro Recording**: Record and replay bulk operations
3. **Cloud Processing**: Offload large operations to server
4. **Custom Scripts**: User-defined bulk operations
5. **Data Import/Export**: Bulk operations during import