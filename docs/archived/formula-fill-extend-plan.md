# Formula Fill and Extend Operations Plan

## Executive Summary

This document outlines a comprehensive plan for implementing formula fill and extend operations in gridcore. This feature allows users to quickly copy formulas across ranges of cells with intelligent reference adjustment, pattern detection, and series generation - a cornerstone of spreadsheet productivity. This plan builds upon the completed ui-core refactoring.

## Current State

### Completed UI-Core Architecture
- ✅ SpreadsheetController managing all operations
- ✅ VimBehavior for keyboard-driven operations
- ✅ Selection management infrastructure
- ✅ Copy/paste foundation in place
- ✅ Formula evaluation engine

### Gaps to Fill
- No fill handle or drag-to-fill functionality
- Manual formula copying only
- No pattern detection for series
- No smart fill capabilities
- Basic copy/paste without intelligence

## Requirements

### Functional Requirements

1. **Fill Handle UI**
   - Visual fill handle indicator
   - Drag to extend formulas/values
   - Double-click to auto-fill
   - Keyboard shortcuts for fill operations

2. **Formula Extension**
   - Adjust relative references correctly
   - Preserve absolute references
   - Handle mixed references properly
   - Maintain formula structure

3. **Pattern Detection**
   - Numeric series (1, 2, 3...)
   - Date series (Mon, Tue, Wed...)
   - Custom lists (Q1, Q2, Q3...)
   - Growth patterns (2, 4, 8...)

4. **Smart Fill**
   - Detect and continue patterns
   - Fill formulas with reference adjustment
   - Fill formats without values
   - Fill values without formulas

5. **Fill Options**
   - Fill down/up/left/right
   - Fill series vs copy cells
   - Fill weekdays only
   - Custom fill series

### Non-Functional Requirements

- Performance: Fill 10,000 cells in < 200ms
- Accuracy: 100% correct reference adjustment
- Intelligence: 90%+ pattern detection accuracy
- Usability: Single gesture for common fills

## Architecture Design

### Core Fill Engine

```typescript
// In @gridcore/core
interface FillOperation {
  source: CellRange;
  target: CellRange;
  direction: FillDirection;
  options: FillOptions;
}

interface FillOptions {
  type: 'copy' | 'series' | 'format' | 'values';
  seriesType?: 'linear' | 'growth' | 'date' | 'auto';
  step?: number;
  stopValue?: number;
  weekdaysOnly?: boolean;
  trend?: boolean;
}

enum FillDirection {
  Down = 'down',
  Up = 'up',
  Left = 'left',
  Right = 'right',
  Auto = 'auto' // Detect from selection
}

interface FillEngine {
  // Core fill operations
  fill(operation: FillOperation): FillResult;
  autoFill(source: CellRange, direction: FillDirection): FillResult;
  fillSeries(start: CellValue, end: CellValue, target: CellRange): FillResult;
  
  // Pattern detection
  detectPattern(cells: Cell[]): Pattern | null;
  suggestFillOptions(source: CellRange): FillOptions[];
  
  // Preview
  previewFill(operation: FillOperation): CellValue[];
}
```

### Pattern Detection System

```typescript
interface Pattern {
  type: PatternType;
  confidence: number;
  generator: PatternGenerator;
}

enum PatternType {
  NumericLinear = 'numeric-linear',
  NumericGrowth = 'numeric-growth',
  DateSeries = 'date-series',
  WeekdaySeries = 'weekday-series',
  MonthSeries = 'month-series',
  TextPattern = 'text-pattern',
  CustomList = 'custom-list',
  FormulaPattern = 'formula-pattern'
}

abstract class PatternGenerator {
  abstract generate(index: number): CellValue;
  abstract canGenerate(count: number): boolean;
}

class NumericLinearPattern extends PatternGenerator {
  constructor(
    private start: number,
    private step: number
  ) {
    super();
  }
  
  generate(index: number): CellValue {
    return this.start + (this.step * index);
  }
  
  canGenerate(count: number): boolean {
    return true; // Linear patterns can generate indefinitely
  }
}

class DateSeriesPattern extends PatternGenerator {
  constructor(
    private start: Date,
    private increment: Duration,
    private options: DateSeriesOptions
  ) {
    super();
  }
  
  generate(index: number): CellValue {
    const date = new Date(this.start);
    
    if (this.options.weekdaysOnly) {
      let daysAdded = 0;
      let currentIndex = 0;
      
      while (currentIndex < index) {
        date.setDate(date.getDate() + 1);
        if (this.isWeekday(date)) {
          currentIndex++;
        }
      }
    } else {
      // Simple date arithmetic
      switch (this.increment.unit) {
        case 'days':
          date.setDate(date.getDate() + (this.increment.value * index));
          break;
        case 'months':
          date.setMonth(date.getMonth() + (this.increment.value * index));
          break;
        case 'years':
          date.setFullYear(date.getFullYear() + (this.increment.value * index));
          break;
      }
    }
    
    return this.formatDate(date);
  }
  
  private isWeekday(date: Date): boolean {
    const day = date.getDay();
    return day !== 0 && day !== 6; // Not Sunday or Saturday
  }
}

class SmartPatternDetector {
  private detectors: PatternDetector[] = [
    new NumericPatternDetector(),
    new DatePatternDetector(),
    new TextPatternDetector(),
    new FormulaPatternDetector(),
    new CustomListDetector()
  ];
  
  detect(cells: Cell[]): Pattern | null {
    if (cells.length < 2) return null;
    
    // Try each detector
    const patterns = this.detectors
      .map(detector => detector.detect(cells))
      .filter(pattern => pattern !== null)
      .sort((a, b) => b!.confidence - a!.confidence);
    
    // Return highest confidence pattern
    return patterns[0] || null;
  }
  
  // Detect complex patterns like 1, 1, 2, 3, 5, 8 (Fibonacci)
  detectComplexPattern(values: number[]): Pattern | null {
    // Check for Fibonacci
    if (this.isFibonacci(values)) {
      return new FibonacciPattern(values[values.length - 2], values[values.length - 1]);
    }
    
    // Check for polynomial sequences
    const polynomial = this.detectPolynomial(values);
    if (polynomial) {
      return polynomial;
    }
    
    return null;
  }
}
```

