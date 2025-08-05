# Absolute and Relative Cell References Plan

## Executive Summary

This document outlines a comprehensive plan for implementing absolute and relative cell references in gridcore using the dollar sign ($) notation. This fundamental spreadsheet feature enables users to control how cell references behave when formulas are copied, moved, or filled across cells. This plan builds upon the completed ui-core refactoring.

## Current State

### Completed UI-Core Architecture
- ✅ CellVimBehavior for cell-level editing
- ✅ SpreadsheetController managing all behaviors
- ✅ Formula bar integration in editing mode
- ✅ Cursor position tracking within cells
- ✅ Edit mode state management

### Gaps to Fill
- All cell references are relative (e.g., A1, B2)
- No support for absolute references ($A$1)
- No mixed references ($A1 or A$1)
- Formula copying doesn't adjust references properly
- No visual indicators for reference types

## Requirements

### Functional Requirements

1. **Reference Types**
   - Relative: A1 (both row and column adjust)
   - Absolute: $A$1 (neither row nor column adjust)
   - Mixed Column: $A1 (column fixed, row adjusts)
   - Mixed Row: A$1 (row fixed, column adjusts)

2. **Reference Behavior**
   - Correct adjustment when copying formulas
   - Proper handling during fill operations
   - Maintain reference types during cut/paste
   - Support in all formula contexts

3. **User Interface**
   - F4 key to cycle through reference types
   - Visual indicators in formula bar
   - Syntax highlighting for reference types
   - Reference preview during editing

4. **Advanced Features**
   - Range references with mixed types ($A$1:B2)
   - Named ranges with absolute behavior
   - Structured references for tables
   - R1C1 notation support

### Non-Functional Requirements

- Performance: No noticeable slowdown in formula evaluation
- Compatibility: Excel-compatible reference behavior
- Usability: Intuitive reference type toggling
- Accuracy: 100% correct reference adjustment

## Architecture Design

### Core Reference Model

```typescript
// In @gridcore/core
interface CellReference {
  column: number;
  row: number;
  columnAbsolute: boolean;
  rowAbsolute: boolean;
  sheet?: string;
  sheetAbsolute?: boolean;
}

interface RangeReference {
  start: CellReference;
  end: CellReference;
}

// Reference parser
class ReferenceParser {
  parse(reference: string): CellReference | RangeReference {
    // Handle patterns like:
    // A1, $A$1, $A1, A$1
    // Sheet1!A1, 'Sheet 1'!$A$1
    // A1:B2, $A$1:B2, A:A, 1:1
    const match = reference.match(
      /^(?:(.+)!)?(\$?)([A-Z]+)(\$?)(\d+)$/i
    );
    
    if (!match) {
      throw new Error(`Invalid reference: ${reference}`);
    }
    
    const [, sheet, colAbs, col, rowAbs, row] = match;
    
    return {
      sheet,
      column: this.columnToNumber(col),
      row: parseInt(row) - 1,
      columnAbsolute: colAbs === '$',
      rowAbsolute: rowAbs === '$'
    };
  }
  
  stringify(ref: CellReference): string {
    const col = this.numberToColumn(ref.column);
    const row = ref.row + 1;
    const colPrefix = ref.columnAbsolute ? '$' : '';
    const rowPrefix = ref.rowAbsolute ? '$' : '';
    const sheetPrefix = ref.sheet ? `${ref.sheet}!` : '';
    
    return `${sheetPrefix}${colPrefix}${col}${rowPrefix}${row}`;
  }
}
```

### Reference Adjustment Engine

