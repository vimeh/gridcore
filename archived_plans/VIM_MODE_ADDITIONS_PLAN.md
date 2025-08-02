# Enhanced Vim Mode Mouse Interaction Keyboard Equivalents Plan

## Overview

This enhanced plan provides specific implementation details, file locations, and comprehensive testing strategies for adding keyboard-driven equivalents of mouse interactions in vim mode.

## Current State Analysis

### Existing Infrastructure

1. **SelectionManager** (`packages/ui-web/src/interaction/SelectionManager.ts`)

   - Has `startRangeSelection`, `updateRangeSelection`, `endRangeSelection` methods
   - Currently only supports single active cell and basic range selection
   - Missing: Visual mode state tracking, block selection support

1. **Viewport** (`packages/ui-web/src/components/Viewport.ts`)

   - Has `setScrollPosition`, `getScrollPosition` methods
   - Has `setColumnWidth`, `setRowHeight` methods with min/max constraints
   - Missing: Keyboard-driven scroll methods, auto-fit calculations

1. **VimMode/VimBehavior** (`packages/ui-web/src/interaction/VimMode.ts`)

   - Already has visual mode support for text editing
   - Missing: Grid-aware visual modes, resize mode support

1. **ModeManager** (`packages/ui-web/src/state/ModeManager.ts`)

   - Complete mode management infrastructure
   - Missing: Resize mode, visual-block mode

## Detailed Implementation Plan

### Phase 1: Visual Mode Enhancements (Grid Selection)

#### 1.1 Extend SpreadsheetMode Types

**File**: `packages/ui-web/src/state/SpreadsheetMode.ts`

```typescript
// Add to line ~70
export type CellMode = "normal" | "insert" | "visual" | "visual-line" | "visual-block" | "resize"

// Add to SpreadsheetState interface (~80)
export interface SpreadsheetState {
  // ... existing fields
  visualAnchor?: CellAddress  // Starting point of visual selection
  visualCursor?: CellAddress  // Current position in visual selection
  resizeTarget?: { type: 'column' | 'row'; index: number } // What we're resizing
}

// Add new transition events (~95)
| { type: "ENTER_VISUAL_BLOCK_MODE" }
| { type: "ENTER_RESIZE_MODE"; target: { type: 'column' | 'row'; index: number } }
| { type: "EXIT_RESIZE_MODE" }
```

#### 1.2 Create GridVimBehavior Class

**New File**: `packages/ui-web/src/interaction/GridVimBehavior.ts`

```typescript
import { CellAddress } from "@gridcore/core"
import { VimBehavior, VimBehaviorCallbacks } from "./VimMode"
import type { SelectionManager } from "./SelectionManager"
import type { Viewport } from "../components/Viewport"

export interface GridVimCallbacks extends VimBehaviorCallbacks {
  onRangeSelectionRequest: (anchor: CellAddress, cursor: CellAddress) => void
  onResizeRequest: (type: 'column' | 'row', index: number, delta: number) => void
  onScrollRequest: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => void
  onCellNavigate: (direction: 'up' | 'down' | 'left' | 'right', count: number) => void
}

export class GridVimBehavior {
  private vimBehavior: VimBehavior
  private visualAnchor: CellAddress | null = null
  private resizeAccumulator: string = "" // For number prefixes in resize mode
  
  constructor(
    private callbacks: GridVimCallbacks,
    private getCurrentMode: () => CellMode,
    private selectionManager: SelectionManager,
    private viewport: Viewport
  ) {
    // Initialize with text vim behavior for cell editing
    this.vimBehavior = new VimBehavior(callbacks, getCurrentMode)
  }
  
  handleKey(key: string, ctrl: boolean = false, shift: boolean = false): boolean {
    const mode = this.getCurrentMode()
    
    // In resize mode, handle special keys
    if (mode === "resize") {
      return this.handleResizeMode(key, ctrl, shift)
    }
    
    // In visual modes, handle grid navigation
    if (mode === "visual" || mode === "visual-line" || mode === "visual-block") {
      return this.handleVisualMode(key, ctrl, shift)
    }
    
    // In normal mode, add grid-specific commands
    if (mode === "normal") {
      return this.handleNormalMode(key, ctrl, shift)
    }
    
    // Delegate to text vim behavior for insert mode
    return this.vimBehavior.handleKey(key, ctrl, shift)
  }
  
  // Implementation continues...
}
```

#### 1.3 Enhance SelectionManager for Visual Modes

**File**: `packages/ui-web/src/interaction/SelectionManager.ts`

Add after line 21:

