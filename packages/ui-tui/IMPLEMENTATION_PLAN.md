# GridCore TUI Implementation Plan with OpenTUI

## Overview

This document outlines the implementation plan for building a Terminal User Interface (TUI) for GridCore using the OpenTUI framework. The TUI will provide a full-featured spreadsheet experience in the terminal, matching the core functionality of the web UI while being optimized for terminal environments.

## Phase 1: Setup & Dependencies (Week 1)

### 1.1 Install OpenTUI
- Add `@opentui/core` as a dependency to ui-tui package
- Configure Zig build requirements for platform-specific libraries
- Set up development environment with Bun runtime

### 1.2 Core Architecture Setup
Create modular component structure:
```
ui-tui/src/
├── components/
│   ├── Grid.ts           # Main grid display component
│   ├── CellEditor.ts     # Cell editing component
│   ├── FormulaBar.ts     # Formula input bar
│   ├── StatusBar.ts      # Status and mode indicator
│   └── MenuBar.ts        # Top menu navigation
├── modes/
│   ├── NormalMode.ts     # Default navigation mode
│   ├── EditMode.ts       # Cell editing mode
│   └── CommandMode.ts    # Command input mode
├── rendering/
│   ├── GridRenderer.ts   # Grid rendering logic
│   └── Theme.ts          # Color schemes and styling
├── interaction/
│   ├── KeyboardHandler.ts
│   └── SelectionManager.ts
└── state/
    └── TUIState.ts       # TUI-specific state management
```

## Phase 2: Core Components (Week 2)

### 2.1 Main Application Structure
```typescript
class SpreadsheetTUI extends Renderable {
  private spreadsheet: SpreadsheetEngine
  private grid: GridComponent
  private formulaBar: FormulaBarComponent
  private statusBar: StatusBarComponent
  private currentMode: Mode
}
```

### 2.2 Grid Display Component
- Implement scrollable grid view with viewport management
- Display cell values with proper alignment and formatting
- Show row/column headers with highlighting
- Handle cell overflow and text truncation
- Support Unicode and multi-byte characters

### 2.3 Cell Selection & Navigation
- Implement cursor movement (arrow keys, hjkl for Vim users)
- Cell selection highlighting
- Range selection (Shift+arrows)
- Jump to cell (Ctrl+G)
- Page up/down navigation

## Phase 3: Interactive Features (Week 3)

### 3.1 Cell Editing
- Edit mode activation (Enter, F2, or 'i' in Vim mode)
- In-cell text editing with cursor movement
- Formula autocompletion hints
- Escape to cancel, Enter to confirm
- Tab/Shift+Tab for next/previous cell

### 3.2 Formula Bar
- Display current cell address and contents
- Allow formula editing with syntax highlighting
- Show formula evaluation errors
- Support for multi-line formulas

### 3.3 Keyboard Shortcuts
- Ctrl+C/V/X for copy/paste/cut
- Ctrl+Z/Y for undo/redo
- Ctrl+S for save (if file operations added)
- Ctrl+F for find
- F1 for help overlay

## Phase 4: Advanced Features (Week 4)

### 4.1 Vim Mode Support (Optional)
- Normal mode: navigation with hjkl
- Visual mode: v for character selection, V for line selection
- Command mode: : for commands
- Common Vim commands: dd (delete row), yy (copy row), p (paste)

### 4.2 Status Bar Information
- Current cell address and value
- Current mode indicator
- Formula evaluation status
- Grid dimensions
- Memory usage indicator

### 4.3 Data Operations
- Sort functionality (by column)
- Filter views
- Find and replace
- Basic pivot table display

## Phase 5: Performance & Polish (Week 5)

### 5.1 Rendering Optimization
- Implement virtual scrolling for large datasets
- Dirty rectangle optimization
- Double buffering for smooth updates
- Efficient redraws on data changes

### 5.2 Theme Support
- Light and dark themes
- Customizable color schemes
- High contrast mode
- Support for 256-color and true color terminals

### 5.3 Error Handling
- Graceful handling of formula errors
- Clear error messages in status bar
- Recovery from rendering issues

## Technical Implementation Details

### Key OpenTUI Integration Points
1. Extend `Renderable` for all visual components
2. Use `OptimizedBuffer` for efficient text rendering
3. Implement proper z-index layering for overlays
4. Handle terminal resize events
5. Manage focus between components

### State Management
- Integrate with SpreadsheetEngine's event system
- Maintain TUI-specific state (cursor position, selection, mode)
- Sync data changes between engine and display

### Testing Strategy
- Unit tests for each component
- Integration tests for keyboard interactions
- Visual regression tests using terminal snapshots
- Performance benchmarks for large grids

### Example Code Structure
```typescript
import { Renderable, OptimizedBuffer, RGBA } from "@opentui/core"
import { SpreadsheetEngine, CellAddress } from "@gridcore/core"

class GridComponent extends Renderable {
  constructor(
    private engine: SpreadsheetEngine,
    private viewport: { rows: number; cols: number }
  ) {
    super("grid")
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    // Render grid lines
    this.renderGridLines(buffer)
    
    // Render headers
    this.renderHeaders(buffer)
    
    // Render visible cells
    this.renderCells(buffer)
    
    // Render selection
    this.renderSelection(buffer)
  }
  
  private renderGridLines(buffer: OptimizedBuffer): void {
    // Implementation
  }
  
  private renderHeaders(buffer: OptimizedBuffer): void {
    // Row and column headers
  }
  
  private renderCells(buffer: OptimizedBuffer): void {
    // Cell content rendering
  }
  
  private renderSelection(buffer: OptimizedBuffer): void {
    // Selection highlighting
  }
}
```

### Dependencies to Add
```json
{
  "dependencies": {
    "@opentui/core": "latest",
    "@gridcore/core": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.3"
  }
}
```

### Build Configuration
- Update build scripts to handle Zig compilation
- Configure TypeScript for OpenTUI types
- Set up hot reload for development

### Development Commands
```bash
# Install dependencies
bun install

# Build OpenTUI platform libraries
bun build:prod

# Run development server
bun dev

# Run tests
bun test

# Build for production
bun build
```

## Implementation Priority

1. **MVP (Minimum Viable Product)**
   - Basic grid rendering
   - Cell navigation
   - Simple cell editing
   - Formula bar display

2. **Core Features**
   - Formula evaluation
   - Copy/paste functionality
   - Undo/redo
   - Cell formatting display

3. **Advanced Features**
   - Vim mode
   - Themes
   - Advanced navigation
   - Performance optimizations

## Considerations

### Terminal Compatibility
- Test on major terminals (iTerm2, Terminal.app, Windows Terminal, etc.)
- Handle different terminal capabilities gracefully
- Support both mouse and keyboard-only interaction

### Performance Goals
- Handle grids up to 10,000 x 1,000 cells
- Smooth scrolling at 60 FPS
- Instant cell navigation
- Sub-100ms formula evaluation feedback

### Accessibility
- Screen reader support where possible
- High contrast themes
- Keyboard-only navigation
- Clear status messages

## Success Metrics
- Feature parity with core web UI functionality
- Response time < 50ms for user interactions
- Memory usage < 100MB for typical spreadsheets
- Zero flickering during updates
- Intuitive keyboard navigation

## Future Enhancements
- Multi-sheet support
- Chart visualization (using Unicode/ASCII)
- Collaborative editing indicators
- Import/export functionality
- Macro recording and playback