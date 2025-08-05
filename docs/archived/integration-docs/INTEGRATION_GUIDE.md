# Integration Testing Guide

## Purpose
This worktree is dedicated to testing the integration of all five features being developed in parallel. It serves as the merge point and validation layer before features are merged to main.

## Integration Schedule

### Week 1
- Day 2: Test Agent-1 (Absolute refs) + Agent-2 (Col/Row selection) basic integration
- Day 4: Test reference updates in bulk operations

### Week 2  
- Day 1: Test insert/delete with reference updates
- Day 3: Test formula fill with all selection types
- Day 5: Full integration test suite

## Test Categories

### 1. Feature Interaction Tests
Located in: `packages/core/tests/integration/`

- **References + Selection**: Test reference cycling (F4) with column/row selections
- **References + Insert/Delete**: Verify formula updates after structural changes
- **Selection + Bulk Ops**: Test find/replace on column/row selections
- **Fill + References**: Verify proper reference adjustment during fill operations
- **All Features**: Complex scenarios using all features together

### 2. Performance Tests
Located in: `packages/core/tests/performance/`

- Large dataset operations (1M cells)
- Memory usage monitoring
- Operation timing benchmarks
- Concurrent operation stress tests

### 3. UI Integration Tests
Located in: `packages/ui-web/tests/e2e/integration/`

- Cross-platform behavior verification
- Visual feedback coordination
- Keyboard shortcut conflicts
- State management coherence

## Test Structure

```
integration/
├── packages/
│   ├── core/
│   │   └── tests/
│   │       ├── integration/
│   │       │   ├── references-selection.test.ts
│   │       │   ├── references-structure.test.ts
│   │       │   ├── selection-bulk.test.ts
│   │       │   ├── fill-references.test.ts
│   │       │   └── all-features.test.ts
│   │       └── performance/
│   │           ├── large-scale.bench.ts
│   │           └── memory-usage.bench.ts
│   └── ui-web/
│       └── tests/
│           └── e2e/
│               └── integration/
│                   ├── feature-interaction.spec.ts
│                   └── ui-coordination.spec.ts
├── scripts/
│   ├── merge-features.sh
│   ├── run-integration-tests.sh
│   └── check-conflicts.sh
└── reports/
    ├── test-results/
    ├── performance/
    └── conflicts/
```

## Integration Process

### Daily Integration (Morning)
1. Pull latest from all feature branches
2. Merge into integration branch
3. Resolve any conflicts
4. Run basic integration tests

### Feature Integration
When a feature completes a phase:
1. Agent marks phase complete in PROGRESS.md
2. Integration branch pulls the changes
3. Run targeted integration tests
4. Report results back to agent

### Pre-Merge Checklist
- [ ] All unit tests pass in feature branch
- [ ] Integration tests pass
- [ ] No performance regression
- [ ] No memory leaks
- [ ] Documentation updated
- [ ] Conflicts resolved

## Merge Order
Based on dependencies:
1. **First Wave** (no dependencies):
   - feature/absolute-refs
   - feature/col-row-selection
2. **Second Wave** (dependent on first):
   - feature/insert-delete (needs absolute-refs)
   - feature/bulk-ops (needs col-row-selection)
3. **Third Wave**:
   - feature/formula-fill (needs absolute-refs)

## Conflict Resolution

### Common Conflict Areas
1. **UIState.ts** - Multiple features extend state
2. **VimBehavior.ts** - Command additions
3. **SpreadsheetController.ts** - New methods
4. **Package exports** - New modules

### Resolution Strategy
1. Preserve all discriminated union members
2. Merge command maps carefully
3. Combine controller methods
4. Update barrel exports

## Quality Gates

### Before Merging to Main
1. **Functionality**: All features work as designed
2. **Integration**: Features work together seamlessly
3. **Performance**: No degradation from baseline
4. **Quality**: Code passes all lint checks
5. **Tests**: 100% of new code covered
6. **Docs**: User documentation complete

## Monitoring Dashboard
See `scripts/monitor-integration.sh` for real-time status of:
- Test results across features
- Merge conflicts
- Performance metrics
- Agent progress

## Communication Protocol
- Daily status in `INTEGRATION_STATUS.md`
- Blocking issues in `INTEGRATION_BLOCKERS.md`
- Performance reports in `reports/performance/`
- Conflict logs in `reports/conflicts/`