```typescript
private visualAnchor: CellAddress | null = null
private visualMode: 'character' | 'line' | 'block' | null = null

// Add new methods after line 117
startVisualSelection(anchor: CellAddress, mode: 'character' | 'line' | 'block'): void {
  this.visualAnchor = anchor
  this.visualMode = mode
  this.state.activeCell = anchor
  this.updateVisualSelection(anchor)
}

updateVisualSelection(cursor: CellAddress): void {
  if (!this.visualAnchor || !this.visualMode) return
  
  this.state.selectedCells.clear()
  
  if (this.visualMode === 'line') {
    // Select entire rows from anchor to cursor
    const startRow = Math.min(this.visualAnchor.row, cursor.row)
    const endRow = Math.max(this.visualAnchor.row, cursor.row)
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < this.viewport.getTotalCols(); col++) {
        this.state.selectedCells.add(cellAddressToString({ row, col }))
      }
    }
  } else if (this.visualMode === 'block') {
    // Select rectangular block
    const startRow = Math.min(this.visualAnchor.row, cursor.row)
    const endRow = Math.max(this.visualAnchor.row, cursor.row)
    const startCol = Math.min(this.visualAnchor.col, cursor.col)
    const endCol = Math.max(this.visualAnchor.col, cursor.col)
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        this.state.selectedCells.add(cellAddressToString({ row, col }))
      }
    }
  } else {
    // Character mode - normal range selection
    this.updateRangeSelection(cursor)
  }
  
  this.state.activeCell = cursor
}

endVisualSelection(): void {
  this.visualAnchor = null
  this.visualMode = null
}
```

### Phase 2: Scrolling Commands Implementation

#### 2.1 Add Scroll Methods to Viewport

**File**: `packages/ui-web/src/components/Viewport.ts`

Add after line 49:

```typescript
// Keyboard-driven scrolling methods
scrollBy(deltaX: number, deltaY: number): void {
  const newX = Math.max(0, this.scrollPosition.x + deltaX)
  const newY = Math.max(0, this.scrollPosition.y + deltaY)
  
  const maxX = Math.max(0, this.getTotalGridWidth() - this.viewportWidth)
  const maxY = Math.max(0, this.getTotalGridHeight() - this.viewportHeight)
  
  this.scrollPosition = {
    x: Math.min(newX, maxX),
    y: Math.min(newY, maxY)
  }
}

scrollToCell(cell: CellAddress, position: 'center' | 'top' | 'bottom' = 'center'): void {
  const cellPos = this.getCellPosition(cell)
  const absoluteX = cellPos.x + this.scrollPosition.x
  const absoluteY = cellPos.y + this.scrollPosition.y
  
  let newY = this.scrollPosition.y
  
  switch (position) {
    case 'center':
      newY = absoluteY - this.viewportHeight / 2 + cellPos.height / 2
      break
    case 'top':
      newY = absoluteY
      break
    case 'bottom':
      newY = absoluteY - this.viewportHeight + cellPos.height
      break
  }
  
  // Ensure cell is horizontally visible
  let newX = this.scrollPosition.x
  if (absoluteX < this.scrollPosition.x) {
    newX = absoluteX
  } else if (absoluteX + cellPos.width > this.scrollPosition.x + this.viewportWidth) {
    newX = absoluteX + cellPos.width - this.viewportWidth
  }
  
  this.setScrollPosition(
    Math.max(0, Math.min(newX, this.getTotalGridWidth() - this.viewportWidth)),
    Math.max(0, Math.min(newY, this.getTotalGridHeight() - this.viewportHeight))
  )
}

getPageSize(): { rows: number; cols: number } {
  const bounds = this.getVisibleBounds()
  return {
    rows: bounds.endRow - bounds.startRow,
    cols: bounds.endCol - bounds.startCol
  }
}
```

### Phase 3: Resize Mode Implementation

#### 3.1 Create ResizeBehavior Class

**New File**: `packages/ui-web/src/interaction/ResizeBehavior.ts`

