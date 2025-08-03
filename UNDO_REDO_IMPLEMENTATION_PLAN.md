# Undo/Redo Tree Implementation Plan

## Overview
Implement a comprehensive undo/redo system with tree-based history that supports both traditional (Ctrl-Z/Ctrl-R) and vim-style (u/R) commands.

## Architecture

### 1. Core Components

**UndoRedoManager** (`packages/core/src/UndoRedoManager.ts`)
- Manages the undo/redo tree structure
- Handles state snapshots and transitions
- Provides undo/redo operations
- Key methods:
  - `recordState(state: SpreadsheetState): void`
  - `undo(): SpreadsheetState | null`
  - `redo(): SpreadsheetState | null`
  - `canUndo(): boolean`
  - `canRedo(): boolean`

**StateSnapshot** interface
```typescript
interface StateSnapshot {
  id: string;
  timestamp: number;
  state: SpreadsheetState;
  description?: string;
  parentId?: string;
  childIds: string[];
}
```

### 2. Integration Points

**SpreadsheetEngine Updates**
- Add `undoRedoManager` instance
- Add methods:
  - `recordSnapshot(description?: string): void`
  - `undo(): boolean`
  - `redo(): boolean`
- Auto-record snapshots after significant operations (batch changes, formula updates)

**KeyboardHandler Updates**
- Add Ctrl-Z/Ctrl-R handling in normal mode
- Ensure proper command precedence

**GridVimBehavior Updates**
- Add vim 'u' command for undo (currently conflicts with Ctrl-U scroll)
- Add vim 'R' command for redo
- Consider: Should 'u' in normal mode be undo or keep current scroll behavior?

## Implementation Steps

1. **Create UndoRedoManager class**
   - Tree-based history structure
   - Efficient state storage (consider delta compression)
   - Branch management for divergent histories

2. **Update SpreadsheetEngine**
   - Integrate UndoRedoManager
   - Add snapshot recording at strategic points
   - Implement undo/redo methods

3. **Update KeyboardHandler**
   - Add Ctrl-Z/Ctrl-R handlers
   - Route to SpreadsheetEngine undo/redo

4. **Update GridVimBehavior**
   - Resolve 'u' key conflict (propose: use 'u' for undo, Ctrl-U for scroll)
   - Add 'R' for redo
   - Add count support (e.g., '3u' = undo 3 times)

5. **Add UI feedback**
   - Show undo/redo availability in UI
   - Display operation descriptions
   - Consider undo history visualization

## Configuration Options
- Max history size
- Auto-snapshot intervals
- Compression settings
- Branch retention policy

## Testing Strategy
- Unit tests for UndoRedoManager
- Integration tests for SpreadsheetEngine
- E2E tests for keyboard shortcuts
- Performance tests for large histories

## Key Decisions Needed

1. **Vim 'u' key conflict**: Currently Ctrl-U scrolls up. Should we:
   - Use 'u' for undo and Ctrl-U for scroll (vim standard)
   - Keep current behavior and use different key for undo
   - Make it configurable

2. **Snapshot Granularity**: When to auto-record snapshots:
   - Every cell change
   - After batch operations
   - Time-based intervals
   - Significant operations only

3. **Memory Management**:
   - Maximum history size
   - Compression strategy
   - Branch pruning policy

## Example Usage

```typescript
// Traditional shortcuts
Ctrl-Z  // Undo last action
Ctrl-R  // Redo last undone action

// Vim mode
u       // Undo last action
R       // Redo last undone action
3u      // Undo last 3 actions
5R      // Redo 5 actions
```

## Performance Considerations

- Use immutable data structures for efficient snapshots
- Consider delta compression for similar states
- Implement lazy loading for large histories
- Add configurable history limits

## Future Enhancements

1. **Visual History Browser**: Show undo tree graphically
2. **Named Checkpoints**: Allow users to name important states
3. **Selective Undo**: Undo specific operations without affecting others
4. **Persistent History**: Save undo history with the document
5. **Collaborative Undo**: Handle undo/redo in multi-user scenarios