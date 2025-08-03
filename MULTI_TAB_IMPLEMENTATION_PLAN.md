# Multiple Tabs Implementation Plan for GridCore

## Overview

This document outlines the plan to add multiple tab/sheet functionality to the GridCore spreadsheet application. Currently, the application supports only a single spreadsheet view. This enhancement will allow users to have multiple sheets within a single workbook, similar to Excel or Google Sheets.

## Current Architecture Analysis

### Core Components

1. **SpreadsheetEngine** (`packages/core/src/SpreadsheetEngine.ts`):

   - Central engine managing cells, formulas, and dependencies
   - Currently handles a single grid instance
   - Manages formula evaluation and dependency graph

1. **Grid** (`packages/core/src/Grid.ts`):

   - Stores cell data in a Map structure
   - Handles cell operations (get, set, clear)
   - Fixed dimensions (rows × cols)

1. **UI Components**:

   - **CanvasGrid**: Main grid rendering component
   - **FormulaBar**: Shows and edits cell formulas
   - **main.ts**: Initializes single engine instance

### Current State Management

- SpreadsheetState interface exists but only supports single sheet
- No concept of workbook or multiple sheets
- Cell addresses are simple row/col without sheet reference

## Detailed Implementation Plan

### Phase 1: Core Data Model

#### 1.1 Create Sheet Class

```typescript
// packages/core/src/Sheet.ts
export class Sheet {
  private id: string;
  private name: string;
  private engine: SpreadsheetEngine;
  private metadata: SheetMetadata;
  
  constructor(name: string, rows?: number, cols?: number) {
    this.id = generateId();
    this.name = name;
    this.engine = new SpreadsheetEngine(rows, cols);
    this.metadata = {
      createdAt: new Date(),
      modifiedAt: new Date(),
      index: 0
    };
  }
}
```

#### 1.2 Create Workbook Class

```typescript
// packages/core/src/Workbook.ts
export class Workbook {
  private sheets: Map<string, Sheet>;
  private activeSheetId: string;
  private metadata: WorkbookMetadata;
  
  addSheet(name?: string): Sheet;
  removeSheet(sheetId: string): boolean;
  getActiveSheet(): Sheet;
  setActiveSheet(sheetId: string): void;
  getSheetByName(name: string): Sheet | undefined;
  renameSheet(sheetId: string, newName: string): void;
  moveSheet(sheetId: string, newIndex: number): void;
}
```

#### 1.3 Update Type Definitions

```typescript
// packages/core/src/types/WorkbookState.ts
export interface WorkbookState {
  version: string;
  metadata?: WorkbookMetadata;
  sheets: SheetState[];
  activeSheetId: string;
}

export interface SheetState extends SpreadsheetState {
  id: string;
  name: string;
  index: number;
}
```

### Phase 2: Formula System Enhancement

#### 2.1 Cross-Sheet References

- Update formula tokenizer to recognize patterns like `Sheet1!A1` or `'My Sheet'!B2:C10`
- Extend AST node types to include sheet references
- Update evaluator to resolve cross-sheet cell values

#### 2.2 Dependency Graph Updates

- Extend dependency tracking across sheets
- Handle circular dependencies between sheets
- Update recalculation to work across sheet boundaries

### Phase 3: UI Components

#### 3.1 Tab Bar Component

```typescript
// packages/ui-web/src/components/TabBar.ts
export class TabBar {
  private container: HTMLElement;
  private workbook: Workbook;
  private onTabChange: (sheetId: string) => void;
  
  constructor(container: HTMLElement, workbook: Workbook) {
    this.container = container;
    this.workbook = workbook;
    this.render();
    this.attachEventListeners();
  }
  
  private render(): void {
    // Create tab elements
    // Add "+" button for new sheets
    // Show active tab indicator
  }
  
  private handleTabClick(sheetId: string): void;
  private handleAddSheet(): void;
  private showContextMenu(sheetId: string, event: MouseEvent): void;
}
```

#### 3.2 Tab Bar Styling

```css
/* packages/ui-web/src/components/TabBar.css */
.tab-bar {
  height: 30px;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
  display: flex;
  align-items: center;
  overflow-x: auto;
}

.tab {
  padding: 4px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  user-select: none;
}

.tab.active {
  background: #1976d2;
  color: white;
}

.tab-add-button {
  width: 30px;
  text-align: center;
  cursor: pointer;
}
```

### Phase 4: Integration Points

#### 4.1 Update main.ts

- Replace single SpreadsheetEngine with Workbook
- Initialize with default sheet
- Connect tab bar to grid switching

#### 4.2 Update Import/Export

- Modify JSON format to include multiple sheets
- Update CSV import to handle sheet selection
- Add Excel format support (future enhancement)

#### 4.3 Keyboard Shortcuts

- Ctrl+PageDown: Next sheet
- Ctrl+PageUp: Previous sheet
- Alt+Shift+N: New sheet
- F2: Rename current sheet

### Phase 5: Implementation Order

1. **Week 1: Core Infrastructure**

   - Implement Sheet and Workbook classes
   - Update type definitions
   - Basic sheet management without UI

1. **Week 2: Formula System**

   - Add cross-sheet reference parsing
   - Update formula evaluator
   - Handle cross-sheet dependencies

1. **Week 3: UI Components**

   - Create TabBar component
   - Integrate with existing UI
   - Add context menus

1. **Week 4: Testing & Polish**

   - Unit tests for all new components
   - Integration tests for cross-sheet formulas
   - Performance optimization
   - Documentation

## Technical Considerations

### Memory Management

- Lazy loading of sheet data
- Only keep active sheet's canvas in memory
- Cache computed values for inactive sheets

### Performance

- Batch updates when switching sheets
- Optimize cross-sheet formula evaluation
- Consider virtual rendering for many tabs

### Backward Compatibility

- Don't maintain support for single-sheet JSON format

## Testing Strategy

### Unit Tests

- Sheet class operations
- Workbook management methods
- Cross-sheet formula parsing
- Dependency graph with multiple sheets

### Integration Tests

- Tab switching with unsaved changes
- Cross-sheet formula updates
- Import/export with multiple sheets
- Undo/redo across sheets

### UI Tests

- Tab creation and deletion
- Drag-and-drop reordering
- Context menu operations
- Keyboard navigation

## Future Enhancements

1. **Sheet Templates**: Pre-defined sheet layouts
1. **Sheet Protection**: Lock sheets from editing
1. **Sheet Visibility**: Hide/show sheets
1. **3D References**: Formulas across multiple sheets (e.g., `=SUM(Sheet1:Sheet3!A1)`)
1. **Sheet Groups**: Organize related sheets
1. **Conditional Formatting**: Cross-sheet rules
1. **Named Ranges**: Workbook-level named ranges

## API Changes

### Breaking Changes

- Don't work with single-sheet SpreadsheetEngine anymore

### New APIs

- Workbook class methods
- Sheet management events
- Cross-sheet formula syntax

## Dependencies

No new external dependencies required. Implementation uses existing:

- TypeScript
- Bun runtime
- Canvas API for rendering

## Conclusion

This implementation plan provides a comprehensive approach to adding multiple tab functionality to GridCore. The phased approach ensures we can deliver incremental value while maintaining system stability. The architecture is designed to be extensible for future enhancements while preserving the performance characteristics of the current single-sheet implementation.

