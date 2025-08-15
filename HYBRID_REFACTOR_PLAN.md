# Hybrid State Management Refactoring Plan

## Overview

Refactor from pure FSM approach to hybrid model: FSM for modes, direct fields for data state.

### Goals

- Fix visual mode selection rendering
- Simplify state access patterns
- Reduce boilerplate and action explosion
- Improve code locality and readability
- Remove legacy/dead code

### Non-Goals

- Maintain backwards compatibility (clean break)
- Preserve every FSM guarantee (pragmatism over purity)

## Architecture Changes

### Before: Everything is State

```rust
UIState::Navigation { 
    core: CoreState { cursor, viewport },
    selection: Option<Selection>,
    modal: Option<NavigationModal::Visual { selection, .. }>
}
// Deep nesting, hard to access, duplicate selection tracking
```

### After: Modes vs Data

```rust
struct SpreadsheetController {
    // Mode (FSM) - what the user is doing
    mode: EditorMode,
    
    // Data (Direct) - current values
    cursor: CellAddress,
    selection: Option<Selection>,
    viewport: ViewportInfo,
    
    // Subsystems - own their state
    vim: VimState,
    formula_bar: String,
}

enum EditorMode {
    Navigation,
    Editing { value: String, cursor_pos: usize },
    Command { value: String },
}
```

## Phase 1: Prepare and Test Current State

### 1.1 Create Integration Tests

**File**: `gridcore-controller/tests/visual_mode_tests.rs`

```rust
#[test]
fn test_visual_mode_selection() {
    let mut controller = SpreadsheetController::new();
    
    // Enter visual mode
    controller.handle_keyboard_event(key_event("v"));
    assert_eq!(controller.get_mode(), Mode::Visual);
    
    // Move right to extend selection
    controller.handle_keyboard_event(key_event("l"));
    let selection = controller.get_selection().unwrap();
    assert_eq!(selection.range(), (CellAddress::A1, CellAddress::B1));
    
    // Verify selection is visible in UI state
    assert!(controller.get_ui_state().has_selection());
}
```

### 1.2 Document Current Behavior

```bash
# Run and save current test results
cargo test --package gridcore-controller > tests_before.txt

# Document current API
grep -r "pub fn" gridcore-controller/src/controller/ > api_before.txt
```

### Git Commit 1

```bash
git add -A
git commit -m "test: add integration tests for visual mode selection

- Document current (broken) behavior
- Establish baseline for refactoring
- Add API documentation"
```

## Phase 2: Extract Data from State

### 2.1 Add Direct Fields to Controller

**File**: `gridcore-controller/src/controller/spreadsheet.rs`

```rust
pub struct SpreadsheetController {
    // Existing fields
    facade: SpreadsheetFacade,
    state_machine: UIStateMachine,
    
    // NEW: Direct data fields
    cursor: CellAddress,
    selection: Option<Selection>,
    viewport: ViewportInfo,
    formula_bar: String,
    
    // NEW: Mode tracking
    mode: EditorMode,
    
    // Keep existing managers
    vim_behavior: Option<VimBehavior>,
    // ...
}
```

### 2.2 Create New Mode Enum

**File**: `gridcore-controller/src/controller/mode.rs`

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum EditorMode {
    Navigation,
    Editing {
        value: String,
        cursor_pos: usize,
        insert_mode: Option<InsertMode>,
    },
    Command {
        value: String,
    },
    Visual {
        mode: VisualMode,
        anchor: CellAddress,
    },
}

impl EditorMode {
    pub fn is_editing(&self) -> bool {
        matches!(self, EditorMode::Editing { .. })
    }
    
    pub fn is_visual(&self) -> bool {
        matches!(self, EditorMode::Visual { .. })
    }
}
```

### 2.3 Add Direct Accessors

```rust
impl SpreadsheetController {
    // Simple, direct access
    pub fn cursor(&self) -> CellAddress { self.cursor }
    pub fn selection(&self) -> Option<&Selection> { self.selection.as_ref() }
    pub fn mode(&self) -> &EditorMode { &self.mode }
    
    // Direct mutations with events
    pub fn set_cursor(&mut self, cursor: CellAddress) {
        let old = self.cursor;
        self.cursor = cursor;
        self.emit_event(Event::CursorMoved { from: old, to: cursor });
    }
    
    pub fn set_selection(&mut self, selection: Option<Selection>) {
        let old = self.selection.clone();
        self.selection = selection.clone();
        self.emit_event(Event::SelectionChanged { old, new: selection });
    }
}
```

### Git Commit 2

```bash
git add -A
git commit -m "refactor: add direct state fields to controller