```typescript
class ReferenceAdjuster {
  // Adjust reference when copying from source to target
  adjustForCopy(
    ref: CellReference,
    source: CellAddress,
    target: CellAddress
  ): CellReference {
    const colDelta = target.col - source.col;
    const rowDelta = target.row - source.row;
    
    return {
      ...ref,
      column: ref.columnAbsolute ? ref.column : ref.column + colDelta,
      row: ref.rowAbsolute ? ref.row : ref.row + rowDelta
    };
  }
  
  // Adjust reference for fill operation
  adjustForFill(
    ref: CellReference,
    fillStart: CellAddress,
    fillTarget: CellAddress,
    fillDirection: 'down' | 'right' | 'up' | 'left'
  ): CellReference {
    let colDelta = 0;
    let rowDelta = 0;
    
    switch (fillDirection) {
      case 'down':
        rowDelta = fillTarget.row - fillStart.row;
        break;
      case 'right':
        colDelta = fillTarget.col - fillStart.col;
        break;
      case 'up':
        rowDelta = fillTarget.row - fillStart.row;
        break;
      case 'left':
        colDelta = fillTarget.col - fillStart.col;
        break;
    }
    
    return {
      ...ref,
      column: ref.columnAbsolute ? ref.column : ref.column + colDelta,
      row: ref.rowAbsolute ? ref.row : ref.row + rowDelta
    };
  }
  
  // Cycle through reference types (F4 behavior)
  cycleReferenceType(ref: CellReference): CellReference {
    // Cycle: A1 -> $A$1 -> A$1 -> $A1 -> A1
    if (!ref.columnAbsolute && !ref.rowAbsolute) {
      return { ...ref, columnAbsolute: true, rowAbsolute: true };
    } else if (ref.columnAbsolute && ref.rowAbsolute) {
      return { ...ref, columnAbsolute: false, rowAbsolute: true };
    } else if (!ref.columnAbsolute && ref.rowAbsolute) {
      return { ...ref, columnAbsolute: true, rowAbsolute: false };
    } else {
      return { ...ref, columnAbsolute: false, rowAbsolute: false };
    }
  }
}
```

### Formula Transformer

```typescript
class FormulaTransformer {
  private parser: FormulaParser;
  private adjuster: ReferenceAdjuster;
  
  transformFormula(
    formula: string,
    source: CellAddress,
    target: CellAddress
  ): string {
    const ast = this.parser.parse(formula);
    const transformed = this.transformAST(ast, source, target);
    return this.parser.stringify(transformed);
  }
  
  private transformAST(
    node: ASTNode,
    source: CellAddress,
    target: CellAddress
  ): ASTNode {
    if (node.type === 'CellReference') {
      const ref = this.parseReference(node.value);
      const adjusted = this.adjuster.adjustForCopy(ref, source, target);
      return {
        ...node,
        value: this.stringifyReference(adjusted)
      };
    }
    
    if (node.type === 'RangeReference') {
      const range = this.parseRangeReference(node.value);
      const adjustedStart = this.adjuster.adjustForCopy(
        range.start, source, target
      );
      const adjustedEnd = this.adjuster.adjustForCopy(
        range.end, source, target
      );
      return {
        ...node,
        value: `${this.stringifyReference(adjustedStart)}:${
          this.stringifyReference(adjustedEnd)
        }`
      };
    }
    
    // Recursively transform child nodes
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => 
          this.transformAST(child, source, target)
        )
      };
    }
    
    return node;
  }
}
```

### Reference Type Detection

```typescript
class ReferenceTypeDetector {
  // Analyze formula to find all references and their types
  analyzeFormula(formula: string): ReferenceAnalysis {
    const references: ReferenceInfo[] = [];
    const pattern = /(\$?)([A-Z]+)(\$?)(\d+)/gi;
    let match;
    
    while ((match = pattern.exec(formula)) !== null) {
      const [fullMatch, colAbs, col, rowAbs, row] = match;
      references.push({
        text: fullMatch,
        position: match.index,
        length: fullMatch.length,
        type: this.getReferenceType(colAbs === '$', rowAbs === '$'),
        reference: {
          column: this.columnToNumber(col),
          row: parseInt(row) - 1,
          columnAbsolute: colAbs === '$',
          rowAbsolute: rowAbs === '$'
        }
      });
    }
    
    return { references };
  }
  
  private getReferenceType(colAbs: boolean, rowAbs: boolean): string {
    if (colAbs && rowAbs) return 'absolute';
    if (!colAbs && !rowAbs) return 'relative';
    if (colAbs && !rowAbs) return 'mixed-column';
    return 'mixed-row';
  }
}
```

### Integration with CellVimBehavior

