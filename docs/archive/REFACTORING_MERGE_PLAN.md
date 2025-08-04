# GridCore Refactoring Git Merge Plan (No Backwards Compatibility)

## Overview

This plan uses git to merge the refactoring branch into main, then adapts ui-web and other packages to work directly with the new clean architecture. No backwards compatibility layers or adapters will be created.

## Git Merge Strategy

### Step 1: Prepare for Merge
```bash
cd /Users/vinay/v/code/gridcore/main
git fetch origin
git checkout main
git pull origin main
```

### Step 2: Merge Refactoring Branch
```bash
# Merge refactoring worktree changes
git merge --no-ff worktrees/refactoring

# Expected conflicts:
# - packages/core/src/* (entire structure changed)
# - packages/core/package.json
# - docs/* (keep both sets of docs)
```

### Step 3: Resolve Conflicts
- **Core Package**: Accept ALL changes from refactoring branch (complete replacement)
- **Documentation**: Keep both versions, organize in docs/
- **Root files**: Merge package.json dependencies

## Post-Merge Adaptation Plan

### Phase 1: Core Package Cleanup (Day 1)

1. **Remove Old Files**
   - Delete: SpreadsheetEngine.ts, Grid.ts, DependencyGraph.ts, Sheet.ts, Workbook.ts
   - Delete: Old formula parser/evaluator
   - Delete: Old test files for removed classes
   - Keep: Only the new clean architecture files

2. **Implement Missing Features**
   - **Sheet class**: Build on top of SpreadsheetFacade
   - **Workbook class**: Manage multiple Sheet instances
   - **WorkbookFormulaEngine**: Cross-sheet formula support

### Phase 2: UI-Web Direct Migration (Days 2-4)

#### 2.1 Update All Imports
```typescript
// Before
import { SpreadsheetEngine, cellAddressToString, parseCellAddress } from "@gridcore/core"

// After
import { 
  SpreadsheetFacade,
  CellAddress,
  cellAddressToString,
  parseCellAddress,
  Sheet,
  Workbook
} from "@gridcore/core"
```

#### 2.2 Component Updates

**main.ts**
```typescript
// Create workbook with new architecture
const workbook = new Workbook()
const sheet = workbook.getActiveSheet()
const facade = sheet.getFacade()

// Update cell operations
const addr = parseCellAddress("A1")
if (addr) {
  const result = facade.setCellValue(addr, "Hello")
  if (!result.ok) console.error(result.error)
}
```

**CanvasGrid.ts**
- Replace SpreadsheetEngine with Sheet
- Update getCell to use facade.getCell
- Handle Result<Cell> return types
- Update render logic for new Cell structure

**KeyboardHandler.ts**
- Update cell navigation to use CellAddress
- Handle async setCellValue operations
- Update formula bar integration

**MouseHandler.ts**
- Convert click coordinates to CellAddress
- Update selection to use CellRange objects

**ResizeBehavior.ts**
- Update column/row sizing with facade API

### Phase 3: State Machine Updates (Day 5)

1. **SpreadsheetStateMachine.ts**
   - Store CellAddress instead of {row, col}
   - Update all state transitions for new API
   - Handle async operations in actions

2. **Selection Management**
   - Use CellRange for selections
   - Update visual mode for new types

### Phase 4: New Sheet/Workbook Implementation (Days 6-7)

```typescript
// packages/core/src/Sheet.ts
export class Sheet {
  private facade: SpreadsheetFacade
  private id: string
  private name: string
  
  constructor(name: string, rows: number, cols: number) {
    // Initialize all dependencies
    const cellRepo = new InMemoryCellRepository()
    const depRepo = new InMemoryDependencyRepository()
    const eventService = new EventStore()
    const formulaParser = new FormulaParser()
    const formulaEvaluator = new FormulaEvaluator()
    const formulaService = new FormulaService(formulaParser, formulaEvaluator)
    const calcService = new CalculationService(cellRepo, depRepo, formulaService)
    
    this.facade = new SpreadsheetFacade(
      cellRepo, depRepo, calcService, formulaService, eventService
    )
  }
  
  getFacade(): SpreadsheetFacade { return this.facade }
}

// packages/core/src/Workbook.ts
export class Workbook {
  private sheets = new Map<string, Sheet>()
  private activeSheetId: string
  
  constructor() {
    const sheet = new Sheet("Sheet1", 2000, 52)
    this.sheets.set(sheet.getId(), sheet)
    this.activeSheetId = sheet.getId()
  }
  
  getActiveSheet(): Sheet {
    return this.sheets.get(this.activeSheetId)!
  }
}
```

### Phase 5: Formula System Integration (Days 8-9)

1. **Cross-sheet References**
   - Extend FormulaParser for sheet references
   - Update FormulaEvaluator context
   - Implement WorkbookFormulaEngine

2. **Event Integration**
   - Connect UI to new event system
   - Update renders on CellValueChanged events

### Phase 6: Testing & Validation (Days 10-11)

1. **Fix All Tests**
   - Rewrite ui-web component tests
   - Update mocks for new architecture
   - Add integration tests

2. **E2E Tests**
   - Update Playwright tests for new API
   - Verify all features work

## Implementation Commands

```bash
# 1. Perform merge
cd /Users/vinay/v/code/gridcore/main
git merge worktrees/refactoring

# 2. Remove old core files
rm packages/core/src/SpreadsheetEngine.ts
rm packages/core/src/Grid.ts
rm packages/core/src/DependencyGraph.ts
rm packages/core/src/Sheet.ts
rm packages/core/src/Workbook.ts
rm -rf packages/core/src/formula/
rm packages/core/src/WorkbookFormulaEngine.ts

# 3. Run tests to see what breaks
bun test

# 4. Update each component systematically
# (Follow the component update patterns above)

# 5. Run linting and type checking
bun run check

# 6. Commit the fully migrated code
git add -A
git commit -m "feat: merge clean architecture refactoring and migrate ui-web"
```

## Key Changes for UI-Web

1. **No More {row, col} Objects**
   - Always use CellAddress value objects
   - Use parseCellAddress() helper function

2. **Handle Result<T> Types**
   ```typescript
   const result = facade.setCellValue(addr, value)
   if (!result.ok) {
     console.error("Failed to set cell:", result.error)
   }
   ```

3. **Async Operations**
   - Most facade methods are synchronous but return Result<T>
   - Handle errors explicitly

4. **Event Subscriptions**
   ```typescript
   const eventService = facade.getEventService()
   eventService.on('CellValueChanged', (event) => {
     canvasGrid.renderCell(event.address)
   })
   ```

## Success Metrics

- Zero references to old classes (SpreadsheetEngine, Grid)
- All tests passing
- Full type safety (no any types)
- Clean architecture layers maintained
- All features working as before
- No performance regression

## Benefits of This Approach

1. **Clean Break**: No technical debt from compatibility layers
2. **Type Safety**: Full benefits of new architecture immediately  
3. **Maintainability**: Single codebase to maintain
4. **Performance**: No overhead from adapters
5. **Clarity**: Clear architectural boundaries