# Vim Keybindings Implementation Plan for TUI

Based on the web UI's vim implementation, this plan outlines the vim keybindings to be added to the TUI.

## 1. Enhanced Normal Mode Navigation

- `0` - Move to first column
- `$` - Move to last column  
- `gg` - Move to first row (command sequence)
- `G` - Move to last row (with count support: `5G` goes to row 5)
- `w` - Move word forward (to next cell with content)
- `b` - Move word backward (to previous cell with content)
- `e` - Move to end of word (next cell boundary)
- Count support (e.g., `3j` moves down 3 cells)

## 2. Scrolling Commands

- `Ctrl+d` - Scroll down half page
- `Ctrl+u` - Scroll up half page
- `Ctrl+f` - Scroll down full page
- `Ctrl+b` - Scroll up full page
- `Ctrl+e` - Scroll down one line
- `Ctrl+y` - Scroll up one line
- `zz` - Center current cell
- `zt` - Scroll current cell to top
- `zb` - Scroll current cell to bottom

## 3. Edit Mode Variants

- `a` - Append after cursor (enter edit mode with cursor at end)
- `A` - Append at end of line (go to last column and edit)
- `I` - Insert at beginning of line (go to first column and edit)
- `o` - Open line below (move to next row and edit)
- `O` - Open line above (move to previous row and edit)

## 4. Visual Mode Enhancements

- Visual mode selection tracking with anchor/cursor
- Movement in visual mode updates selection range
- `V` - Visual line mode (select entire rows)
- `Ctrl+v` - Visual block mode (rectangular selection)
- Edit keys in visual mode (`i`, `a`, etc.) exit to normal mode first

## 5. Delete/Change Operations

- `x` - Delete character (clear current cell)
- `dd` - Delete line (clear entire row)
- `cc` - Change line (clear row and enter edit mode)
- `d` with motion (`dw`, `d$`, etc.)
- `c` with motion (`cw`, `c$`, etc.)

## 6. Yank/Paste Operations

- `yy` - Yank line (copy row)
- `y` with motion
- `p` - Paste after
- `P` - Paste before

## 7. Resize Mode

- `gr` - Enter resize mode
- In resize mode:
  - `+`/`>` - Increase column width
  - `-`/`<` - Decrease column width  
  - `=` - Auto-fit column
  - `h`/`l` - Navigate columns
  - `j`/`k` - Resize rows
  - Number prefixes for multiplier

## 8. Additional Features

- Command timeout for multi-key sequences (e.g., `gg`, `zz`)
- Number buffer for count prefixes
- Proper cursor positioning on mode transitions
- Visual feedback for mode changes

## Implementation Steps with Testing & Git Strategy

### Phase 1: Core Vim Infrastructure
1. **Create VimBehavior class** - Port the VimBehavior pattern from web UI
   - **Test**: Create `VimBehavior.test.ts` with basic mode transition tests
   - **Commit**: `feat(ui-tui): Add VimBehavior class for vim keybinding handling`

2. **Add number buffer & command sequences** 
   - Handle count prefixes for commands
   - Add timeout-based multi-key commands (gg, zz, etc.)
   - **Test**: Test number accumulation, command timeouts, buffer reset
   - **Commit**: `feat(ui-tui): Add number buffer and command sequence support`

### Phase 2: Navigation Commands
3. **Basic vim motions** - hjkl with counts, 0, $
   - **Test**: Test each motion with and without counts
   - **Commit**: `feat(ui-tui): Implement basic vim navigation (hjkl, 0, $)`

4. **Advanced navigation** - gg, G, w, b, e
   - **Test**: Test boundary conditions, empty grid navigation
   - **Commit**: `feat(ui-tui): Add advanced vim navigation (gg, G, w, b, e)`

### Phase 3: Mode Variants
5. **Edit mode variants** - a, A, i, I, o, O
   - **Test**: Test cursor positioning for each variant
   - **Test**: Test mode transitions and edit value initialization
   - **Commit**: `feat(ui-tui): Implement vim edit mode variants`

