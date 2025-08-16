Controller API Simplification Plan

Current Problems

- 50+ public methods on SpreadsheetController
- 8 public modules with many sub-exports
- Multiple facade patterns (CellOperations, SheetOperations, ErrorOperations, SelectionOperations)
- Redundant getter/setter pairs for the same data
- Scattered event handling across multiple modules

Proposed Simplifications

1. Single Public Interface

Instead of exposing all modules, expose only SpreadsheetController:

Before:
pub mod behaviors;
pub mod controller;
pub mod managers;
pub mod state;
// Plus 20+ re-exports

After:
// Only expose the controller and essential types
pub use controller::SpreadsheetController;
pub use state::{UIState, Action, ViewportInfo};
pub use events::SpreadsheetEvent;

2. Consolidate Operations into Controller

Remove operation facades, move methods directly to controller:

Before:
controller.cells().set_value(&address, value)?;
controller.sheets().add("Sheet2")?;
controller.errors().emit(msg, severity);

After:
controller.set_cell(&address, value)?;
controller.add_sheet("Sheet2")?;
controller.emit_error(msg, severity);

3. Reduce Public Methods to Essential API

Core Navigation & State (5 methods):
pub fn dispatch_action(&mut self, action: Action) -> Result\<()>
pub fn state(&self) -> &UIState
pub fn cursor(&self) -> CellAddress
pub fn handle_keyboard_event(&mut self, event: KeyboardEvent) -> Result\<()>
pub fn handle_mouse_event(&mut self, event: MouseEvent) -> Result\<()>

Data Operations (4 methods):
pub fn get_cell(&self, address: &CellAddress) -> Option<Cell>
pub fn set_cell(&mut self, address: &CellAddress, value: &str) -> Result\<()>
pub fn get_formula_bar(&self) -> &str
pub fn set_formula_bar(&mut self, value: String)

Sheet Management (4 methods):
pub fn sheets(&self) -> Vec\<(String, usize)>
pub fn active_sheet(&self) -> String
pub fn modify_sheet(&mut self, op: SheetOperation) -> Result\<()>
pub fn set_active_sheet(&mut self, name: &str) -> Result\<()>

Events & Errors (3 methods):
pub fn subscribe_events<F>(&mut self, listener: F) -> usize
pub fn errors(&self) -> &[ErrorEntry]
pub fn clear_errors(&mut self)

Total: 16 methods instead of 50+

4. Combine Related Operations

Before (6 methods):
add_sheet(), remove_sheet(), rename_sheet()
get_sheets(), get_active_sheet(), set_active_sheet()

After (2 methods):
pub enum SheetOperation {
Add(String),
Remove(String),
Rename { old: String, new: String }
}

pub fn modify_sheet(&mut self, op: SheetOperation) -> Result\<()>
pub fn sheet_info(&self) -> SheetInfo // Contains all sheet data

5. Hide Internal Managers

Make all managers private, access only through controller:

Before:
pub fn get_viewport_manager(&self) -> &ViewportManager
pub fn get_viewport_manager_mut(&mut self) -> &mut ViewportManager
pub fn get_error_manager(&self) -> &ErrorSystem
pub fn resize_state(&self) -> &ResizeState

After:
// All managers are private
// Viewport operations through dispatch_action()
// Errors through errors() method
// No direct manager access

6. Simplify State Types

Reduce exported state types:

Before:
pub use state::{
Action, EditMode, Selection, SelectionType,
SpreadsheetMode, UIState, UIStateMachine, ViewportInfo,
VisualMode, CoreState, // ... many more
};

After:
pub use state::{UIState, Action, ViewportInfo};
// Everything else is internal

7. Unified Event System

Before:
EventDispatcher, SpreadsheetEvent, KeyboardEvent, MouseEvent
Multiple event creation methods scattered around

After:
pub enum Event {
Keyboard(KeyboardEvent),
Mouse(MouseEvent),
Spreadsheet(SpreadsheetEvent),
}

// Single event handler
pub fn handle_event(&mut self, event: Event) -> Result\<()>

Migration Strategy

1. Phase 1: Mark unnecessary public items as pub(crate)
1. Phase 2: Consolidate operation facades into controller
1. Phase 3: Create deprecation warnings for old API
1. Phase 4: Remove deprecated items after migration period

Benefits

- 80% reduction in public API surface
- Clearer mental model - one controller, simple methods
- Better encapsulation - internals truly hidden
- Easier testing - fewer mocks needed
- Simpler documentation - 16 methods vs 50+
- Type safety - enums for operations instead of strings

This maintains all functionality while drastically simplifying the interface.
