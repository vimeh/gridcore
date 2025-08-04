# Agent Instructions: Insert/Delete Operations Feature

## Agent Assignment
- **Agent ID**: Agent-3
- **Feature**: Insert and Delete Row/Column Operations
- **Priority**: MEDIUM
- **Worktree**: `/worktrees/insert-delete`

## Mission
Implement row and column insertion/deletion with proper formula reference updates, data shifting, and full undo/redo support for structural changes.

## Key Responsibilities

### Phase 1: Extend UIState and SpreadsheetController (Days 1-2)
1. Add insert/delete modes to UIState discriminated union
2. Create factory functions for insert/delete states
3. Add structural transitions to UIStateMachine
4. Extend SpreadsheetController with:
   - insertRows/insertColumns
   - deleteRows/deleteColumns
5. Write unit tests for state transitions

### Phase 2: Core Infrastructure (Days 2-4)
**DEPENDENCY: Wait for Agent-1 to complete ReferenceUpdater**
1. Implement ReferenceUpdater for formula adjustments
2. Add structural change tracking to SpreadsheetEngine
3. Create SparseGrid data structure for efficient operations
4. Implement basic insert/delete operations
5. Write comprehensive unit tests

### Phase 3: VimBehavior Integration (Days 4-5)
1. Add structural commands to VimBehavior:
   - `gir` - insert row before
   - `giR` - insert row after  
   - `gic` - insert column before
   - `giC` - insert column after
   - `dr` - delete row
   - `dc` - delete column
2. Implement count support (e.g., `5gir`)
3. Add confirmation flow for deletions
4. Create visual feedback
5. Test vim command sequences

## Technical Guidelines

### Code Location
- Core operations: `packages/core/src/structure/`
- Reference updates: `packages/core/src/references/ReferenceUpdater.ts`
- UI integration: `packages/ui-core/src/behaviors/structural/`

### Key Interfaces
```typescript
interface StructuralChange {
  type: "insertRow" | "insertColumn" | "deleteRow" | "deleteColumn";
  index: number;
  count: number;
  timestamp: number;
}
```

### Critical Requirements
- Formula references MUST update correctly
- Handle #REF! errors for deleted cells
- Maintain data integrity
- Support full undo/redo

## Dependencies
- **BLOCKING**: Agent-1 (Absolute References) - Need ReferenceUpdater
- Wait for Phase 1 completion before starting Phase 2

## Success Criteria
1. Insert/delete operations work flawlessly
2. All formulas update correctly
3. No data corruption
4. Undo/redo works perfectly
5. Performance: 1000 row insert < 100ms

## Progress Tracking
- Update `PROGRESS.md` at least twice daily
- **IMPORTANT**: Log dependency on Agent-1 in `BLOCKERS.md`
- Commit frequently with descriptive messages
- Run `bun test` before every commit
- Run `bun run check` for linting

## Communication
- **CRITICAL**: Monitor Agent-1's PROGRESS.md daily
- Request ReferenceUpdater interface early
- Report any blocking issues immediately
- Notify overseer when blocked

## Resources
- Full plan: `docs/insert-delete-operations-plan.md`
- Study existing undo/redo system
- Reference Excel's insert/delete behavior

## Quality Standards
- Zero tolerance for data loss
- Extensive edge case testing
- Clear error messages for #REF!
- Document formula update algorithm

## Contingency Plan
While waiting for Agent-1:
1. Implement UI state management (Phase 1)
2. Design SparseGrid structure
3. Create test cases for formula updates
4. Build deletion warning system

Remember: This feature can cause data loss if done incorrectly. Prioritize correctness over speed.