# Agent Instructions: Column/Row Selection Feature

## Agent Assignment
- **Agent ID**: Agent-2
- **Feature**: Column and Row Selection
- **Priority**: HIGH
- **Worktree**: `/worktrees/col-row-selection`

## Mission
Implement full column and row selection capabilities with vim-style commands, visual indicators, and support for bulk operations on entire columns/rows.

## Key Responsibilities

### Phase 1: Extend UIState and VimBehavior (Days 1-2)
1. Add visual selection mode to UIState discriminated union
2. Create visual state factory functions
3. Extend VimBehavior with visual mode commands:
   - `V` for row selection
   - `gC` for column selection
   - Navigation extends selection
4. Add visual mode transitions to UIStateMachine
5. Write unit tests for state transitions

### Phase 2: Implement SelectionManager (Days 2-3)
1. Create SelectionManager class in ui-core
2. Integrate with SpreadsheetController
3. Implement selection creation algorithms:
   - Column selection
   - Row selection
   - Multi-column/row selection
4. Add selection bounds calculation
5. Write comprehensive tests

### Phase 3: Update Behaviors (Days 3-4)
1. Extend VimBehavior command map with:
   - `aC` - select entire column
   - `aR` - select entire row
   - `iC` - select column data only
   - `iR` - select row data only
2. Add visual mode handling to handleKeyPress
3. Implement selection extension logic
4. Update ResizeBehavior for visual selections
5. Test all vim command sequences

## Technical Guidelines

### Code Location
- UIState extensions: `packages/ui-core/src/state/UIState.ts`
- SelectionManager: `packages/ui-core/src/managers/SelectionManager.ts`
- VimBehavior updates: `packages/ui-core/src/behaviors/VimBehavior.ts`

### Key Types
```typescript
type SelectionType = 
  | { type: "cell"; address: CellAddress }
  | { type: "range"; start: CellAddress; end: CellAddress }
  | { type: "column"; columns: number[] }
  | { type: "row"; rows: number[] }
  | { type: "multi"; selections: Selection[] };
```

### Performance Requirements
- Selection of 10,000+ rows must be instant
- Memory-efficient representation
- Lazy evaluation for cell iteration

## Dependencies
- None - this is a foundational feature

## Success Criteria
1. Visual mode works consistently across TUI/Web
2. Column/row selection with keyboard navigation
3. Visual indicators clear and responsive
4. Operations on selections work correctly
5. No memory leaks with large selections

## Progress Tracking
- Update `PROGRESS.md` at least twice daily
- Log any blockers in `BLOCKERS.md` immediately
- Commit frequently with descriptive messages
- Run `bun test` before every commit
- Run `bun run check` for linting

## Communication
- Notify Agent-4 (bulk-ops) when Phase 2 completes
- Coordinate with UI teams for rendering
- Report completion of each phase to overseer

## Resources
- Full plan: `docs/column-row-selection-plan.md`
- Existing VimBehavior: `packages/ui-core/src/behaviors/VimBehavior.ts`
- UIState patterns: `packages/ui-core/src/state/`

## Quality Standards
- Follow existing UIState patterns
- Maintain discriminated union type safety
- Test edge cases (max rows/columns)
- Document new vim commands

Remember: This is a HIGH PRIORITY feature that enables bulk operations. Focus on correctness and performance.