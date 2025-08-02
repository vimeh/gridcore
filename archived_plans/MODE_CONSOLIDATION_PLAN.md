# Mode Consolidation Plan for GridCore

## Overview

This document outlines a comprehensive plan to consolidate the multiple overlapping mode systems in the gridcore codebase into a single, unified source of truth. This refactoring will eliminate code duplication, improve maintainability, and create a more robust mode management system.

## Current Problem Analysis

The gridcore codebase currently has multiple mode systems spread across different files, creating complexity and potential synchronization issues:

### Existing Mode Systems

1. **SpreadsheetModeStateMachine** (`packages/ui-web/src/state/SpreadsheetMode.ts`)

   - Core state machine with hierarchical modes
   - `GridMode`: `"navigation"` | `"editing"`
   - `CellMode`: `"normal"` | `"insert"` | `"visual"` | `"visual-line"`
   - Event-driven transitions with proper state management
   - **Status**: This is the most complete and should be the foundation

1. **VimMode** (`packages/ui-web/src/interaction/VimMode.ts`)

   - Complete vim editor implementation
   - `VimModeType`: `"normal"` | `"insert"` | `"visual"` | `"visual-line"` (DUPLICATE)
   - Internal state management with text manipulation
   - Complex vim keybinding logic
   - **Issue**: Duplicates mode types and state management

1. **CellEditor** (`packages/ui-web/src/components/CellEditor.ts`)

   - Edit mode variants: `"insert"` | `"append"` | `"replace"`
   - Integrates VimMode with contentEditable
   - Manages mode synchronization between vim and spreadsheet
   - **Issue**: Multiple mode management layers

1. **CanvasGrid** (`packages/ui-web/src/components/CanvasGrid.ts`)

   - `InteractionMode`: `"normal"` | `"keyboard-only"`
   - High-level interaction behavior control
   - **Issue**: Separate mode system for interaction style

1. **KeyboardHandler** (`packages/ui-web/src/interaction/KeyboardHandler.ts`)

   - Mode-aware navigation logic
   - Handles transitions between navigation and editing
   - **Issue**: Mode logic scattered across components

### Problems Created

- **Type duplication**: `VimModeType` vs `CellMode` are identical
- **State synchronization**: Multiple components managing similar state
- **Complexity**: Mode logic scattered across multiple files
- **Maintenance burden**: Changes require updates in multiple places
- **Testing difficulty**: Mode behavior split across components

## Consolidation Strategy

### Core Principle

Use `SpreadsheetModeStateMachine` as the single source of truth for ALL mode state, while keeping component-specific behavior handlers stateless.

### Phase 1: Enhance Unified Mode System

**File**: `packages/ui-web/src/state/SpreadsheetMode.ts`

1. **Expand mode types to include all current modes**:

   ```typescript
   export type GridMode = "navigation" | "editing"
   export type CellMode = "normal" | "insert" | "visual" | "visual-line"
   export type EditMode = "insert" | "append" | "replace"
   export type InteractionMode = "normal" | "keyboard-only"

   export interface SpreadsheetState {
     gridMode: GridMode
     cellMode: CellMode
     editMode?: EditMode  // Only relevant when cellMode is "insert"
     interactionMode: InteractionMode
     // ... existing fields
   }
   ```

1. **Add comprehensive transition events**:

   ```typescript
   export type ModeTransitionEvent =
     | { type: "START_EDITING"; editMode?: EditMode }
     | { type: "STOP_EDITING"; commit: boolean }
     | { type: "ENTER_INSERT_MODE"; editMode?: EditMode }
     | { type: "EXIT_INSERT_MODE" }
     | { type: "ENTER_VISUAL_MODE"; visualType: "character" | "line" }
     | { type: "EXIT_VISUAL_MODE" }
     | { type: "TOGGLE_INTERACTION_MODE" }
     | { type: "SET_INTERACTION_MODE"; mode: InteractionMode }
     | { type: "ESCAPE" }
   ```

