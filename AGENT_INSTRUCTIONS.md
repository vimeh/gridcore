# Agent Instructions: Bulk Operations Feature

## Agent Assignment
- **Agent ID**: Agent-4
- **Feature**: Bulk Cell Operations
- **Priority**: MEDIUM
- **Worktree**: `/worktrees/bulk-ops`

## Mission
Implement comprehensive bulk operations including find/replace, batch updates, bulk formatting, and smart fill capabilities for multiple cells simultaneously.

## Key Responsibilities

### Phase 1: Extend Command Mode Infrastructure (Days 1-2)
1. Create BulkCommandParser for command mode
2. Integrate with existing SpreadsheetController
3. Add bulk operation state to UIStateMachine
4. Extend command mode autocomplete
5. Write unit tests for command parsing

### Phase 2: Core Bulk Operation Framework (Days 2-4)
**DEPENDENCY: Wait for Agent-2 to complete SelectionManager**
1. Design BulkOperation interface and base classes
2. Implement BatchProcessor with transaction support
3. Create operation preview system
4. Add undo/redo support for bulk operations
5. Write unit tests for core operations

### Phase 3: Find and Replace (Days 4-5)
1. Implement find algorithm with regex support
2. Create replace logic with preview
3. Add command mode syntax (vim-style `:s//`)
4. Support for:
   - Case sensitive/insensitive
   - Whole cell matching
   - Formula search
5. Test edge cases and performance

## Technical Guidelines

### Code Location
- Command parser: `packages/ui-core/src/commands/BulkCommandParser.ts`
- Operations: `packages/core/src/operations/bulk/`
- Batch processor: `packages/core/src/operations/BatchProcessor.ts`

### Key Commands
```typescript
// Command mode operations
':s/pattern/replacement/g' - Find and replace
':set value' - Set all selected cells
':add 10' - Add to numeric cells
':format currency' - Apply formatting
':fill series' - Fill with series
```

### Performance Goals
- Update 100,000 cells in < 1 second
- Preview first 100 changes instantly
- Lazy evaluation for large operations

## Dependencies
- **BLOCKING**: Agent-2 (Column/Row Selection) - Need selection infrastructure
- Can start Phase 1 independently

## Success Criteria
1. All bulk operations work on any selection
2. Find/replace supports regex
3. Preview before apply
4. Single undo for entire operation
5. No performance degradation

## Progress Tracking
- Update `PROGRESS.md` at least twice daily
- **IMPORTANT**: Log dependency on Agent-2 in `BLOCKERS.md`
- Commit frequently with descriptive messages
- Run `bun test` before every commit
- Run `bun run check` for linting

## Communication
- **CRITICAL**: Monitor Agent-2's PROGRESS.md daily
- Coordinate on selection API design
- Report performance benchmarks
- Share batch processing patterns

## Resources
- Full plan: `docs/bulk-operations-plan.md`
- Study vim's substitute command
- Excel's find/replace behavior
- Existing command mode: `packages/ui-core/src/commands/`

## Quality Standards
- Atomic operations (all or nothing)
- Clear progress indicators
- Accurate preview
- Memory-efficient for large selections

## Contingency Plan
While waiting for Agent-2:
1. Implement command parser (Phase 1)
2. Design operation interfaces
3. Build preview system
4. Create mock selection for testing

## Priority Operations
1. Find and replace (most common)
2. Bulk value set
3. Mathematical operations
4. Format application
5. Series fill

Remember: Users rely on bulk operations for productivity. Make them fast, reliable, and intuitive.