```typescript
import type { Viewport } from "../components/Viewport"
import type { SpreadsheetEngine } from "@gridcore/core"

export class ResizeBehavior {
  private resizeTarget: { type: 'column' | 'row'; index: number } | null = null
  private numberBuffer: string = ""
  
  constructor(
    private viewport: Viewport,
    private engine: SpreadsheetEngine
  ) {}
  
  setTarget(type: 'column' | 'row', index: number): void {
    this.resizeTarget = { type, index }
    this.numberBuffer = ""
  }
  
  handleKey(key: string): { handled: boolean; exitMode?: boolean } {
    if (!this.resizeTarget) return { handled: false }
    
    // Number accumulation
    if (key >= '0' && key <= '9') {
      this.numberBuffer += key
      return { handled: true }
    }
    
    const multiplier = this.numberBuffer ? parseInt(this.numberBuffer) : 1
    this.numberBuffer = ""
    
    switch (key) {
      case '+':
      case '>':
        this.resize(5 * multiplier)
        return { handled: true }
        
      case '-':
      case '<':
        this.resize(-5 * multiplier)
        return { handled: true }
        
      case '=':
        this.autoFit()
        return { handled: true }
        
      case 'Escape':
        return { handled: true, exitMode: true }
        
      case 'h':
      case 'l':
        if (this.resizeTarget.type === 'column') {
          const delta = key === 'h' ? -1 : 1
          this.resizeTarget.index = Math.max(0, 
            Math.min(this.viewport.getTotalCols() - 1, this.resizeTarget.index + delta))
        }
        return { handled: true }
        
      case 'j':
      case 'k':
        if (this.resizeTarget.type === 'row') {
          const delta = key === 'j' ? 1 : -1
          this.resizeTarget.index = Math.max(0,
            Math.min(this.viewport.getTotalRows() - 1, this.resizeTarget.index + delta))
        }
        return { handled: true }
        
      default:
        return { handled: false }
    }
  }
  
  private resize(delta: number): void {
    if (!this.resizeTarget) return
    
    if (this.resizeTarget.type === 'column') {
      const current = this.viewport.getColumnWidth(this.resizeTarget.index)
      this.viewport.setColumnWidth(this.resizeTarget.index, current + delta)
    } else {
      const current = this.viewport.getRowHeight(this.resizeTarget.index)
      this.viewport.setRowHeight(this.resizeTarget.index, current + delta)
    }
  }
  
  private autoFit(): void {
    if (!this.resizeTarget) return
    
    // Calculate content size
    if (this.resizeTarget.type === 'column') {
      let maxWidth = 50 // minimum
      
      // Check all cells in this column
      for (let row = 0; row < this.viewport.getTotalRows(); row++) {
        const cell = this.engine.getCell({ row, col: this.resizeTarget.index })
        if (cell) {
          // Estimate width based on content length
          const content = cell.formattedValue || cell.rawValue?.toString() || ""
          const estimatedWidth = content.length * 8 + 20 // rough estimate
          maxWidth = Math.max(maxWidth, estimatedWidth)
        }
      }
      
      this.viewport.setColumnWidth(this.resizeTarget.index, Math.min(maxWidth, 300))
    } else {
      // For rows, use a standard height for now
      this.viewport.setRowHeight(this.resizeTarget.index, 25)
    }
  }
  
  getTarget(): { type: 'column' | 'row'; index: number } | null {
    return this.resizeTarget
  }
  
  clear(): void {
    this.resizeTarget = null
    this.numberBuffer = ""
  }
}
```

### Phase 4: Update KeyboardHandler

**File**: `packages/ui-web/src/interaction/KeyboardHandler.ts`

Add imports at top:

```typescript
import { GridVimBehavior, GridVimCallbacks } from "./GridVimBehavior"
import { ResizeBehavior } from "./ResizeBehavior"
```

Add properties after line 7:

```typescript
private gridVimBehavior?: GridVimBehavior
private resizeBehavior?: ResizeBehavior
```

Update constructor:

```typescript
constructor(
  // ... existing parameters
) {
  // ... existing code
  
  // Initialize GridVimBehavior if we have mode state machine
  if (this.modeStateMachine) {
    const callbacks: GridVimCallbacks = {
      onModeChangeRequest: (mode, editMode) => {
        // Handle mode transitions
        if (mode === "visual") {
          this.modeStateMachine.transition({ type: "ENTER_VISUAL_MODE", visualType: "character" })
        } else if (mode === "visual-line") {
          this.modeStateMachine.transition({ type: "ENTER_VISUAL_MODE", visualType: "line" })
        } else if (mode === "visual-block") {
          this.modeStateMachine.transition({ type: "ENTER_VISUAL_BLOCK_MODE" })
        } else if (mode === "resize") {
          const activeCell = this.selectionManager.getActiveCell()
          if (activeCell) {
            this.modeStateMachine.transition({ 
              type: "ENTER_RESIZE_MODE", 
              target: { type: 'column', index: activeCell.col }
            })
          }
        }
        // ... handle other modes
      },
      onRangeSelectionRequest: (anchor, cursor) => {
        this.selectionManager.updateVisualSelection(cursor)
      },
      onResizeRequest: (type, index, delta) => {
        // Handled by ResizeBehavior
      },
      onScrollRequest: (direction, amount) => {
        const pageSize = this.canvasGrid?.getViewport().getPageSize()
        const scrollAmount = amount === 0.5 ? Math.floor((pageSize?.rows || 10) / 2) : amount
        
        switch (direction) {
          case 'up':
            this.canvasGrid?.getViewport().scrollBy(0, -scrollAmount * 25)
            break
          case 'down':
            this.canvasGrid?.getViewport().scrollBy(0, scrollAmount * 25)
            break
          case 'left':
            this.canvasGrid?.getViewport().scrollBy(-scrollAmount * 100, 0)
            break
          case 'right':
            this.canvasGrid?.getViewport().scrollBy(scrollAmount * 100, 0)
            break
        }
      },
      onCellNavigate: (direction, count) => {
        for (let i = 0; i < count; i++) {
          this.selectionManager.moveActiveCell(direction)
        }
      },
      // ... other callbacks
    }
    
    this.gridVimBehavior = new GridVimBehavior(
      callbacks,
      () => this.modeStateMachine!.getCellMode(),
      this.selectionManager,
      this.canvasGrid!.getViewport()
    )
    
    this.resizeBehavior = new ResizeBehavior(
      this.canvasGrid!.getViewport(),
      this.grid
    )
  }
}
```

