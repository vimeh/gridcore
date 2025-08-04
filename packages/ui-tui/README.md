# GridCore TUI

A Terminal User Interface (TUI) for GridCore spreadsheet engine.

## Features

- Grid display with cell navigation
- Multiple modes: Normal, Edit, Visual, Command
- Formula bar showing current cell and value
- Status bar with mode indicator and shortcuts
- Vim-style keyboard navigation
- Cell editing with formula support

## Running the TUI

```bash
# From the ui-tui directory
bun run dev

# Or from the project root
bun run --filter @gridcore/ui-tui dev
```

## Keyboard Shortcuts

### Normal Mode
- Arrow keys or `hjkl` - Navigate cells
- `Enter` or `i` - Enter edit mode
- `v` - Enter visual mode (selection)
- `:` - Enter command mode
- `Ctrl+C` or `Ctrl+Q` - Quit

### Edit Mode
- Type to edit cell content
- `Enter` - Save and exit edit mode
- `Escape` - Cancel and exit edit mode
- `Backspace` - Delete character

### Visual Mode
- Arrow keys - Expand selection
- `Escape` - Exit visual mode

### Command Mode
- `:q` or `:quit` - Quit the application
- `Enter` - Execute command
- `Escape` - Cancel command

## Architecture

The TUI is built with a custom framework that provides:

- **Renderable**: Base class for all UI components
- **OptimizedBuffer**: Efficient terminal rendering with dirty region tracking
- **Terminal**: Low-level terminal control (cursor, colors, input)

Main components:

- **SpreadsheetTUI**: Main application class
- **GridComponent**: Renders the spreadsheet grid
- **FormulaBarComponent**: Shows current cell and formula
- **StatusBarComponent**: Displays mode and help text

## Development

```bash
# Type checking
bun run typecheck

# Build
bun run build
```