### Formula Fill System

```typescript
class FormulaFillEngine {
  fillFormulas(
    sourceRange: CellRange,
    targetRange: CellRange,
    direction: FillDirection
  ): Map<CellAddress, Formula> {
    const results = new Map<CellAddress, Formula>();
    const sourceCells = this.getCells(sourceRange);
    
    // Detect pattern in source formulas
    const pattern = this.detectFormulaPattern(sourceCells);
    
    if (pattern) {
      // Use pattern to generate formulas
      this.fillWithPattern(pattern, targetRange, results);
    } else {
      // Simple reference adjustment
      this.fillWithAdjustment(sourceCells, targetRange, direction, results);
    }
    
    return results;
  }
  
  private detectFormulaPattern(cells: Cell[]): FormulaPattern | null {
    // Example: Detect SUM(A1:A2), SUM(A1:A3), SUM(A1:A4)
    const formulas = cells.map(c => c.formula).filter(f => f);
    if (formulas.length < 2) return null;
    
    // Parse formulas to AST
    const asts = formulas.map(f => this.parser.parse(f));
    
    // Check if they have same structure
    if (!this.haveSameStructure(asts)) return null;
    
    // Find changing references
    const changingRefs = this.findChangingReferences(asts);
    
    if (changingRefs.length > 0) {
      return new FormulaPattern(
        asts[0],
        changingRefs,
        this.detectReferencePattern(changingRefs)
      );
    }
    
    return null;
  }
  
  private fillWithAdjustment(
    sourceCells: Cell[],
    targetRange: CellRange,
    direction: FillDirection,
    results: Map<CellAddress, Formula>
  ): void {
    const sourceFormula = sourceCells[sourceCells.length - 1].formula;
    if (!sourceFormula) return;
    
    targetRange.forEach((targetAddress, index) => {
      const adjusted = this.adjustFormula(
        sourceFormula,
        sourceCells[sourceCells.length - 1].address,
        targetAddress,
        direction
      );
      results.set(targetAddress, adjusted);
    });
  }
}
```

### Fill Handle UI Component

```typescript
// UI components for fill handle
interface FillHandle {
  show(cell: CellAddress): void;
  hide(): void;
  onDragStart: (event: DragEvent) => void;
  onDrag: (event: DragEvent) => void;
  onDragEnd: (event: DragEvent) => void;
}

class CanvasFillHandle implements FillHandle {
  private isDragging = false;
  private startCell: CellAddress;
  private currentRange: CellRange;
  private previewValues: Map<CellAddress, CellValue>;
  
  show(cell: CellAddress): void {
    // Draw small square in bottom-right corner
    const rect = this.getCellRect(cell);
    this.ctx.fillStyle = '#0066CC';
    this.ctx.fillRect(
      rect.x + rect.width - 6,
      rect.y + rect.height - 6,
      6,
      6
    );
  }
  
  onDragStart(event: DragEvent): void {
    this.isDragging = true;
    this.startCell = this.getCellFromPoint(event.x, event.y);
    this.showFillPreview();
  }
  
  onDrag(event: DragEvent): void {
    if (!this.isDragging) return;
    
    const currentCell = this.getCellFromPoint(event.x, event.y);
    this.currentRange = this.getRangeFromStartToCurrent(
      this.startCell,
      currentCell
    );
    
    // Preview fill values
    this.previewValues = this.engine.previewFill({
      source: { start: this.startCell, end: this.startCell },
      target: this.currentRange,
      direction: this.detectDirection(),
      options: { type: 'auto' }
    });
    
    this.renderPreview();
  }
  
  private renderPreview(): void {
    // Show preview values in cells with different style
    this.previewValues.forEach((value, address) => {
      this.renderCell(address, value, { 
        opacity: 0.6,
        italic: true 
      });
    });
    
    // Show fill range outline
    this.drawRangeOutline(this.currentRange, {
      color: '#0066CC',
      width: 2,
      dashed: true
    });
  }
}
```

