# GridCore Architecture Refactoring Plan

## Overview
This document outlines the refactoring plan to improve the separation of concerns between the three main layers of the GridCore spreadsheet application:

- **gridcore-core**: Pure spreadsheet engine (formulas, cells, calculations)
- **gridcore-controller**: Spreadsheet interaction logic (viewport, selection, navigation, resize)
- **gridcore-ui**: Pure presentation and event capture (rendering, user input forwarding)

## Current Issues
The UI layer currently contains business logic that should be managed by the controller or core layers. This creates tight coupling and makes it harder to:
- Support multiple UI implementations (web, terminal, native)
- Test business logic independently
- Maintain clear architectural boundaries

## Refactoring Tasks

### 1. Viewport Management
**Current State**: `gridcore-ui/src/components/viewport.rs` contains viewport logic mixed with UI concerns

**Target State**: Move core viewport calculations to `gridcore-controller`

**Changes Required**:
- Move `ViewportBounds` and `ScrollPosition` types from `gridcore-ui/src/components/viewport.rs` to `gridcore-controller/src/controller/viewport.rs`
- Move core viewport methods (`get_visible_bounds`, `scroll_by`, `scroll_to_cell`) to controller's `ViewportManager` trait implementation
- Extend `DefaultViewportManager` with column/row width/height management
- Keep only UI-specific rendering helpers in UI layer

**Files to Modify**:
- `gridcore-ui/src/components/viewport.rs` - Remove business logic
- `gridcore-controller/src/controller/viewport.rs` - Add viewport logic
- `gridcore-ui/src/components/canvas_grid.rs` - Update to use controller viewport

### 2. Grid Theme/Styling Split
**Current State**: `GridTheme` in UI layer contains both visual and structural properties

**Target State**: Split into visual theme (UI) and grid configuration (controller)

**Changes Required**:
- Create `GridConfiguration` struct in `gridcore-controller/src/controller/config.rs`:
  ```rust
  pub struct GridConfiguration {
      pub default_cell_width: f64,
      pub default_cell_height: f64,
      pub min_cell_width: f64,
      pub max_cell_width: f64,
      pub row_header_width: f64,
      pub column_header_height: f64,
      pub total_rows: usize,
      pub total_cols: usize,
  }
  ```
- Keep visual properties in `GridTheme`:
  ```rust
  pub struct GridTheme {
      // Colors
      pub background_color: String,
      pub grid_line_color: String,
      pub cell_text_color: String,
      // Fonts
      pub cell_font_family: String,
      pub cell_font_size: f64,
      // Padding
      pub cell_padding_left: f64,
      pub cell_padding_top: f64,
  }
  ```

**Files to Modify**:
- `gridcore-ui/src/rendering/theme.rs` - Remove structural properties
- `gridcore-controller/src/controller/config.rs` - New file for GridConfiguration
- `gridcore-controller/src/controller/mod.rs` - Export config module

### 3. Cell Position Calculations
**Current State**: Methods like `get_cell_at_position`, `get_column_label` in UI viewport

**Target State**: Move to controller as pure business logic

**Changes Required**:
- Move `get_cell_at_position` to `ViewportManager::viewport_to_cell`
- Move `get_column_label` to a utility module in controller
- Move `get_cell_position` to `ViewportManager::cell_to_viewport`
- Update UI to call controller methods

**Files to Modify**:
- `gridcore-ui/src/components/viewport.rs` - Remove calculation methods
- `gridcore-controller/src/controller/viewport.rs` - Add calculation methods
- `gridcore-controller/src/utils/mod.rs` - Add column label utility

### 4. Resize Management
**Current State**: `ResizeHandler` in UI manages column/row resizing with state

**Target State**: Move resize state management to controller

**Changes Required**:
- Create `ResizeManager` in `gridcore-controller/src/managers/resize.rs`:
  ```rust
  pub struct ResizeManager {
      resize_state: ResizeState,
      column_widths: HashMap<usize, f64>,
      row_heights: HashMap<usize, f64>,
  }
  ```
- Keep `ResizeHandler` in UI but only for mouse event capture
- Emit resize events from controller

**Files to Modify**:
- `gridcore-controller/src/managers/resize.rs` - New file
- `gridcore-ui/src/interaction/resize_handler.rs` - Simplify to event capture only
- `gridcore-controller/src/controller/events.rs` - Add resize events

### 5. Keyboard/Mouse Event Processing
**Current State**: Direct keyboard handling in `canvas_grid.rs` with embedded business logic

**Target State**: Complete separation of event capture and command interpretation

**Changes Required**:
- Move all action determination logic from UI keyboard handler to controller
- UI should only capture events and forward to controller
- Controller interprets events based on current state and returns actions
- Extend `SpreadsheetController::handle_keyboard_event` to handle all navigation logic

**Files to Modify**:
- `gridcore-ui/src/components/canvas_grid.rs` - Remove action logic, just forward events
- `gridcore-controller/src/controller/spreadsheet.rs` - Add complete event handling

### 6. Selection Rendering vs Management
**Current State**: Selection management in controller but some logic in UI

**Target State**: Complete separation

**Changes Required**:
- Remove any selection state from UI components
- UI queries controller's `SelectionManager` for current selection
- UI only renders selection boundaries provided by controller

**Files to Modify**:
- `gridcore-ui/src/components/canvas_grid.rs` - Remove selection logic
- `gridcore-ui/src/rendering/selection_renderer.rs` - Use controller selection

### 7. Scroll Management
**Current State**: Scroll state and calculations in UI viewport

**Target State**: Move to controller's viewport manager

**Changes Required**:
- Move scroll position state to `DefaultViewportManager`
- Add scroll methods to `ViewportManager` trait
- UI handles wheel events and calls controller scroll methods
- Controller emits scroll events for UI to react to

**Files to Modify**:
- `gridcore-ui/src/components/viewport.rs` - Remove scroll state
- `gridcore-controller/src/controller/viewport.rs` - Add scroll management

## Implementation Order

1. **Phase 1: Viewport Refactoring** (Highest Impact)
   - Move ViewportBounds and ScrollPosition
   - Move viewport calculations
   - Update UI to use controller viewport

2. **Phase 2: Configuration Split**
   - Create GridConfiguration in controller
   - Split GridTheme
   - Update all references

3. **Phase 3: Cell Calculations**
   - Move position calculations
   - Add utility functions
   - Update UI calls

4. **Phase 4: Resize Management**
   - Create ResizeManager
   - Refactor ResizeHandler
   - Add resize events

5. **Phase 5: Event Handling**
   - Complete keyboard event separation
   - Refactor mouse event handling
   - Remove business logic from UI

6. **Phase 6: Final Cleanup**
   - Ensure selection separation
   - Complete scroll management
   - Run all tests
   - Update documentation

## Testing Strategy

After each phase:
1. Run existing tests: `cargo test --all`
2. Test UI interactivity manually
3. Verify WASM compilation: `wasm-pack build`
4. Check for any performance regressions

## Success Criteria

- UI layer contains no business logic, only rendering and event capture
- Controller manages all interaction state and logic
- Core remains focused on spreadsheet calculations
- All existing functionality works as before
- Code is more maintainable and testable
- Clear separation enables future UI implementations (TUI, native)

## Notes

- Maintain backward compatibility during refactoring
- Each phase should be a separate commit
- Consider creating integration tests before starting
- Document new controller APIs as they're created