Update handleKeyDown to route vim commands:

```typescript
private handleKeyDown(event: KeyboardEvent): void {
  const isNavigationMode = !this.modeStateMachine || this.modeStateMachine.isInNavigationMode()
  const isResizeMode = this.modeStateMachine?.getCellMode() === "resize"
  
  // Handle resize mode
  if (isResizeMode && this.resizeBehavior) {
    const result = this.resizeBehavior.handleKey(event.key)
    if (result.handled) {
      event.preventDefault()
      if (result.exitMode) {
        this.modeStateMachine?.transition({ type: "EXIT_RESIZE_MODE" })
      }
      return
    }
  }
  
  // Handle vim commands in editing mode
  if (!isNavigationMode && this.gridVimBehavior) {
    const handled = this.gridVimBehavior.handleKey(event.key, event.ctrlKey, event.shiftKey)
    if (handled) {
      event.preventDefault()
      return
    }
  }
  
  // Add new navigation mode commands
  if (isNavigationMode) {
    switch (event.key) {
      // Visual mode triggers
      case 'v':
        event.preventDefault()
        const activeCell = this.selectionManager.getActiveCell()
        if (activeCell) {
          this.modeStateMachine?.transition({ type: "START_EDITING" })
          this.modeStateMachine?.transition({ type: "ENTER_VISUAL_MODE", visualType: "character" })
          this.selectionManager.startVisualSelection(activeCell, 'character')
        }
        break
        
      case 'V':
        event.preventDefault()
        const cell = this.selectionManager.getActiveCell()
        if (cell) {
          this.modeStateMachine?.transition({ type: "START_EDITING" })
          this.modeStateMachine?.transition({ type: "ENTER_VISUAL_MODE", visualType: "line" })
          this.selectionManager.startVisualSelection(cell, 'line')
        }
        break
        
      // Resize mode
      case 'g':
        if (this.lastKey === 'g') {
          // gg - go to first row
          this.selectionManager.setActiveCell({ row: 0, col: this.selectionManager.getActiveCell()?.col || 0 })
          this.lastKey = ''
        } else {
          this.lastKey = 'g'
          setTimeout(() => { this.lastKey = '' }, 1000)
        }
        event.preventDefault()
        break
        
      case 'r':
        if (this.lastKey === 'g') {
          // gr - enter resize mode
          event.preventDefault()
          const active = this.selectionManager.getActiveCell()
          if (active) {
            this.modeStateMachine?.transition({
              type: "ENTER_RESIZE_MODE",
              target: { type: 'column', index: active.col }
            })
            this.resizeBehavior?.setTarget('column', active.col)
          }
          this.lastKey = ''
        }
        break
        
      // Scrolling commands
      case 'z':
        this.lastKey = 'z'
        setTimeout(() => { this.lastKey = '' }, 1000)
        event.preventDefault()
        break
        
      // ... handle z combinations (zz, zt, zb, etc.)
    }
  }
  
  // ... rest of existing handleKeyDown
}

private lastKey: string = ''
```

### Phase 5: Update Constants

**File**: `packages/ui-web/src/constants.ts`

Add after line 33:

```typescript
// Vim-specific keys
G: "G",
V: "V",
CTRL_V: "v", // with ctrl modifier check
CTRL_D: "d", // with ctrl modifier check
CTRL_U: "u", // with ctrl modifier check
CTRL_E: "e", // with ctrl modifier check
CTRL_Y: "y", // with ctrl modifier check
CTRL_F: "f", // with ctrl modifier check
CTRL_B: "b", // with ctrl modifier check
PLUS: "+",
MINUS: "-",
GREATER: ">",
LESS: "<",
EQUALS: "=",
ZERO: "0",
DOLLAR: "$",
```

## Comprehensive Testing Strategy

### Unit Tests

#### 1. GridVimBehavior Tests

**New File**: `packages/ui-web/src/interaction/GridVimBehavior.test.ts`