1. **Add mode validation and constraints**

1. **Add comprehensive state queries and utilities**

### Phase 2: Create Mode Manager API

**New File**: `packages/ui-web/src/state/ModeManager.ts`

Create a high-level API that wraps the state machine:

```typescript
export class ModeManager {
  constructor(private stateMachine: SpreadsheetModeStateMachine) {}
  
  // High-level mode queries
  isNavigating(): boolean
  isEditing(): boolean
  isInInsertMode(): boolean
  isInVisualMode(): boolean
  getCurrentEditMode(): EditMode | null
  
  // Transition helpers
  startEditing(editMode?: EditMode): boolean
  stopEditing(commit: boolean): boolean
  enterInsertMode(editMode?: EditMode): boolean
  exitInsertMode(): boolean
  
  // Event subscription
  onModeChange(callback: ModeChangeCallback): () => void
}
```

### Phase 3: Refactor VimMode to Stateless Handler

**File**: `packages/ui-web/src/interaction/VimMode.ts`

1. **Remove internal mode state**:

   - Remove `VimState.mode`
   - Remove `VimModeType` export (use centralized types)
   - Remove mode change management

1. **Convert to pure behavior handler**:

   ```typescript
   export interface VimBehaviorCallbacks {
     onModeChangeRequest: (mode: CellMode, editMode?: EditMode) => void
     onCursorMove: (position: number) => void
     onTextChange: (text: string, cursor: number) => void
   }

   export class VimBehavior {
     constructor(
       private callbacks: VimBehaviorCallbacks,
       private getCurrentMode: () => CellMode
     ) {}
     
     handleKey(key: string, ctrl: boolean, shift: boolean): boolean {
       const currentMode = this.getCurrentMode()
       // Handle vim keybindings based on current mode
       // Emit mode change requests instead of managing state
     }
   }
   ```

### Phase 4: Update Components

**CellEditor** (`packages/ui-web/src/components/CellEditor.ts`):

1. Remove internal vim mode management
1. Subscribe to mode changes from ModeManager
1. Use VimBehavior instead of VimMode
1. Remove edit mode variants (use centralized EditMode)

**CanvasGrid** (`packages/ui-web/src/components/CanvasGrid.ts`):

1. Remove `InteractionMode` property
1. Use ModeManager for all mode queries
1. Update interaction mode through ModeManager

**KeyboardHandler** (`packages/ui-web/src/interaction/KeyboardHandler.ts`):

1. Remove mode logic
1. Query mode state from ModeManager
1. Request mode transitions through ModeManager

**ModeIndicator** (`packages/ui-web/src/components/ModeIndicator.ts`):

1. Update to display unified mode state
1. Subscribe to ModeManager for changes

### Phase 5: Integration Points

**Main Application** (`packages/ui-web/src/main.ts`):

1. Create single ModeManager instance
1. Pass to all components that need mode awareness
1. Remove duplicate mode state initialization

**Testing**:

1. Create comprehensive tests for ModeManager
1. Test mode transitions and constraints
1. Test component integration with unified system

## Implementation Steps

### Step 1: Extend SpreadsheetModeStateMachine

- [ ] Add InteractionMode and EditMode to state
- [ ] Add new transition events
- [ ] Add mode validation logic
- [ ] Add comprehensive state queries
- [ ] Update existing transition logic

### Step 2: Create ModeManager

- [ ] Implement ModeManager wrapper class
- [ ] Add high-level mode query methods
- [ ] Add transition helper methods
- [ ] Add event subscription system
- [ ] Add comprehensive tests

### Step 3: Refactor VimMode

- [ ] Create VimBehavior class (stateless)
- [ ] Remove internal mode state management
- [ ] Convert to callback-based mode requests
- [ ] Update keybinding handling logic
- [ ] Preserve all existing vim functionality

### Step 4: Update CellEditor

