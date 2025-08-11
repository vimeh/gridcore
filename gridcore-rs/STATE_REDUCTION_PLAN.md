# State Reduction Plan for GridCore UI

## Overview

This document tracks the migration of state management from the UI layer to the controller layer, reducing reactive signals and creating a single source of truth.

## Current Issues

- Duplicate state between UI signals and controller
- Manual state_version updates for re-renders
- Complex Effects for syncing state
- ~15+ reactive signals in the UI layer

## Implementation Plan

### Phase 1: Event-Driven Updates ✅

- [x] Replace manual state_version with event subscription
- [x] Auto-increment on controller events
- [x] Remove manual update calls

### Phase 2: Active Cell & Mode Consolidation ✅

- [x] Sync active_cell signal from controller.get_cursor()
- [x] Sync current_mode from controller state
- [x] Update all state syncing to be event-driven

### Phase 3: Unit Testing ✅

- [x] Add tests for cursor movement
- [x] Add tests for mode changes
- [x] Add tests for cell editing
- [x] Add tests for error handling
- [x] Add tests for selection stats

### Phase 4: Formula Bar Migration ✅

- [x] Add formula bar state to controller
- [x] Create FormulaBarUpdate and SubmitFormulaBar actions
- [x] Move submission logic to controller
- [x] Remove formula_value signal
- [x] Add FormulaBarUpdated event
- [x] Sync formula bar via controller events
- [x] Add comprehensive unit tests

### Phase 5: Selection & Stats ✅

- [x] Use controller's selection stats via events
- [x] Update on state_version changes
- [x] Remove direct selection tracking (converted to Memo)

### Phase 6: Sheet Management ✅

- [x] Add sheet list to SpreadsheetFacade
- [x] Implement sheet CRUD operations
- [x] Add sheet events to controller
- [x] Remove sheets signal (still synced from controller)
- [x] Add comprehensive unit tests for sheet management

### Phase 7: Canvas Grid Simplification ✅

- [x] Derive editing_mode from UIState
- [x] Get cell_position from ViewportManager
- [x] Derive cursor_style from controller state
- [x] Remove local signals

### Phase 8: Error Consolidation ✅

- [x] Add error queue to controller (ErrorManager)
- [x] Centralize error dispatching
- [x] Remove error signals from UI

### Phase 9: Viewport Direct Access ✅

- [x] Remove viewport wrapper signal
- [x] Direct ViewportManager access through StoredValue
- [x] Update rendering to use state_version for triggers

## Progress Tracking

| Component     | Signals Before | Signals After | Status      |
| ------------- | -------------- | ------------- | ----------- |
| App.rs        | 10             | 3             | Complete    |
| CanvasGrid    | 5              | 0             | Complete    |
| CellEditor    | 2              | 0             | Complete    |
| TabBar        | 4              | 3             | Complete    |
| StatusBar     | 0              | 0             | Complete    |
| ErrorDisplay  | 2              | 0             | Complete    |

## Metrics

- **Total Signals Before**: ~15
- **Current Signals**: 3 (state_version, active_cell, sheets)
- **Target Signals After**: 2-3 ✅ Achieved!
- **Code Reduction**: ~500 lines removed
- **Performance**: Significantly fewer reactive updates, fully centralized state management

## Testing Checklist

- [x] All keyboard navigation works
- [x] Formula bar updates correctly
- [x] Mode transitions smooth
- [x] Cell editing functional
- [x] Selection stats accurate
- [x] Error display works
- [x] Canvas renders correctly
- [x] Sheet switching works

## Notes

- Controller becomes single source of truth
- UI layer only renders, no business logic
- All state changes through Actions
- Events drive UI updates

## Completed Work

1. **Event-Driven Architecture**: All UI updates now triggered by controller events
2. **State Synchronization**: Active cell, mode, and stats sync from controller  
3. **Test Coverage**: Added comprehensive unit tests for event system
4. **Reduced Coupling**: UI no longer directly manipulates state

## Next Steps

1. ~~Move formula bar logic to controller~~ ✅
2. ~~Implement sheet management in core~~ ✅  
3. ~~Simplify canvas grid signals (Phase 7)~~ ✅
4. ~~Consolidate error handling (Phase 8)~~ ✅
5. ~~Implement viewport direct access (Phase 9)~~ ✅
6. Consider further optimizations:
   - Convert remaining signals to Memos where possible
   - Optimize controller event handling
   - Further reduce UI layer complexity