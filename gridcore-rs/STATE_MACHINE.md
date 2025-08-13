# GridCore State Machine (Moore Machine)

This document describes the state machine that governs the interaction between spreadsheet navigation and cell editing modes in GridCore.

## State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> Navigation: Initial

    %% Main application states, branching from Navigation
    Navigation --> Editing.Normal: Start Editing (Normal Mode)
    Navigation --> Editing.Insert: Start Editing (Insert Mode)
    Navigation --> Command: EnterCommandMode
    Navigation --> SpreadsheetVisual: EnterSpreadsheetVisualMode
    Navigation --> Resize: EnterResizeMode
    Navigation --> InsertRowCol: StartInsert
    Navigation --> DeleteRowCol: StartDelete
    Navigation --> BulkOperation: StartBulkOperation

    %% Composite state for when a user is editing a single cell
    state Editing {
        direction LR
        Normal: Vim Normal Mode
        Insert: Text Insert Mode
        Visual: Text Selection Mode

        [*] --> Normal
        Normal --> Insert: i, a, I, A
        Normal --> Visual: v
        Insert --> Normal: Escape (to Normal)
        Visual --> Normal: Escape (to Normal)
    }

    %% Transitions from various states back to Navigation
    Editing.Normal --> Navigation: Escape / ExitToNavigation
    Editing.Insert --> Navigation: SubmitCellEdit
    Command --> Navigation: ExitCommandMode / Escape
    SpreadsheetVisual --> Navigation: ExitSpreadsheetVisualMode / Escape
    Resize --> Navigation: Confirm / Cancel / Escape
    InsertRowCol --> Navigation: Confirm / Cancel / Escape
    DeleteRowCol --> Navigation: Confirm / Cancel / Escape
    BulkOperation --> Navigation: Complete / Cancel

    %% Notes for clarity
    note right of Navigation
        Main spreadsheet mode
        - Arrow keys: move cursor
        - i/a/I/A: start cell editing
        - v: visual mode (spreadsheet-level)
        - :: command mode
    end note

    note right of Editing
        Cell editing mode with 3 sub-modes:
        - Normal: vim-like normal mode
        - Insert: text insertion mode
        - Visual: text selection mode
    end note