### Auto Fill Detection

```typescript
class AutoFillDetector {
  // Double-click fill handle to auto-fill
  detectAutoFillRange(
    source: CellRange,
    direction: FillDirection
  ): CellRange | null {
    // Find adjacent non-empty cells to determine fill range
    const adjacentData = this.findAdjacentData(source, direction);
    
    if (!adjacentData) return null;
    
    // Determine fill range based on adjacent data
    switch (direction) {
      case FillDirection.Down:
        return {
          start: { row: source.end.row + 1, col: source.start.col },
          end: { row: adjacentData.lastRow, col: source.end.col }
        };
      case FillDirection.Right:
        return {
          start: { row: source.start.row, col: source.end.col + 1 },
          end: { row: source.end.row, col: adjacentData.lastCol }
        };
      // ... other directions
    }
  }
  
  private findAdjacentData(
    source: CellRange,
    direction: FillDirection
  ): AdjacentData | null {
    // Look for columns/rows with data adjacent to source
    const checkColumn = direction === FillDirection.Down || 
                       direction === FillDirection.Up;
    
    if (checkColumn) {
      // Check columns to the left and right
      const leftCol = source.start.col - 1;
      const rightCol = source.end.col + 1;
      
      const leftData = this.getColumnDataRange(leftCol);
      const rightData = this.getColumnDataRange(rightCol);
      
      // Use the one with more data
      return leftData.count > rightData.count ? leftData : rightData;
    } else {
      // Check rows above and below
      // ... similar logic for rows
    }
  }
}
```

### Integration with VimBehavior

```typescript
// Extend VimBehavior with fill commands
const fillCommands = {
  // Basic fill operations (similar to Excel shortcuts)
  'Ctrl+d': { action: 'fillDown', description: 'Fill down' },
  'Ctrl+r': { action: 'fillRight', description: 'Fill right' },
  
  // Vim-style fill operations
  'gfd': { action: 'fillDownSeries', description: 'Fill down as series' },
  'gfu': { action: 'fillUp', description: 'Fill up' },
  'gfl': { action: 'fillLeft', description: 'Fill left' },
  'gfr': { action: 'fillRightSeries', description: 'Fill right as series' },
  'gff': { action: 'fillFormat', description: 'Fill format only' },
  'gfv': { action: 'fillValues', description: 'Fill values only' },
  
  // Auto fill
  'gfa': { action: 'autoFill', description: 'Auto-detect and fill' },
  'gfA': { action: 'autoFillToEnd', description: 'Auto-fill to data end' },
  
  // Double-click fill equivalent
  'gF': { action: 'smartFill', description: 'Smart fill to adjacent data' },
};

// Command mode operations
const fillCommandModeOps = {
  ':fill': { action: 'fillSeries', description: 'Fill with options' },
  ':fills': { action: 'fillSeries', description: 'Fill series with step' },
  ':filld': { action: 'fillDates', description: 'Fill date series' },
  ':fillw': { action: 'fillWeekdays', description: 'Fill weekdays only' },
};

// Fill state for UIStateMachine
type UIState =
  | {
      spreadsheetMode: "fill";
      cursor: CellAddress;
      viewport: ViewportInfo;
      fillSource: CellRange;
      fillTarget: CellRange;
      fillOptions: FillOptions;
      preview: Map<CellAddress, CellValue>;
    }
  | // ... existing states

// State transitions
const fillTransitions = {
  "navigation.START_FILL_DOWN": (state: UIState): UIState => {
    const source = getCurrentSelection(state);
    const target = calculateFillTarget(source, "down");
    return createFillState(state, source, target, { type: "copy" });
  },
  
  "fill.CONFIRM_FILL": (state: UIState): UIState => {
    // Execute fill operation via SpreadsheetController
    // Return to navigation mode
    return createNavigationState(state.cursor, state.viewport);
  },
  
  "fill.CANCEL_FILL": (state: UIState): UIState => {
    return createNavigationState(state.cursor, state.viewport);
  },
};
```