### Phase 4: Visual Mode
6. **Visual selection tracking** - Implement anchor/cursor selection model
   - **Test**: Test selection expansion in all directions
   - **Commit**: `feat(ui-tui): Add visual mode selection tracking`

7. **Visual mode types** - v, V, Ctrl+v
   - **Test**: Test character, line, and block selection modes
   - **Test**: Test mode-specific selection behavior
   - **Commit**: `feat(ui-tui): Implement visual, visual-line, and visual-block modes`

### Phase 5: Operations
8. **Delete/change operations** - x, dd, cc, d{motion}, c{motion}
   - **Test**: Test cell clearing, row operations
   - **Test**: Test operator-pending mode and motions
   - **Commit**: `feat(ui-tui): Add vim delete and change operations`

9. **Copy/paste system** - yy, y{motion}, p, P
   - Add clipboard buffer for yank/paste
   - **Test**: Test clipboard operations, paste positioning
   - **Commit**: `feat(ui-tui): Implement vim yank and paste operations`

### Phase 6: Scrolling & View
10. **Scrolling commands** - Ctrl+d/u/f/b/e/y, z commands
    - **Test**: Test scroll amounts, viewport boundaries
    - **Test**: Test centering commands (zz, zt, zb)
    - **Commit**: `feat(ui-tui): Add vim scrolling commands`

### Phase 7: Resize Mode
11. **Resize mode** - Add as new TUI mode with column/row resizing
    - **Test**: Test resize operations, mode transitions
    - **Test**: Test number prefix multipliers
    - **Commit**: `feat(ui-tui): Implement vim resize mode`

### Phase 8: Polish
12. **Status bar updates** - Show vim-specific hints and mode info
    - **Test**: Visual testing, mode indicator updates
    - **Commit**: `feat(ui-tui): Update status bar with vim mode indicators`

13. **Integration tests** - Test complex command sequences
    - **Test**: End-to-end vim workflow tests
    - **Test**: Multi-mode transition tests
    - **Commit**: `test(ui-tui): Add comprehensive vim integration tests`

## Testing Strategy

### Unit Tests
- Each vim command should have isolated unit tests
- Test with and without count prefixes
- Test boundary conditions (first/last row/column)
- Test mode transitions and state preservation

### Integration Tests
- Test command sequences (e.g., `3dd`, `5G`, `gg`)
- Test mode transition workflows (normal → visual → edit)
- Test clipboard persistence across operations
- Test undo/redo integration (if implemented)

### Manual Testing Checklist
- [ ] All single-key commands work as expected
- [ ] Number prefixes multiply command effects
- [ ] Command sequences timeout appropriately
- [ ] Visual selections render correctly
- [ ] Mode transitions preserve appropriate state
- [ ] Status bar updates reflect current mode
- [ ] Terminal compatibility (test on multiple terminals)

## Git Commit Guidelines

### Commit Message Format
```
<type>(ui-tui): <description>

<optional body explaining why and what changed>

<optional footer with breaking changes or issues closed>
```

### Types
- `feat`: New vim feature implementation
- `fix`: Bug fixes in vim behavior
- `test`: Adding or updating tests
- `refactor`: Code restructuring without behavior change
- `docs`: Documentation updates

### When to Commit
- After each completed feature group (not individual keys)
- After adding corresponding tests
- When all tests pass (`bun test`)
- After running formatter (`bun run check`)

## Key Differences from Web UI

- Terminal constraints may affect some keybindings (e.g., Ctrl combinations)
- Visual feedback will use terminal colors instead of CSS
- Cell selection will use background colors rather than borders
- Clipboard integration may be limited based on terminal environment

## Priority Order

1. Basic vim motions (hjkl with counts, 0, $, gg, G)
2. Edit mode variants (a, A, i, I, o, O)
3. Visual mode improvements
4. Delete/change operations
5. Scrolling commands
6. Yank/paste operations
7. Resize mode