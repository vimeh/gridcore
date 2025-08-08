# E2E Test Fix Plan for GridCore Leptos UI

## Current Status
- **Total Tests**: 68
- **Passing**: 11  
- **Failing**: 57
- **Main Issue**: The new Leptos UI is missing many features that the TypeScript UI had, causing test failures

## Test Failure Categories

### 1. UI Element Issues
- `.cell-indicator` is a div but tests expect input with value
- `.mode-indicator` class missing from status bar
- Mode detail text ("hjkl to move", "ESC to normal") not shown
- Formula bar not connected to active cell value

### 2. Editing Mode Issues  
- Enter key doesn't start editing mode
- Direct typing doesn't automatically open editor
- Escape key handling incomplete (needs double Escape for save)
- No 'a' append mode support
- No cursor position tracking

### 3. Navigation Issues
- Tab/Shift+Tab navigation not implemented
- Visual mode ('v' key) not implemented

### 4. Formula/Multi-line Issues
- Formula display in formula bar not working
- Multi-line editing not supported
- Enter in insert mode should add newline, not save

## Implementation Plan

### Phase 1: Fix Critical UI Elements and Test Compatibility (High Priority)
**Goal**: Quick wins that fix many test failures without complex logic changes

1. **Fix .cell-indicator element** ✅
   - Keep as div but update tests to use textContent instead of toHaveValue
   - File: `tests/common-features.spec.ts`
   
2. **Add mode-indicator class to status bar**
   - Add class="mode-indicator" to the mode display span
   - Add mode-detail text based on current mode:
     - Navigation: "hjkl to move"
     - Insert: "ESC to normal"
     - Visual: "ESC to exit"
   - File: `gridcore-rs/gridcore-ui/src/components/status_bar.rs`

3. **Update formula bar to show current cell value**
   - Connect formula bar input to active cell's value
   - Update on cell navigation
   - File: `gridcore-rs/gridcore-ui/src/app.rs`

### Phase 2: Implement Core Editing Features (Critical for Test Success)
**Goal**: Enable basic cell editing functionality

4. **Implement Enter key handler in navigation mode**
   - Enter should start editing mode and preserve existing content
   - Different from 'i' which starts insert at cursor position
   - File: `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs`

5. **Implement direct typing to start editing**
   - Any alphanumeric key in navigation mode should start editing with that character
   - Tests expect typing "Quick entry" to automatically open editor
   - File: `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs`

6. **Fix Escape key handling in edit mode**
   - First Escape: exit insert mode to normal mode (within editor)
   - Second Escape: save and exit to navigation mode
   - Currently only handles single Escape
   - File: `gridcore-rs/gridcore-ui/src/components/cell_editor.rs`

7. **Implement 'a' append mode**
   - 'a' key should start editing with cursor at end of text
   - Different from 'i' which positions cursor at beginning
   - File: `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs`

### Phase 3: Advanced Vim Features (Medium Priority)
**Goal**: Full vim-mode compatibility

8. **Implement visual mode with 'v' key**
   - Visual character selection mode
   - Visual line mode with 'V'
   - Visual block mode with Ctrl+V
   - File: `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs`

9. **Add cursor position tracking in editor**
   - Track and display cursor position within text
   - Support for positioning cursor at beginning/end based on entry mode
   - File: `gridcore-rs/gridcore-ui/src/components/cell_editor.rs`

10. **Implement Tab/Shift+Tab navigation**
    - Tab moves to next cell (right, then wrap to next row)
    - Shift+Tab moves to previous cell
    - File: `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs`

### Phase 4: Multi-line and Formula Support (Lower Priority)
**Goal**: Advanced editing features

11. **Implement multi-line editing**
    - Enter in insert mode adds newline (not save)
    - Support for Alt+Enter or similar for newlines
    - File: `gridcore-rs/gridcore-ui/src/components/cell_editor.rs`

12. **Enhance formula handling**
    - Display formulas in formula bar when cell has formula
    - Handle formula autocomplete properly
    - File: `gridcore-rs/gridcore-ui/src/app.rs`

## Files to Modify

### UI Components
- `gridcore-rs/gridcore-ui/src/components/status_bar.rs` - Mode indicator and detail text
- `gridcore-rs/gridcore-ui/src/components/canvas_grid.rs` - Key handlers for navigation and mode switches
- `gridcore-rs/gridcore-ui/src/components/cell_editor.rs` - Escape handling, cursor positioning
- `gridcore-rs/gridcore-ui/src/app.rs` - Formula bar connection to active cell

### Test Files
- `tests/common-features.spec.ts` - Update assertions for div elements
- Other test files may need selector updates

## Git Commit Strategy

### Commit After Each Phase
```bash
# Phase 1
git add -A && git commit -m "fix(ui): add mode indicators and fix formula bar display"

# Phase 2  
git add -A && git commit -m "fix(ui): implement core editing features and key handlers"

# Phase 3
git add -A && git commit -m "feat(ui): add vim visual mode and tab navigation"

# Phase 4
git add -A && git commit -m "feat(ui): add multi-line editing and formula support"
```

### Test Commands
```bash
# Run all e2e tests
bun test:e2e --project=chromium

# Run specific test file
bun test:e2e tests/cell-editing.spec.ts --project=chromium

# Run with UI for debugging
bun test:e2e --project=chromium --ui
```

## Expected Outcomes

### After Phase 1
- ~10-15 more tests passing
- Formula bar shows correct values
- Mode indicator visible in tests

### After Phase 2  
- ~30-40 more tests passing
- Basic cell editing working
- Vim insert/normal modes functional

### After Phase 3
- ~50+ tests passing
- Full vim mode support
- Tab navigation working

### After Phase 4
- All 68 tests passing
- Full feature parity with TypeScript UI

## Notes

- The Leptos UI uses WASM, so some features may need special handling
- Controller state machine already supports most modes, just need UI hooks
- Focus on test compatibility first, then enhance features
- Some tests may need updating to match new UI behavior (vim-style vs traditional)