```typescript
import { test, expect, describe, beforeEach } from "bun:test"
import { GridVimBehavior } from "./GridVimBehavior"
import { SelectionManager } from "./SelectionManager"
import { Viewport } from "../components/Viewport"
import { createDefaultTheme } from "../rendering/GridTheme"

describe("GridVimBehavior", () => {
  let behavior: GridVimBehavior
  let selectionManager: SelectionManager
  let viewport: Viewport
  let callbacks: any
  
  beforeEach(() => {
    selectionManager = new SelectionManager()
    viewport = new Viewport(createDefaultTheme())
    callbacks = {
      onModeChangeRequest: jest.fn(),
      onRangeSelectionRequest: jest.fn(),
      onResizeRequest: jest.fn(),
      onScrollRequest: jest.fn(),
      onCellNavigate: jest.fn(),
    }
    
    behavior = new GridVimBehavior(
      callbacks,
      () => "normal",
      selectionManager,
      viewport
    )
  })
  
  describe("Visual Mode", () => {
    test("should handle visual character mode selection", () => {
      selectionManager.setActiveCell({ row: 5, col: 5 })
      
      // Enter visual mode
      behavior.handleKey("v")
      expect(callbacks.onModeChangeRequest).toHaveBeenCalledWith("visual")
      
      // Move right
      behavior.handleKey("l")
      expect(callbacks.onCellNavigate).toHaveBeenCalledWith("right", 1)
      
      // Move down
      behavior.handleKey("j")
      expect(callbacks.onCellNavigate).toHaveBeenCalledWith("down", 1)
    })
    
    test("should handle visual line mode", () => {
      selectionManager.setActiveCell({ row: 5, col: 5 })
      
      // Enter visual line mode
      behavior.handleKey("V")
      expect(callbacks.onModeChangeRequest).toHaveBeenCalledWith("visual-line")
    })
    
    test("should handle visual block mode", () => {
      selectionManager.setActiveCell({ row: 5, col: 5 })
      
      // Enter visual block mode (Ctrl+v)
      behavior.handleKey("v", true)
      expect(callbacks.onModeChangeRequest).toHaveBeenCalledWith("visual-block")
    })
  })
  
  describe("Scrolling", () => {
    test("should handle scroll down half page", () => {
      behavior.handleKey("d", true) // Ctrl+d
      expect(callbacks.onScrollRequest).toHaveBeenCalledWith("down", 0.5)
    })
    
    test("should handle scroll up half page", () => {
      behavior.handleKey("u", true) // Ctrl+u
      expect(callbacks.onScrollRequest).toHaveBeenCalledWith("up", 0.5)
    })
    
    test("should handle page down", () => {
      behavior.handleKey("f", true) // Ctrl+f
      expect(callbacks.onScrollRequest).toHaveBeenCalledWith("down", 1)
    })
    
    test("should handle page up", () => {
      behavior.handleKey("b", true) // Ctrl+b
      expect(callbacks.onScrollRequest).toHaveBeenCalledWith("up", 1)
    })
  })
  
  describe("Count prefixes", () => {
    test("should handle count prefix for movement", () => {
      behavior.handleKey("5")
      behavior.handleKey("j")
      expect(callbacks.onCellNavigate).toHaveBeenCalledWith("down", 5)
    })
    
    test("should handle multi-digit counts", () => {
      behavior.handleKey("1")
      behavior.handleKey("0")
      behavior.handleKey("l")
      expect(callbacks.onCellNavigate).toHaveBeenCalledWith("right", 10)
    })
  })
})
```

#### 2. ResizeBehavior Tests

**New File**: `packages/ui-web/src/interaction/ResizeBehavior.test.ts`

```typescript
import { test, expect, describe, beforeEach } from "bun:test"
import { ResizeBehavior } from "./ResizeBehavior"
import { Viewport } from "../components/Viewport"
import { SpreadsheetEngine } from "@gridcore/core"
import { createDefaultTheme } from "../rendering/GridTheme"

describe("ResizeBehavior", () => {
  let behavior: ResizeBehavior
  let viewport: Viewport
  let engine: SpreadsheetEngine
  
  beforeEach(() => {
    viewport = new Viewport(createDefaultTheme())
    engine = new SpreadsheetEngine()
    behavior = new ResizeBehavior(viewport, engine)
  })
  
  test("should increase column width with + key", () => {
    behavior.setTarget('column', 0)
    const initialWidth = viewport.getColumnWidth(0)
    
    const result = behavior.handleKey('+')
    expect(result.handled).toBe(true)
    expect(viewport.getColumnWidth(0)).toBe(initialWidth + 5)
  })
  
  test("should decrease column width with - key", () => {
    behavior.setTarget('column', 0)
    viewport.setColumnWidth(0, 100)
    
    const result = behavior.handleKey('-')
    expect(result.handled).toBe(true)
    expect(viewport.getColumnWidth(0)).toBe(95)
  })
  
  test("should handle count prefix", () => {
    behavior.setTarget('column', 0)
    const initialWidth = viewport.getColumnWidth(0)
    
    behavior.handleKey('3')
    behavior.handleKey('+')
    expect(viewport.getColumnWidth(0)).toBe(initialWidth + 15) // 3 * 5
  })
  
  test("should auto-fit column width with = key", () => {
    behavior.setTarget('column', 0)
    engine.setCell({ row: 0, col: 0 }, "Very long content that needs more space")
    
    const result = behavior.handleKey('=')
    expect(result.handled).toBe(true)
    expect(viewport.getColumnWidth(0)).toBeGreaterThan(50)
  })
  
  test("should exit mode on Escape", () => {
    behavior.setTarget('column', 0)
    
    const result = behavior.handleKey('Escape')
    expect(result.handled).toBe(true)
    expect(result.exitMode).toBe(true)
  })
  
  test("should navigate between columns with h/l", () => {
    behavior.setTarget('column', 5)
    
    behavior.handleKey('h')
    expect(behavior.getTarget()?.index).toBe(4)
    
    behavior.handleKey('l')
    expect(behavior.getTarget()?.index).toBe(5)
  })
})
```