### Fill Options Menu

```typescript
interface FillOptionsMenu {
  show(anchor: Point): void;
  options: FillOption[];
  onSelect: (option: FillOption) => void;
}

interface FillOption {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

class SmartFillMenu implements FillOptionsMenu {
  options = [
    {
      id: 'copy',
      label: 'Copy Cells',
      icon: 'copy',
      shortcut: 'Ctrl+D',
      action: () => this.fill({ type: 'copy' })
    },
    {
      id: 'series',
      label: 'Fill Series',
      icon: 'series',
      action: () => this.fill({ type: 'series' })
    },
    {
      id: 'format',
      label: 'Fill Formatting Only',
      icon: 'format',
      action: () => this.fill({ type: 'format' })
    },
    {
      id: 'values',
      label: 'Fill Without Formatting',
      icon: 'values',
      action: () => this.fill({ type: 'values' })
    },
    {
      id: 'weekdays',
      label: 'Fill Weekdays',
      icon: 'calendar',
      action: () => this.fill({ type: 'series', weekdaysOnly: true })
    },
    {
      id: 'custom',
      label: 'Series...',
      icon: 'settings',
      action: () => this.showSeriesDialog()
    }
  ];
}
```

## Implementation Phases

### Phase 1: Extend UIState and VimBehavior
1. Add fill mode to UIState discriminated union
2. Create fill state factory functions
3. Add fill commands to VimBehavior
4. Implement fill transitions in UIStateMachine
5. Write unit tests for state transitions

### Phase 2: Core Fill Engine
1. Implement basic fill operations in SpreadsheetController
2. Create pattern detection framework
3. Build formula adjustment system
4. Add fill options structure
5. Write unit tests

### Phase 3: Pattern Detection
1. Implement numeric pattern detectors
2. Add date/time pattern detection
3. Create text pattern recognition
4. Build formula pattern detection
5. Test pattern accuracy

### Phase 4: Keyboard-Driven Fill
1. Implement vim fill commands (gfd, gfr, etc.)
2. Add smart fill detection (gF command)
3. Create fill preview in fill mode
4. Add command mode fill operations
5. Test keyboard workflows

### Phase 5: UI Implementation
1. Add fill handle to grid (Web UI)
2. Implement drag interactions
3. Create fill preview rendering
4. Sync with keyboard fill operations
5. Cross-platform testing

### Phase 6: Advanced Features
1. Implement auto-fill detection
2. Add custom series support
3. Integrate with command mode
4. Performance optimization
5. Fill history and undo/redo

## Testing Strategy

### Unit Tests
- Pattern detection accuracy
- Formula reference adjustment
- Fill algorithm correctness
- Edge case handling
- Performance benchmarks

### Integration Tests
- Drag to fill workflow
- Auto-fill detection
- Formula pattern continuation
- Undo/redo of fill operations
- Large range fills

### User Experience Tests
- Fill handle visibility
- Drag responsiveness
- Preview accuracy
- Options menu usability
- Keyboard shortcut efficiency

## Performance Optimization

### Lazy Fill Evaluation
```typescript
class LazyFillEvaluator {
  private generator: Generator<CellValue>;
  private cache = new Map<number, CellValue>();
  
  constructor(pattern: Pattern, count: number) {
    this.generator = this.createGenerator(pattern, count);
  }
  
  getValue(index: number): CellValue {
    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }
    
    // Generate values up to requested index
    while (this.cache.size <= index) {
      const { value, done } = this.generator.next();
      if (done) break;
      this.cache.set(this.cache.size, value);
    }
    
    return this.cache.get(index)!;
  }
}
```

### Viewport-Based Rendering
```typescript
class ViewportFillRenderer {
  renderFillPreview(
    fillRange: CellRange,
    values: Map<CellAddress, CellValue>
  ): void {
    // Only render visible cells
    const visibleRange = this.getVisibleRange();
    const intersection = this.intersectRanges(fillRange, visibleRange);
    
    intersection.forEach(address => {
      if (values.has(address)) {
        this.renderPreviewCell(address, values.get(address)!);
      }
    });
  }
}
```

## Success Metrics

1. **Performance**: Fill 10K cells in < 200ms
2. **Accuracy**: 95%+ pattern detection rate
3. **Usability**: < 2 seconds to fill common patterns
4. **Intelligence**: Correct auto-fill 90% of time
5. **Reliability**: Zero data corruption

## Future Enhancements

1. **AI-Powered Fill**: ML model for complex patterns
2. **Cloud Patterns**: Share custom fill patterns
3. **Fill Templates**: Saved fill operations
4. **Collaborative Fill**: Real-time multi-user fills
5. **Fill API**: Programmatic fill operations