- [ ] Remove VimMode dependency
- [ ] Integrate with ModeManager
- [ ] Use VimBehavior instead of VimMode
- [ ] Remove duplicate mode management
- [ ] Update mode change handlers

### Step 5: Update Other Components

- [ ] CanvasGrid: Use ModeManager for InteractionMode
- [ ] KeyboardHandler: Remove mode logic, use ModeManager
- [ ] ModeIndicator: Display unified mode state
- [ ] Update any other mode-aware components

### Step 6: Integration and Testing

- [ ] Update main.ts to use unified system
- [ ] Create comprehensive integration tests
- [ ] Test all mode transitions work correctly
- [ ] Verify no functionality is lost
- [ ] Performance testing for mode changes

### Step 7: Cleanup

- [ ] Remove old mode-related code
- [ ] Remove duplicate type definitions
- [ ] Update documentation
- [ ] Code review and optimization

## File Locations Reference

### Primary Files to Modify

- `packages/ui-web/src/state/SpreadsheetMode.ts` - Extend with all mode types
- `packages/ui-web/src/state/ModeManager.ts` - New wrapper API (CREATE)
- `packages/ui-web/src/interaction/VimMode.ts` - Convert to stateless behavior
- `packages/ui-web/src/components/CellEditor.ts` - Remove mode management
- `packages/ui-web/src/components/CanvasGrid.ts` - Use unified InteractionMode
- `packages/ui-web/src/interaction/KeyboardHandler.ts` - Remove mode logic
- `packages/ui-web/src/components/ModeIndicator.ts` - Display unified state
- `packages/ui-web/src/main.ts` - Integration point

### Test Files to Update

- `packages/ui-web/tests/vim-mode.spec.ts` - Update for new architecture
- `packages/ui-web/tests/vim-mode-fixes.spec.ts` - Update for new architecture
- Add comprehensive tests for ModeManager

### Additional Context Files

- `packages/ui-web/src/constants.ts` - Key codes used in mode handling
- `packages/ui-web/src/components/Viewport.ts` - Used by CellEditor
- `packages/ui-web/src/interaction/SelectionManager.ts` - Used by KeyboardHandler

## Benefits

### Immediate Benefits

- **Single source of truth** for all mode state
- **Eliminated code duplication** (VimModeType vs CellMode)
- **Simplified component logic** with clear separation of concerns
- **Type safety** with centralized mode definitions
- **Easier testing** with isolated mode logic

### Long-term Benefits

- **Better maintainability** with unified mode system
- **Easier feature additions** (new modes, transitions)
- **Consistent behavior** across all components
- **Reduced complexity** in individual components
- **Improved debugging** with centralized mode logic

## Risk Mitigation

### Backwards Compatibility

- Preserve all existing functionality during refactoring
- Maintain existing public APIs where possible
- Comprehensive testing to ensure no regressions

### Incremental Implementation

- Implement changes in phases to minimize risk
- Test each phase thoroughly before proceeding
- Maintain working system throughout refactoring

### Rollback Plan

- Keep original code in version control
- Implement behind feature flags if necessary
- Have clear rollback procedures for each phase

## Success Criteria

- [ ] All mode-related logic uses single source of truth
- [ ] No duplicate mode type definitions
- [ ] All existing functionality preserved
- [ ] Comprehensive test coverage for mode system
- [ ] Simplified component architecture
- [ ] Improved code maintainability
- [ ] No performance regressions

______________________________________________________________________

## Notes for Implementation

- Use the existing `SpreadsheetModeStateMachine` as the foundation - it's the most complete
- Preserve all vim functionality while making VimMode stateless
- Test extensively - the mode system is critical to user experience
- Consider adding mode debugging tools during development
- Pay special attention to mode transition edge cases
- Ensure proper TypeScript types throughout the refactoring

This consolidation will create a robust, maintainable mode system that serves as a solid foundation for future enhancements while eliminating the current technical debt around mode management.