- Add cursor, selection, viewport, mode fields
- Create EditorMode enum for simple mode tracking
- Add direct accessors for common operations"
```

## Phase 3: Refactor Input Handling

### 3.1 Simplify Visual Mode Handler

**File**: `gridcore-controller/src/controller/input_handler.rs`

```rust
fn handle_visual_key(&mut self, event: KeyboardEvent) -> Result<()> {
    let key = event.key.as_str();
    
    // Let vim behavior calculate new selection
    if let Some(vim) = &mut self.controller.vim_behavior {
        match vim.handle_visual_key(key, self.controller.cursor) {
            VisualAction::ExtendSelection(new_cursor) => {
                // Direct update - no action dispatch needed
                if let EditorMode::Visual { anchor, .. } = &self.controller.mode {
                    let selection = Selection::from_range(*anchor, new_cursor);
                    self.controller.set_selection(Some(selection));
                    self.controller.set_cursor(new_cursor);
                }
            }
            VisualAction::Exit => {
                self.controller.mode = EditorMode::Navigation;
                self.controller.set_selection(None);
            }
            VisualAction::None => {}
        }
    }
    
    Ok(())
}
```

### 3.2 Simplify Navigation Handler

```rust
fn handle_navigation_key(&mut self, event: KeyboardEvent) -> Result<()> {
    match event.key.as_str() {
        // Direct mode changes
        "v" => {
            self.controller.mode = EditorMode::Visual {
                mode: VisualMode::Character,
                anchor: self.controller.cursor,
            };
            self.controller.set_selection(Some(Selection::single(self.controller.cursor)));
        }
        
        "i" => {
            let value = self.controller.get_cell_value(self.controller.cursor);
            self.controller.mode = EditorMode::Editing {
                value,
                cursor_pos: 0,
                insert_mode: Some(InsertMode::I),
            };
        }
        
        // Direct cursor movement
        "h" | "ArrowLeft" => self.move_cursor(-1, 0),
        "l" | "ArrowRight" => self.move_cursor(1, 0),
        "j" | "ArrowDown" => self.move_cursor(0, 1),
        "k" | "ArrowUp" => self.move_cursor(0, -1),
        
        _ => {}
    }
    Ok(())
}

fn move_cursor(&mut self, dx: i32, dy: i32) {
    let new_cursor = CellAddress::new(
        (self.controller.cursor.col as i32 + dx).max(0) as u32,
        (self.controller.cursor.row as i32 + dy).max(0) as u32,
    );
    self.controller.set_cursor(new_cursor);
}
```

### Git Commit 3

```bash
git add -A
git commit -m "refactor: simplify input handling with direct state updates

- Remove action dispatch for simple state changes
- Update visual mode to directly modify selection
- Simplify cursor movement logic"
```

## Phase 4: Update UI Rendering

### 4.1 Update Canvas Grid Component

**File**: `gridcore-ui/src/components/canvas_grid.rs`

```rust
#[component]
pub fn CanvasGrid() -> impl IntoView {
    let controller = use_context::<Rc<RefCell<SpreadsheetController>>>().unwrap();
    
    // Direct access to state
    let cursor = create_memo(move |_| {
        controller.borrow().cursor()
    });
    
    let selection = create_memo(move |_| {
        controller.borrow().selection().cloned()
    });
    
    let mode = create_memo(move |_| {
        controller.borrow().mode().clone()
    });
    
    // Render with selection
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            render_grid(
                &canvas,
                viewport,
                cursor.get(),
                selection.get(),  // Now directly available
                facade,
                device_pixel_ratio,
            );
        }
    });
}
```

### 4.2 Add Selection Rendering

**File**: `gridcore-ui/src/components/canvas_grid.rs`

```rust
fn render_grid(
    canvas: &HtmlCanvasElement,
    viewport: &Viewport,
    active_cell: CellAddress,
    selection: Option<Selection>,  // NEW parameter
    facade: &SpreadsheetFacade,
    device_pixel_ratio: f64,
) {
    // ... existing setup ...
    
    // Render selection BEFORE active cell
    if let Some(sel) = selection {
        render_selection(&ctx, &sel, viewport, &theme);
    }
    
    // ... render cells ...
    
    // Render active cell border (on top)
    render_active_cell(&ctx, active_cell, viewport, &theme);
}

