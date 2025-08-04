# Agent Instructions: Formula Fill Feature

## Agent Assignment
- **Agent ID**: Agent-5
- **Feature**: Formula Fill and Extend Operations
- **Priority**: LOW
- **Worktree**: `/worktrees/formula-fill`

## Mission
Implement intelligent formula fill and extend operations with pattern detection, smart fill capabilities, and drag-to-fill UI functionality.

## Key Responsibilities

### Phase 1: Extend UIState and VimBehavior (Days 1-2)
1. Add fill mode to UIState discriminated union
2. Create fill state factory functions
3. Add fill commands to VimBehavior:
   - `Ctrl+d` - fill down
   - `gfd` - fill down as series
   - `gfr` - fill right as series
   - `gF` - smart fill to adjacent data
4. Implement fill transitions in UIStateMachine
5. Write unit tests for state transitions

### Phase 2: Core Fill Engine (Days 2-4)
**DEPENDENCY: Wait for Agent-1 to complete reference adjustment**
1. Implement basic fill operations in SpreadsheetController
2. Create pattern detection framework
3. Build formula adjustment system
4. Add fill options structure:
   - Copy cells
   - Fill series
   - Format only
   - Values only
5. Write unit tests

### Phase 3: Pattern Detection (Days 4-6)
1. Implement pattern detectors:
   - Numeric patterns (linear, growth)
   - Date patterns (daily, weekly, monthly)
   - Text patterns
   - Formula patterns
2. Auto-detection with confidence scoring
3. Handle complex patterns (Fibonacci, etc.)
4. Create pattern preview
5. Test pattern accuracy

## Technical Guidelines

### Code Location
- Fill engine: `packages/core/src/fill/FillEngine.ts`
- Pattern detection: `packages/core/src/fill/patterns/`
- UI integration: `packages/ui-core/src/behaviors/fill/`

### Key Interfaces
```typescript
interface FillOperation {
  source: CellRange;
  target: CellRange;
  direction: FillDirection;
  options: FillOptions;
}

interface Pattern {
  type: PatternType;
  confidence: number;
  generator: PatternGenerator;
}
```

### Pattern Types
- Linear: 1, 2, 3, 4...
- Growth: 2, 4, 8, 16...
- Date: Mon, Tue, Wed...
- Custom lists: Q1, Q2, Q3...

## Dependencies
- **SOFT DEPENDENCY**: Agent-1 (Absolute References) - For formula adjustment
- Can implement pattern detection independently

## Success Criteria
1. Pattern detection 90%+ accurate
2. Fill 10,000 cells < 200ms
3. Smart fill works intuitively
4. Formula references adjust correctly
5. Preview shows accurate results

## Progress Tracking
- Update `PROGRESS.md` at least twice daily
- Note dependency on Agent-1 in `BLOCKERS.md` if blocked
- Commit frequently with descriptive messages
- Run `bun test` before every commit
- Run `bun run check` for linting

## Communication
- Monitor Agent-1's progress for formula features
- Share pattern detection algorithms
- Coordinate with UI teams on fill handle
- Regular updates despite LOW priority

## Resources
- Full plan: `docs/formula-fill-extend-plan.md`
- Study Excel's fill behavior
- Pattern recognition algorithms
- Existing formula system

## Quality Standards
- High pattern detection accuracy
- Smooth UI interaction
- Clear visual feedback
- Efficient memory usage

## Implementation Strategy
Since this is LOW priority:
1. Focus on core functionality first
2. Simple patterns before complex ones
3. Keyboard fill before drag UI
4. Basic fill before smart detection

## Parallel Work
While waiting for dependencies:
1. Implement all pattern detectors
2. Build pattern test suite
3. Create fill preview system
4. Design fill handle UI

## Future Enhancements
- AI-powered pattern detection
- Custom pattern learning
- Cloud pattern library
- Fill templates

Remember: Though LOW priority, this feature significantly improves user productivity. Build it right.