```

## States

### Primary States

1. **Navigation** (`UIState::Navigation`)

   - Default spreadsheet navigation mode
   - Cursor movement between cells
   - Entry point to all other modes
   - Contains: cursor, viewport, selection

1. **Editing** (`UIState::Editing`)

   - Cell content editing mode
   - Has three sub-modes (CellMode):
     - **Normal**: Vim-like normal mode for cell editing
     - **Insert**: Active text insertion
     - **Visual**: Text selection within cell
   - Contains: cursor, viewport, cell_mode, editing_value, cursor_position, edit_variant

1. **Command** (`UIState::Command`)

   - Command line mode (triggered by ':')
   - For executing spreadsheet commands
   - Contains: cursor, viewport, command_value

1. **Visual** (`UIState::Visual`)

   - Spreadsheet-level visual selection mode
   - For selecting ranges of cells
   - Contains: cursor, viewport, selection, visual_mode, anchor

1. **Resize** (`UIState::Resize`)

   - Column/row resizing mode
   - Interactive size adjustment
   - Contains: resize_target, current_size, original_size

1. **Insert** (`UIState::Insert`)

   - Structural insert mode (rows/columns)
   - Not for text editing
   - Contains: insert_type, position, count

1. **Delete** (`UIState::Delete`)

   - Structural delete mode (rows/columns)
   - Confirmation pending state
   - Contains: delete_type, targets, confirmation_pending

1. **BulkOperation** (`UIState::BulkOperation`)

   - Bulk operations on cell ranges
   - Find/replace, transformations
   - Contains: parsed_command, affected_cells, status

## Key Transitions

### Navigation → Editing Transitions

| Trigger Key | Action                                                                     | Target State    | Notes                 |
| ----------- | -------------------------------------------------------------------------- | --------------- | --------------------- |
| `i`         | `StartEditing {edit_mode: Some(InsertMode::I)}`                            | Editing(Insert) | Insert at cursor      |
| `a`         | `StartEditing {edit_mode: Some(InsertMode::A)}`                            | Editing(Insert) | Append after cursor   |
| `I`         | `StartEditing {edit_mode: Some(InsertMode::CapitalI)}`                     | Editing(Insert) | Insert at line start  |
| `A`         | `StartEditing {edit_mode: Some(InsertMode::CapitalA)}`                     | Editing(Insert) | Append at line end    |
| `Enter`     | `StartEditing {edit_mode: Some(InsertMode::I), initial_value: Some("")}`   | Editing(Insert) | Clear and edit        |
| Any char    | `StartEditing {edit_mode: Some(InsertMode::I), initial_value: Some(char)}` | Editing(Insert) | Start with typed char |

### Editing → Navigation Transitions

| State           | Trigger  | Action             | Result                   |
| --------------- | -------- | ------------------ | ------------------------ |
| Editing(Insert) | `Escape` | `Escape`           | Editing(Normal)          |
| Editing(Normal) | `Escape` | `Escape`           | Navigation               |
| Editing(Insert) | `Enter`  | `SubmitCellEdit`   | Navigation (+ move down) |
| Any             |          | `ExitToNavigation` | Navigation               |

### Escape Key Behavior (Universal Handler)

The Escape key behavior is context-sensitive:

1. **In Editing mode:**

   - From Insert/Visual sub-mode → Normal sub-mode
   - From Normal sub-mode → Navigation

1. **In other modes:**

   - Command → Navigation
   - Visual → Navigation
   - Resize → Navigation
   - Insert/Delete → Navigation (cancel operation)

1. **In Navigation:**

   - No effect (already at top level)

## Implementation Details

### Handler Registry

The state machine uses a handler registry pattern with specialized handlers:

1. `NavigationHandler` - Handles transitions from Navigation state
1. `EditingHandler` - Handles transitions within Editing state
1. `VisualHandler` - Handles Visual mode transitions
1. `CommandHandler` - Handles Command mode transitions
1. `ResizeHandler` - Handles Resize mode transitions
1. `StructuralHandler` - Handles Insert/Delete operations
1. `BulkHandler` - Handles bulk operations
1. `UniversalHandler` - Handles universal actions (Escape, UpdateCursor, etc.)

### State Machine Properties

- **Moore Machine**: Output (UI state) depends only on current state
- **Deterministic**: Each state/action pair has at most one valid transition
- **History Tracking**: Maintains transition history with diffs for undo/redo
- **Event-Driven**: Actions trigger state transitions
- **Listener Pattern**: State changes notify registered listeners

## Cell Editing Flow

```mermaid
sequenceDiagram
    participant User
    participant Controller
    participant StateMachine
    participant UIState

    User->>Controller: Press 'i' key
    Controller->>StateMachine: dispatch_action(StartEditing)
    StateMachine->>StateMachine: find_handler(Navigation, StartEditing)
    StateMachine->>UIState: Navigation → Editing(Insert)
    StateMachine->>Controller: State changed
    Controller->>User: Show cell editor

    User->>Controller: Type text
    Controller->>StateMachine: UpdateEditingValue
    StateMachine->>UIState: Update editing_value
    
    User->>Controller: Press Enter
    Controller->>StateMachine: SubmitCellEdit
    StateMachine->>UIState: Editing → Navigation
    Controller->>User: Save value, return to grid
```

## Formula Bar Integration

The formula bar is synchronized with the state machine:

1. **Navigation mode**: Shows current cell's value/formula
1. **Editing mode**: Shows editing_value from state
1. **Updates**: `UpdateFormulaBar` action updates controller's formula_bar_value
1. **Submit**: `SubmitFormulaBar` sets cell value without entering edit mode

## Design Rationale

1. **Vim-inspired**: Modal editing provides power users with efficient navigation
1. **Nested modes**: Cell editing has its own sub-modes for fine control
1. **Escape consistency**: Always moves "up" the mode hierarchy
1. **State isolation**: Each state contains only relevant data
1. **Action atomicity**: Each action represents a single user intent