fn render_selection(
    ctx: &CanvasRenderingContext2d,
    selection: &Selection,
    viewport: &Viewport,
    theme: &GridTheme,
) {
    ctx.set_fill_style_str("rgba(0, 120, 215, 0.2)"); // Semi-transparent blue
    
    match &selection.selection_type {
        SelectionType::Range { start, end } => {
            // Calculate bounds
            let min_col = start.col.min(end.col);
            let max_col = start.col.max(end.col);
            let min_row = start.row.min(end.row);
            let max_row = start.row.max(end.row);
            
            // Get positions
            let x1 = viewport.get_column_x(min_col as usize);
            let x2 = viewport.get_column_x(max_col as usize + 1);
            let y1 = viewport.get_row_y(min_row as usize);
            let y2 = viewport.get_row_y(max_row as usize + 1);
            
            // Draw filled rectangle
            ctx.fill_rect(x1, y1, x2 - x1, y2 - y1);
            
            // Draw border
            ctx.set_stroke_style_str("rgba(0, 120, 215, 0.8)");
            ctx.set_line_width(2.0);
            ctx.stroke_rect(x1, y1, x2 - x1, y2 - y1);
        }
        SelectionType::Cell { address } => {
            // Single cell selection - just highlight
            let pos = viewport.get_cell_position(address);
            ctx.fill_rect(pos.x, pos.y, pos.width, pos.height);
        }
        SelectionType::Row { rows } => {
            // Highlight entire rows
            for row in rows {
                let y = viewport.get_row_y(*row as usize);
                let height = viewport.get_row_height(*row as usize);
                ctx.fill_rect(0.0, y, viewport.width(), height);
            }
        }
        SelectionType::Column { columns } => {
            // Highlight entire columns
            for col in columns {
                let x = viewport.get_column_x(*col as usize);
                let width = viewport.get_column_width(*col as usize);
                ctx.fill_rect(x, 0.0, width, viewport.height());
            }
        }
    }
}
```

### Git Commit 4

```bash
git add -A
git commit -m "feat: add selection rendering to canvas grid

- Pass selection directly to render function
- Implement visual selection rendering with semi-transparent overlay
- Support all selection types (range, row, column)"
```

## Phase 5: Remove Legacy Code

### 5.1 Remove Old State Machine

**Remove files:**

- `gridcore-controller/src/state/machine.rs`
- `gridcore-controller/src/state/transitions.rs`
- `gridcore-controller/src/state/transition_handlers/`

**Simplify**: `gridcore-controller/src/state/mod.rs`

```rust
// Keep only essential types
pub use spreadsheet::{Selection, SelectionType, VisualMode};
pub use actions::Action;  // Slim down to only needed actions

// Remove UIStateMachine, TransitionResult, etc.
```

### 5.2 Remove Redundant Actions

**File**: `gridcore-controller/src/state/actions.rs`

Keep only:

- Actions that trigger complex operations (undo, redo, fill)
- Actions that need validation
- Actions that affect multiple systems

Remove:

- UpdateCursor (use set_cursor directly)
- UpdateSelection (use set_selection directly)
- UpdateViewport (use viewport manager directly)
- EnterSpreadsheetVisualMode (use mode setter)

### 5.3 Clean Up VIM Behavior

**File**: `gridcore-controller/src/behaviors/vim/`

Simplify to return simple results instead of Actions:

```rust
pub enum VimResult {
    MoveCursor(CellAddress),
    SetSelection(Selection),
    ChangeMode(EditorMode),
    ExecuteCommand(String),
    None,
}
```

### 5.4 Remove Facade Pattern Indirection

Remove:

- `controller/operations.rs`
- CellOperations, SheetOperations traits

Move essential methods directly to SpreadsheetController.

### Git Commit 5

```bash
git add -A
git commit -m "refactor: remove legacy FSM code and simplify architecture

- Remove UIStateMachine and transition handlers
- Eliminate redundant Action variants
- Simplify VIM behavior to return direct results
- Remove facade pattern indirection"
```

## Phase 6: Testing and Validation

### 6.1 Update Tests

```rust
// Before: Complex state setup
let state = UIState::Navigation {
    core: CoreState::new(cursor, viewport),
    selection: None,
    modal: Some(NavigationModal::Visual { .. }),
};

// After: Simple direct testing
let mut controller = SpreadsheetController::new();
controller.set_mode(EditorMode::Visual { .. });
controller.set_selection(Some(selection));
assert_eq!(controller.selection(), Some(&selection));
```

### 6.2 Test Visual Mode End-to-End

```bash
# Run integration tests
cargo test visual_mode --package gridcore-controller

