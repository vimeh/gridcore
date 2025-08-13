Plan: Reduce State Complexity at the Source

## Progress Tracking

**Starting Point**: 33,066 lines of Rust code
**Current**: 32,764 lines of Rust code (-302 lines)
**Target**: ~28,000 lines (-5,000 lines)

### Completed Phases:
- ✅ Phase 2: Remove Duplicate State in UI Layer
  - Removed state_version hack
  - Implemented fine-grained Leptos Triggers
  - Better reactive performance
  
- ✅ Phase 3 (Partial): Convert Managers to Pure Functions
  - ✅ SelectionStatsManager → pure functions (-86 lines)
  - ✅ ResizeManager → pure functions (-145 lines)
    - Eliminated duplicate column_widths/row_heights state
    - Consolidated resize logic in behaviors module
  - ✅ AutocompleteManager → pure functions (-88 lines)
    - Converted to stateless pure functions in behaviors module
    - Static function list using const array

### In Progress:
- 🔄 Phase 3: Convert remaining managers to pure functions
  - SelectionManager (last remaining manager)

### Upcoming:
- Phase 1: Simplify UIState enum
- Phase 4: Unify mode enums
- Phase 5: Simplify Action system

---

Problem Summary

The codebase has 11+ state types, 11+ managers, 47+ actions, and 25+ events, with massive duplication between layers.
The SpreadsheetController is becoming a 1200+ line god object.

Root Causes

1. Artificial state boundaries between UI and controller layers
1. Storing derived state instead of computing it
1. Mode explosion - too many overlapping mode enums
1. Manager pattern overuse - stateless operations wrapped in stateful managers

Solution: Eliminate State at the Source

Phase 1: Simplify UIState Enum (Reduce from 8 to 3 variants)

enum UIState {
Navigation {
cursor: CellAddress,
selection: Option<Selection>,
},
Editing {
cursor: CellAddress,
value: String,
cursor_pos: usize,
},
Modal {
kind: ModalKind, // Command, Resize, Insert, Delete, etc.
data: ModalData, // Specific data for each modal
}
}
This reduces state variants from 8 to 3 core modes that actually matter.

Phase 2: Remove Duplicate State in UI Layer ✅ COMPLETED

1. ✅ Deleted all duplicate signals in app.rs:
   - Removed active_cell, current_mode, formula_bar_value signals  
   - Access state directly from controller via reactive Memos

2. ✅ Created reactive state accessors:
   - Using Memos that derive from controller state
   - No more manual synchronization

3. ✅ Removed state_version hack - using Leptos Triggers:
   - Replaced single state_version with fine-grained triggers
   - cursor_trigger, mode_trigger, formula_trigger, etc.
   - Each memo tracks only relevant triggers
   - Better performance through targeted updates

Phase 3: Convert Managers to Pure Functions

Transform stateful managers into stateless utilities:

// Before: ResizeManager with internal state
struct ResizeManager {
is_resizing: bool,
resize_type: Option<ResizeType>,
// ... more state
}

// After: Pure functions operating on UIState
mod resize {
pub fn start_resize(state: &UIState, target: ResizeTarget) -> UIState
pub fn update_resize(state: &UIState, delta: f64) -> UIState
pub fn end_resize(state: &UIState) -> UIState
}

Do this for:

- ResizeManager → resize functions
- SelectionManager → selection functions
- AutocompleteManager → autocomplete functions
- SelectionStatsManager → calc functions (computed, not stored)

Phase 4: Unify Mode Enums

Collapse overlapping mode types:

- Remove SpreadsheetMode (derive from UIState)
- Merge CellMode into editing state
- Combine VisualMode and SpreadsheetVisualMode
- Use single InsertMode for all insert operations

Phase 5: Simplify Action System

Reduce 47+ actions to ~15 core actions:
enum Action {
// Navigation
MoveCursor(Direction),
SetCursor(CellAddress),

```
// Editing
StartEdit(EditOptions),
UpdateEdit(String, usize),
CommitEdit,
CancelEdit,

// Selection
StartSelection(SelectionType),
ExtendSelection(CellAddress),
ClearSelection,

// Modal operations
OpenModal(ModalKind),
UpdateModal(ModalData),
CloseModal,

// Sheet operations
SheetOp(SheetOperation),
```

}

Phase 6: Direct State Binding in UI

Instead of events + effects + signals:
// Current approach (complex)
Effect::new(move |\_| {
let _ = state_version.get();
controller_stored.with_value(|ctrl| {
let cursor = ctrl.borrow().get_cursor();
if active_cell.get() != cursor {
set_active_cell.set(cursor);
}
});
});

// New approach (simple)
let cursor = create_memo(move |\_|
controller.borrow().get_state().cursor()
);

Phase 7: Flatten Controller Structure

Break up SpreadsheetController into focused modules:
// Instead of god object, compose focused modules
struct SpreadsheetController {
state: UIStateMachine,
facade: SpreadsheetFacade,
}

// Pure function modules
mod navigation { /\* cursor movement */ }
mod editing { /* cell editing */ }
mod selection { /* range selection */ }
mod sheets { /* sheet management \*/ }

Benefits

1. 50-70% less code - Remove duplicate state management
1. Eliminate synchronization bugs - No duplicate state to sync
1. Better performance - No unnecessary copies or updates
1. Clearer architecture - State flows in one direction
1. Easier testing - Test pure functions, not stateful managers

Implementation Order

1. Start with Phase 2 (remove UI duplication) - immediate wins
1. Then Phase 3 (managers → functions) - reduces complexity
1. Then Phase 1 (simplify UIState) - biggest structural change
1. Phases 4-7 can be done incrementally

Key Insight

The root problem isn't WHERE the state lives, but that there's TOO MUCH state and it's DUPLICATED. By eliminating
artificial state and duplication, we solve the real problem without adding more abstraction layers.