```typescript
// Extend CellVimBehavior to handle F4 reference cycling
export class ReferenceToggleExtension {
  constructor(
    private cellVimBehavior: CellVimBehavior,
    private referenceDetector: ReferenceTypeDetector,
    private referenceAdjuster: ReferenceAdjuster
  ) {}
  
  handleKeyPress(
    key: string,
    state: UIState
  ): VimAction | null {
    if (!isEditingMode(state) || key !== 'F4') {
      return null;
    }
    
    const { editingValue, cursorPosition } = state;
    const result = this.toggleReference(editingValue, cursorPosition);
    
    if (result.changed) {
      return {
        type: 'updateEditingValue',
        value: result.formula,
        cursorPosition: result.cursorPosition
      };
    }
    
    return null;
  }
  
  private toggleReference(
    formula: string,
    cursorPosition: number
  ): { formula: string; cursorPosition: number; changed: boolean } {
    const analysis = this.referenceDetector.analyzeFormula(formula);
    
    // Find reference at cursor position
    const ref = analysis.references.find(r => 
      cursorPosition >= r.position && 
      cursorPosition <= r.position + r.length
    );
    
    if (!ref) {
      return { formula, cursorPosition, changed: false };
    }
    
    // Cycle the reference type
    const cycled = this.referenceAdjuster.cycleReferenceType(ref.reference);
    const newRefText = this.stringifyReference(cycled);
    
    // Replace in formula
    const newFormula = 
      formula.substring(0, ref.position) +
      newRefText +
      formula.substring(ref.position + ref.length);
    
    // Adjust cursor position if needed
    const lengthDiff = newRefText.length - ref.text.length;
    const newCursor = cursorPosition + lengthDiff;
    
    return { 
      formula: newFormula, 
      cursorPosition: newCursor,
      changed: true
    };
  }
}

// Formula highlighting for editing mode
interface FormulaHighlighter {
  // Integrate with existing editing state
  getHighlights(state: UIState): ReferenceHighlight[] {
    if (!isEditingMode(state) || !state.editingValue.startsWith('=')) {
      return [];
    }
    
    const analysis = this.detector.analyzeFormula(state.editingValue);
    return analysis.references.map(ref => ({
      start: ref.position,
      end: ref.position + ref.length,
      type: ref.type,
      style: this.getStyleForType(ref.type),
      reference: ref.reference
    }));
  }
  
  private getStyleForType(type: string): HighlightStyle {
    switch (type) {
      case 'absolute':
        return { color: '#FF6B6B', fontWeight: 'bold' };
      case 'relative':
        return { color: '#4ECDC4' };
      case 'mixed-column':
        return { color: '#FFD93D' };
      case 'mixed-row':
        return { color: '#6BCF7F' };
    }
  }
}
```

### Fill Operation Integration

```typescript
class SmartFillEngine {
  fillFormulas(
    sourceCell: Cell,
    targetRange: CellRange,
    direction: FillDirection
  ): Map<CellAddress, string> {
    const results = new Map<CellAddress, string>();
    
    if (!sourceCell.formula) {
      // Simple value fill
      targetRange.forEach(address => {
        results.set(address, sourceCell.value);
      });
      return results;
    }
    
    // Formula fill with reference adjustment
    targetRange.forEach(targetAddress => {
      const transformedFormula = this.transformer.transformFormula(
        sourceCell.formula,
        sourceCell.address,
        targetAddress
      );
      results.set(targetAddress, transformedFormula);
    });
    
    return results;
  }
  
  // Handle special cases like filling A1, A2, A3...
  detectAndFillPattern(
    cells: Cell[],
    targetRange: CellRange
  ): Map<CellAddress, string> {
    // Detect if cells contain a pattern with references
    const pattern = this.detectReferencePattern(cells);
    
    if (pattern) {
      return this.fillWithPattern(pattern, targetRange);
    }
    
    // Fall back to standard fill
    return this.fillFormulas(cells[cells.length - 1], targetRange, 'down');
  }
}
```

## Implementation Phases

### Phase 1: Core Reference Model
1. Implement CellReference and RangeReference types in @gridcore/core
2. Create ReferenceParser with full pattern support
3. Build ReferenceAdjuster for copy/paste operations
4. Add reference type detection
5. Write comprehensive unit tests

### Phase 2: CellVimBehavior Integration
1. Create ReferenceToggleExtension for F4 handling
2. Add reference navigation commands to CellVimBehavior
3. Implement reference text objects (ir, ar)
4. Integrate with existing cursor movement
5. Test within editing mode

### Phase 3: Formula Integration
1. Update FormulaParser to handle absolute references
2. Implement FormulaTransformer for reference adjustment
3. Integrate with existing formula evaluation
4. Add reference validation
5. Test complex formula scenarios