# Test in browser
cd gridcore-ui
trunk serve
# Manually test: Press v, then hjkl - selection should be visible
```

### 6.3 Performance Testing

```rust
#[bench]
fn bench_visual_mode_selection() {
    let mut controller = SpreadsheetController::new();
    controller.enter_visual_mode();
    
    b.iter(|| {
        controller.extend_selection(Direction::Right);
    });
}
```

### Git Commit 6

```bash
git add -A
git commit -m "test: update tests for hybrid architecture

- Simplify test setup with direct state access
- Add visual mode end-to-end tests
- Add performance benchmarks"
```

## Phase 7: Documentation and Cleanup

### 7.1 Update Public API Documentation

**File**: `gridcore-controller/src/lib.rs`

```rust
//! # GridCore Controller
//! 
//! Hybrid state management approach:
//! - EditorMode enum for user interaction modes
//! - Direct fields for frequently accessed data
//! - Event system for UI reactivity
```

### 7.2 Remove Dead Code

```bash
# Find unused code
cargo +nightly udeps
cargo clippy --all-targets --all-features -- -W clippy::dead_code

# Remove identified dead code
```

### 7.3 Update Architecture Docs

**File**: `ARCHITECTURE.md`

- Document hybrid approach
- Explain when to use modes vs direct fields
- Show data flow from input to rendering

### Git Commit 7

```bash
git add -A
git commit -m "docs: update documentation for hybrid architecture

- Document new state management approach
- Remove dead code identified by clippy
- Update architecture diagrams"
```

## Migration Checklist

### Pre-refactor

- [ ] Create feature branch: `git checkout -b hybrid-state-refactor`
- [ ] Run current tests and save results
- [ ] Document current API

### Phase 1: Testing

- [ ] Write integration tests for visual mode
- [ ] Document expected behavior
- [ ] Commit: test foundation

### Phase 2: Add Direct State

- [ ] Add direct fields to controller
- [ ] Create EditorMode enum
- [ ] Add accessors
- [ ] Commit: direct state fields

### Phase 3: Input Handling

- [ ] Refactor visual mode handler
- [ ] Simplify navigation handler
- [ ] Remove action dispatch for simple updates
- [ ] Commit: simplified input

### Phase 4: UI Rendering

- [ ] Update canvas grid to use direct state
- [ ] Implement selection rendering
- [ ] Test visual feedback
- [ ] Commit: selection rendering

### Phase 5: Remove Legacy

- [ ] Delete old state machine files
- [ ] Remove redundant actions
- [ ] Simplify VIM behavior
- [ ] Remove facade indirection
- [ ] Commit: legacy removal

### Phase 6: Testing

- [ ] Update all tests
- [ ] Run integration tests
- [ ] Manual browser testing
- [ ] Performance testing
- [ ] Commit: test updates

### Phase 7: Documentation

- [ ] Update public API docs
- [ ] Remove dead code
- [ ] Update architecture docs
- [ ] Commit: documentation

### Post-refactor

- [ ] Run `cargo fmt` and `cargo clippy`
- [ ] Full test suite: `cargo test --all`
- [ ] Manual testing of all modes
- [ ] Merge PR: `git merge --no-ff hybrid-state-refactor`

## Success Criteria

1. **Visual mode works**: Can enter visual mode with 'v' and select cells with hjkl
1. **Selection renders**: Selected cells show blue overlay
1. **Simpler code**: Reduced lines of code, fewer files
1. **Better performance**: Direct field access faster than state transitions
1. **All tests pass**: No regression in functionality
1. **Cleaner API**: Fewer public methods, clearer purpose

## Rollback Plan

If issues arise:

```bash
# Save work in progress
git stash

# Return to main branch
git checkout main

# Delete feature branch if needed
git branch -D hybrid-state-refactor

# Or cherry-pick specific fixes
git cherry-pick <commit-hash>
```

## Timeline Estimate

- Phase 1 (Testing): 1 hour
- Phase 2 (Direct State): 2 hours
- Phase 3 (Input): 2 hours
- Phase 4 (UI): 2 hours
- Phase 5 (Legacy): 3 hours
- Phase 6 (Testing): 2 hours
- Phase 7 (Docs): 1 hour

**Total: ~13 hours of focused work**

## Notes

- This is a breaking change - no backwards compatibility
- Focus on simplicity over theoretical purity
- Keep what works (event system, facade for core)
- Remove what doesn't (deep FSM nesting, action explosion)
- Test continuously - each phase should keep tests green

