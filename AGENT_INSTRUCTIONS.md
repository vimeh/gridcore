# Agent Instructions: Absolute References Feature

## Agent Assignment
- **Agent ID**: Agent-1
- **Feature**: Absolute and Relative Cell References
- **Priority**: HIGH
- **Worktree**: `/worktrees/absolute-refs`

## Mission
Implement comprehensive support for absolute ($A$1), relative (A1), and mixed ($A1, A$1) cell references in gridcore, including F4 key cycling and proper reference adjustment during copy/paste operations.

## Key Responsibilities

### Phase 1: Core Reference Model (Days 1-2)
1. Implement CellReference and RangeReference types in `@gridcore/core`
2. Create ReferenceParser with support for:
   - Relative: A1
   - Absolute: $A$1
   - Mixed: $A1, A$1
   - Sheet references: Sheet1!A1
   - Range references: A1:B2
3. Build ReferenceAdjuster for copy/paste operations
4. Add reference type detection
5. Write comprehensive unit tests

### Phase 2: CellVimBehavior Integration (Days 2-3)
1. Create ReferenceToggleExtension for F4 handling
2. Add reference navigation commands ([r, ]r)
3. Implement reference text objects (ir, ar)
4. Integrate with existing cursor movement
5. Test within editing mode

### Phase 3: Formula Integration (Days 3-4)
1. Update FormulaParser to handle absolute references
2. Implement FormulaTransformer for reference adjustment
3. Integrate with existing formula evaluation
4. Add reference validation
5. Test complex formula scenarios

## Technical Guidelines

### Code Location
- Core types: `packages/core/src/references/`
- Parser: `packages/core/src/references/ReferenceParser.ts`
- Adjuster: `packages/core/src/references/ReferenceAdjuster.ts`
- UI integration: `packages/ui-core/src/behaviors/extensions/`

### Key Interfaces
```typescript
interface CellReference {
  column: number;
  row: number;
  columnAbsolute: boolean;
  rowAbsolute: boolean;
  sheet?: string;
}
```

### Testing Requirements
- Unit tests for all reference patterns
- F4 cycling behavior tests
- Formula transformation tests
- Integration with copy/paste
- Edge cases (A1, XFD1048576)

## Dependencies
- None - this is a foundational feature

## Success Criteria
1. All reference types parse correctly
2. F4 key cycles through all reference types
3. Copy/paste adjusts references properly
4. No performance regression
5. 100% test coverage for reference logic

## Progress Tracking
- Update `PROGRESS.md` at least twice daily
- Log any blockers in `BLOCKERS.md` immediately
- Commit frequently with descriptive messages
- Run `bun test` before every commit
- Run `bun run check` for linting

## Communication
- Check for updates from other agents daily
- Notify dependent agents (3, 5) when Phase 1 completes
- Report completion of each phase to overseer

## Resources
- Full plan: `docs/absolute-relative-references-plan.md`
- Excel reference behavior documentation
- Existing formula parser in `packages/core/src/formula/`

## Quality Standards
- Follow TypeScript strict mode
- No `any` types
- No non-null assertions (!)
- Descriptive variable names
- Comments for complex logic only

Remember: This is a HIGH PRIORITY feature that blocks other agents. Focus on core functionality first, polish later.