### Phase 4: UI Enhancements
1. Implement FormulaHighlighter for editing mode
2. Add reference highlighting with distinct colors
3. Create visual indicators in both TUI and Web UI
4. Add reference tooltips on hover (Web UI)
5. Cross-platform UI testing

### Phase 5: Command Mode Integration
1. Add bulk reference commands to command parser
2. Implement :refrel, :refabs, :refmix commands
3. Support for selection-based operations
4. Add command autocomplete
5. Test command mode workflows

### Phase 6: Fill Operations
1. Integrate with fill/extend operations
2. Implement smart pattern detection
3. Handle edge cases (boundaries, errors)
4. Optimize for large fills
5. Test fill accuracy

## Integration with Existing Vim Commands

```typescript
// Extend CellVimBehavior with reference-specific commands
const referenceCommands = {
  // F4 handled specially outside normal vim command flow
  // These commands work in normal mode within cell editing
  
  // Reference navigation (in cell normal mode)
  '[r': { 
    action: 'prevReference', 
    description: 'Go to previous reference',
    handler: (state: UIState) => {
      const refs = this.findReferences(state.editingValue);
      const prevRef = this.findPrevReference(refs, state.cursorPosition);
      return prevRef ? { type: 'moveCursor', position: prevRef.start } : null;
    }
  },
  ']r': { 
    action: 'nextReference', 
    description: 'Go to next reference',
    handler: (state: UIState) => {
      const refs = this.findReferences(state.editingValue);
      const nextRef = this.findNextReference(refs, state.cursorPosition);
      return nextRef ? { type: 'moveCursor', position: nextRef.start } : null;
    }
  },
  
  // Reference text objects (for use with operators)
  'ir': { 
    action: 'innerReference', 
    description: 'Inner reference text object',
    textObject: true 
  },
  'ar': { 
    action: 'aReference', 
    description: 'A reference text object',
    textObject: true 
  },
};

// Command mode operations for bulk reference changes
const bulkReferenceCommands = {
  ':refrel': { 
    action: 'makeAllRelative', 
    description: 'Make all references in selection relative' 
  },
  ':refabs': { 
    action: 'makeAllAbsolute', 
    description: 'Make all references in selection absolute' 
  },
  ':refmix': { 
    action: 'makeAllMixed', 
    description: 'Make all references mixed ($A1 style)' 
  },
};
```

## Testing Strategy

### Unit Tests
- Reference parsing for all formats
- Reference adjustment algorithms
- F4 cycling behavior
- Formula transformation
- Edge cases (A1, XFD1048576)

### Integration Tests
- Copy formulas with mixed references
- Fill operations with absolute references
- Undo/redo reference changes
- Cross-sheet references
- Named range behavior

### Compatibility Tests
- Excel parity for reference behavior
- CSV import/export with references
- Formula bar editing
- Keyboard shortcuts across platforms

## Performance Optimization

### Reference Caching
```typescript
class ReferenceCache {
  private cache = new Map<string, CellReference>();
  
  parse(reference: string): CellReference {
    if (this.cache.has(reference)) {
      return this.cache.get(reference)!;
    }
    
    const parsed = this.parser.parse(reference);
    this.cache.set(reference, parsed);
    return parsed;
  }
  
  // Clear cache when sheet structure changes
  invalidate(): void {
    this.cache.clear();
  }
}
```

### Batch Reference Updates
```typescript
class BatchReferenceUpdater {
  updateFormulas(
    cells: Map<CellAddress, Cell>,
    transformation: (ref: CellReference) => CellReference
  ): Map<CellAddress, string> {
    const updates = new Map<CellAddress, string>();
    const batch = new FormulaBatch();
    
    cells.forEach((cell, address) => {
      if (cell.formula) {
        batch.add(address, cell.formula, transformation);
      }
    });
    
    return batch.process();
  }
}
```

## Success Metrics

1. **Accuracy**: 100% correct reference adjustment
2. **Performance**: < 1ms per formula transformation
3. **Compatibility**: Full Excel reference parity
4. **Usability**: F4 response time < 50ms
5. **Reliability**: Zero reference corruption bugs

## Future Enhancements

1. **3D References**: Support for multi-sheet references
2. **Dynamic Arrays**: Spill references (#) support
3. **Table References**: Structured reference syntax
4. **Reference Auditing**: Trace precedents/dependents
5. **Smart References**: AI-suggested reference fixes