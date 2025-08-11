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

### Phase 2: Active Cell & Mode Consolidation 🚧

- [ ] Replace active_cell signal with derived memo from controller
- [ ] Consolidate current_mode tracking
- [ ] Update all components to use controller state

### Phase 3: Formula Bar Migration

- [ ] Add formula bar state to controller
- [ ] Create FormulaBarUpdate action
- [ ] Move submission logic to controller
- [ ] Remove formula_value signal

### Phase 4: Selection & Stats

- [ ] Use controller's selection stats directly
- [ ] Remove selection_stats signal
- [ ] Update StatusBar component

### Phase 5: Sheet Management

- [ ] Add sheet list to SpreadsheetFacade
- [ ] Implement sheet CRUD operations
- [ ] Add sheet events to controller
- [ ] Remove sheets signal

### Phase 6: Canvas Grid Simplification

- [ ] Derive editing_mode from UIState
- [ ] Get cell_position from ViewportManager
- [ ] Derive cursor_style from controller state
- [ ] Remove local signals

### Phase 7: Error Consolidation

- [ ] Add error queue to controller
- [ ] Centralize error dispatching
- [ ] Remove error signals from UI

### Phase 8: Viewport Direct Access

- [ ] Remove viewport wrapper signal
- [ ] Direct ViewportManager access
- [ ] Update rendering to use controller

## Progress Tracking

| Component  | Signals Before | Signals After | Status      |
| ---------- | -------------- | ------------- | ----------- |
| App.rs     | 10             | 2             | In Progress |
| CanvasGrid | 5              | 0             | Pending     |
| CellEditor | 2              | 0             | Pending     |
| TabBar     | 4              | 0             | Pending     |
| StatusBar  | 0              | 0             | Complete    |

## Metrics

- **Total Signals Before**: ~15
- **Target Signals After**: 2-3
- **Code Reduction**: ~500 lines
- **Performance**: Fewer reactive updates

## Testing Checklist

- [ ] All keyboard navigation works
- [ ] Formula bar updates correctly
- [ ] Mode transitions smooth
- [ ] Cell editing functional
- [ ] Selection stats accurate
- [ ] Error display works
- [ ] Canvas renders correctly
- [ ] Sheet switching works

## Notes

- Controller becomes single source of truth
- UI layer only renders, no business logic
- All state changes through Actions
- Events drive UI updates