#### 3. Enhanced SelectionManager Tests

**File**: `packages/ui-web/src/interaction/SelectionManager.test.ts` (new file)

```typescript
import { test, expect, describe, beforeEach } from "bun:test"
import { SelectionManager } from "./SelectionManager"
import { Viewport } from "../components/Viewport"
import { createDefaultTheme } from "../rendering/GridTheme"

describe("SelectionManager Visual Modes", () => {
  let manager: SelectionManager
  let viewport: Viewport
  
  beforeEach(() => {
    viewport = new Viewport(createDefaultTheme())
    manager = new SelectionManager()
    // @ts-ignore - inject viewport for testing
    manager.viewport = viewport
  })
  
  describe("Visual Character Mode", () => {
    test("should select range from anchor to cursor", () => {
      manager.startVisualSelection({ row: 2, col: 2 }, 'character')
      manager.updateVisualSelection({ row: 4, col: 5 })
      
      const selected = manager.getSelectedCells()
      expect(selected.size).toBe(12) // 3x4 rectangle
      expect(selected.has("C3")).toBe(true)
      expect(selected.has("F5")).toBe(true)
    })
  })
  
  describe("Visual Line Mode", () => {
    test("should select entire rows", () => {
      manager.startVisualSelection({ row: 2, col: 5 }, 'line')
      manager.updateVisualSelection({ row: 4, col: 3 })
      
      const selected = manager.getSelectedCells()
      // Should select all columns in rows 2-4
      expect(selected.size).toBe(3 * viewport.getTotalCols())
      expect(selected.has("A3")).toBe(true)
      expect(selected.has("Z3")).toBe(true)
    })
  })
  
  describe("Visual Block Mode", () => {
    test("should select rectangular block", () => {
      manager.startVisualSelection({ row: 2, col: 2 }, 'block')
      manager.updateVisualSelection({ row: 5, col: 4 })
      
      const selected = manager.getSelectedCells()
      expect(selected.size).toBe(12) // 4 rows x 3 cols
      
      // Check corners
      expect(selected.has("C3")).toBe(true)
      expect(selected.has("E6")).toBe(true)
      
      // Should not include cells outside block
      expect(selected.has("B3")).toBe(false)
      expect(selected.has("F3")).toBe(false)
    })
  })
})
```

### Integration Tests

#### 1. Vim Mode Grid Integration Tests

**New File**: `packages/ui-web/tests/vim-mode-grid.spec.ts`

```typescript
import { test, expect } from "@playwright/test"

test.describe("Vim Mode Grid Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
  })
  
  test("visual character mode selection", async ({ page }) => {
    // Start at B2
    await page.keyboard.press("j")
    await page.keyboard.press("l")
    
    // Enter visual mode
    await page.keyboard.press("v")
    await expect(page.locator(".mode-indicator")).toContainText("VISUAL")
    
    // Select to D4
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    await page.keyboard.press("j")
    await page.keyboard.press("j")
    
    // Check selection
    const selectedCells = await page.locator(".cell.selected").count()
    expect(selectedCells).toBe(9) // 3x3 selection
  })
  
  test("visual line mode selection", async ({ page }) => {
    // Start at C3
    await page.keyboard.press("j")
    await page.keyboard.press("j")
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    
    // Enter visual line mode
    await page.keyboard.press("V")
    await expect(page.locator(".mode-indicator")).toContainText("VISUAL LINE")
    
    // Select 3 rows down
    await page.keyboard.press("j")
    await page.keyboard.press("j")
    
    // All cells in rows 3-5 should be selected
    const row3Selected = await page.locator(".cell[data-row='2'].selected").count()
    const row4Selected = await page.locator(".cell[data-row='3'].selected").count()
    const row5Selected = await page.locator(".cell[data-row='4'].selected").count()
    
    expect(row3Selected).toBeGreaterThan(0)
    expect(row4Selected).toBeGreaterThan(0)
    expect(row5Selected).toBeGreaterThan(0)
  })
  
  test("visual block mode selection", async ({ page }) => {
    // Enter visual block mode with Ctrl+v
    await page.keyboard.press("Control+v")
    await expect(page.locator(".mode-indicator")).toContainText("VISUAL BLOCK")
    
    // Create 3x3 block
    await page.keyboard.press("j")
    await page.keyboard.press("j")
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    
    // Check rectangular selection
    const selectedCells = await page.locator(".cell.selected").count()
    expect(selectedCells).toBe(9)
  })
  
  test("scrolling with Ctrl+d/u", async ({ page }) => {
    // Get initial scroll position
    const initialScroll = await page.evaluate(() => {
      const grid = document.querySelector('.grid-canvas')
      return grid?.scrollTop || 0
    })
    
    // Scroll down half page
    await page.keyboard.press("Control+d")
    
    const scrollAfterDown = await page.evaluate(() => {
      const grid = document.querySelector('.grid-canvas')
      return grid?.scrollTop || 0
    })
    
    expect(scrollAfterDown).toBeGreaterThan(initialScroll)
    
    // Scroll back up
    await page.keyboard.press("Control+u")
    
    const scrollAfterUp = await page.evaluate(() => {
      const grid = document.querySelector('.grid-canvas')
      return grid?.scrollTop || 0
    })
    
    expect(scrollAfterUp).toBeLessThan(scrollAfterDown)
  })
  
  test("center current cell with zz", async ({ page }) => {
    // Move to a cell that's not centered
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("j")
    }
    
    // Center it
    await page.keyboard.press("z")
    await page.keyboard.press("z")
    
    // Check that active cell is roughly centered
    const cellPosition = await page.locator(".cell.active").boundingBox()
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    
    if (cellPosition) {
      const cellCenter = cellPosition.y + cellPosition.height / 2
      const viewportCenter = viewportHeight / 2
      
      expect(Math.abs(cellCenter - viewportCenter)).toBeLessThan(100)
    }
  })
})
```

