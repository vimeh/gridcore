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

## Implementation Steps

1. **Create VimBehavior class** - Port the VimBehavior pattern from web UI
2. **Add number buffer** - Handle count prefixes for commands
3. **Implement command sequences** - Add timeout-based multi-key commands
4. **Enhance navigation** - Add all movement commands with count support
5. **Visual selection tracking** - Implement anchor/cursor selection model
6. **Copy/paste system** - Add clipboard buffer for yank/paste
7. **Resize mode** - Add as new TUI mode with column/row resizing
8. **Status bar updates** - Show vim-specific hints and mode info
9. **Testing** - Add comprehensive tests for all keybindings

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