#### 2. Resize Mode Tests

**New File**: `packages/ui-web/tests/resize-mode.spec.ts`

```typescript
import { test, expect } from "@playwright/test"

test.describe("Resize Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
  })
  
  test("enter resize mode with gr", async ({ page }) => {
    // Enter resize mode
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    
    await expect(page.locator(".mode-indicator")).toContainText("RESIZE")
  })
  
  test("resize column width", async ({ page }) => {
    // Get initial column width
    const initialWidth = await page.locator(".cell[data-col='0']").first().boundingBox()
    
    // Enter resize mode and increase width
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    await page.keyboard.press("+")
    await page.keyboard.press("+")
    
    // Exit resize mode
    await page.keyboard.press("Escape")
    
    // Check new width
    const newWidth = await page.locator(".cell[data-col='0']").first().boundingBox()
    
    if (initialWidth && newWidth) {
      expect(newWidth.width).toBeGreaterThan(initialWidth.width)
    }
  })
  
  test("resize with count prefix", async ({ page }) => {
    const initialWidth = await page.locator(".cell[data-col='0']").first().boundingBox()
    
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    await page.keyboard.press("5")
    await page.keyboard.press("+")
    await page.keyboard.press("Escape")
    
    const newWidth = await page.locator(".cell[data-col='0']").first().boundingBox()
    
    if (initialWidth && newWidth) {
      expect(newWidth.width).toBe(initialWidth.width + 25) // 5 * 5px
    }
  })
  
  test("auto-fit column", async ({ page }) => {
    // Add long content to a cell
    await page.keyboard.press("i")
    await page.keyboard.type("This is very long content that should expand the column")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Enter resize mode and auto-fit
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    await page.keyboard.press("=")
    await page.keyboard.press("Escape")
    
    // Column should be wider to fit content
    const columnWidth = await page.locator(".cell[data-col='0']").first().boundingBox()
    expect(columnWidth?.width).toBeGreaterThan(200)
  })
  
  test("navigate between columns in resize mode", async ({ page }) => {
    // Move to column C
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    
    // Enter resize mode
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    
    // Navigate left to column B
    await page.keyboard.press("h")
    
    // Resize column B
    await page.keyboard.press("+")
    await page.keyboard.press("Escape")
    
    // Check that column B was resized, not C
    const colBWidth = await page.locator(".cell[data-col='1']").first().boundingBox()
    const colCWidth = await page.locator(".cell[data-col='2']").first().boundingBox()
    
    // Column B should be wider than default
    expect(colBWidth?.width).toBeGreaterThan(80)
  })
})
```

#### 3. Combined Operations Tests

**New File**: `packages/ui-web/tests/vim-mode-combined.spec.ts`

```typescript
import { test, expect } from "@playwright/test"

test.describe("Combined Vim Operations", () => {
  test("visual selection with scrolling", async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
    
    // Enter visual mode
    await page.keyboard.press("v")
    
    // Select down many rows (will require scrolling)
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("j")
    }
    
    // Should have scrolled and maintained selection
    const selectedCount = await page.locator(".cell.selected").count()
    expect(selectedCount).toBeGreaterThan(30)
    
    // Active cell should be visible
    const activeCell = await page.locator(".cell.active").boundingBox()
    expect(activeCell).toBeTruthy()
  })
  
  test("count prefix with visual mode", async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
    
    // Enter visual mode
    await page.keyboard.press("v")
    
    // Select 5 cells right
    await page.keyboard.press("5")
    await page.keyboard.press("l")
    
    const selectedCount = await page.locator(".cell.selected").count()
    expect(selectedCount).toBe(6) // Original + 5 more
  })
  
  test("resize after visual selection", async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
    
    // Select a range
    await page.keyboard.press("v")
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    await page.keyboard.press("Escape")
    
    // Enter resize mode for current column
    await page.keyboard.press("g")
    await page.keyboard.press("r")
    await page.keyboard.press("+")
    await page.keyboard.press("Escape")
    
    // Current column should be resized
    const activeCol = await page.evaluate(() => {
      const active = document.querySelector(".cell.active")
      return active?.getAttribute("data-col")
    })
    
    const resizedCell = await page.locator(`.cell[data-col='${activeCol}']`).first().boundingBox()
    expect(resizedCell?.width).toBeGreaterThan(80)
  })
})
```

### Performance Tests

**New File**: `packages/ui-web/tests/vim-mode-performance.spec.ts`

```typescript
import { test, expect } from "@playwright/test"

test.describe("Vim Mode Performance", () => {
  test("large visual selection performance", async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
    
    // Measure time to select large range
    const startTime = Date.now()
    
    await page.keyboard.press("v")
    
    // Select 50x20 range
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press("j", { delay: 0 })
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("l", { delay: 0 })
    }
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Should complete in reasonable time
    expect(duration).toBeLessThan(2000)
    
    // Should have correct selection
    const selectedCount = await page.locator(".cell.selected").count()
    expect(selectedCount).toBeGreaterThan(1000)
  })
  
  test("rapid mode switching performance", async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
    
    const startTime = Date.now()
    
    // Rapidly switch modes
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("v")
      await page.keyboard.press("Escape")
      await page.keyboard.press("i")
      await page.keyboard.press("Escape")
      await page.keyboard.press("Escape")
    }
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Should handle rapid switching efficiently
    expect(duration).toBeLessThan(3000)
    
    // Should end in navigation mode
    await expect(page.locator(".mode-indicator")).toContainText("NAVIGATION")
  })
})
```

## Implementation Checklist for Subagents

### Phase 1 Subagent Context

**Task**: Implement visual mode enhancements for grid selection

**Files to modify**:

1. `packages/ui-web/src/state/SpreadsheetMode.ts` - Add visual-block mode and visual state
1. `packages/ui-web/src/interaction/SelectionManager.ts` - Add visual selection methods (lines 21-117)
1. Create `packages/ui-web/src/interaction/GridVimBehavior.ts` - New file for grid vim commands
1. `packages/ui-web/src/state/ModeManager.ts` - Add visual-block mode helpers

**Key implementation points**:

- Visual anchor/cursor tracking in SpreadsheetState
- Three visual modes: character (range), line (full rows), block (rectangle)
- Integration with existing SelectionManager range selection

### Phase 2 Subagent Context

**Task**: Implement keyboard-driven scrolling

**Files to modify**:

1. `packages/ui-web/src/components/Viewport.ts` - Add scrollBy, scrollToCell methods (after line 49)
1. `packages/ui-web/src/interaction/KeyboardHandler.ts` - Add scroll command handlers
1. `packages/ui-web/src/constants.ts` - Add vim scroll key constants

**Key implementation points**:

- Half-page and full-page scrolling
- Center/top/bottom positioning (zz, zt, zb)
- Maintain selection during scroll
- Respect viewport bounds

### Phase 3 Subagent Context

**Task**: Implement resize mode

**Files to modify**:

1. `packages/ui-web/src/state/SpreadsheetMode.ts` - Add resize mode and state
1. Create `packages/ui-web/src/interaction/ResizeBehavior.ts` - Resize logic
1. `packages/ui-web/src/interaction/KeyboardHandler.ts` - Handle gr command and resize keys
1. `packages/ui-web/src/components/ModeIndicator.ts` - Show resize mode

**Key implementation points**:

- Track resize target (column/row and index)
- Number prefix accumulation for resize amounts
- Auto-fit calculation based on content
- Navigation between columns/rows while resizing

### Phase 4 Subagent Context

**Task**: Integration and polish

**Files to modify**:

1. `packages/ui-web/src/interaction/KeyboardHandler.ts` - Complete integration
1. `packages/ui-web/src/main.ts` - Wire up new behaviors
1. Update all test files as specified above

**Key implementation points**:

- Proper mode transition handling
- Command routing based on current mode
- Performance optimization for large selections
- Comprehensive test coverage

This enhanced plan provides specific file locations, line numbers where applicable, and detailed context for each implementation phase, making it clear for subagents exactly what needs to be done and where.
