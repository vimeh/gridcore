# Integration Test Plan - GridCore Features

**Date**: 2025-08-05
**Integration Branch**: integration

## 📋 Integration Waves

### Wave 1: Agent 2 Production Integration (Morning)
**Feature**: Column/Row Selection (100% Complete)

#### Pre-Integration Checklist
- [ ] Verify all tests pass in isolation
- [ ] Check for file conflicts with main branch
- [ ] Review API changes and exports
- [ ] Validate performance benchmarks

#### Integration Steps
1. Merge col-row-selection branch to integration
2. Run full test suite
3. Manual testing of vim commands (V, gC, Ctrl+v)
4. Performance test with 10,000+ row selections
5. Update documentation

#### Test Scenarios
- [ ] Basic column selection with gC
- [ ] Row selection with V  
- [ ] Block selection with Ctrl+v
- [ ] Selection with operations (delete, copy, paste)
- [ ] Large selection performance (10k, 50k, 100k rows)
- [ ] Selection persistence across mode changes

### Wave 2: Cross-Feature Integration Tests (Afternoon)

#### Test Set A: Agent 1 + Agent 3 (References + Insert/Delete)
**Status**: Both 80% complete

Test Scenarios:
- [ ] Insert row with formulas containing absolute references
- [ ] Delete column referenced by $A$1 style references
- [ ] F4 cycling after structural operations
- [ ] Reference adjustment validation
- [ ] #REF! error generation and handling

#### Test Set B: Agent 2 + Agent 4 (Selection + Bulk Operations)
**Status**: Selection complete, Bulk ops 60% complete

Test Scenarios:
- [ ] Find/replace on column selection
- [ ] Bulk operations on row selections
- [ ] Performance with large selections (100k cells)
- [ ] Preview system with selections
- [ ] Undo/redo of bulk operations on selections

#### Test Set C: Agent 1 + Agent 5 (References + Fill)
**Status**: References 80%, Fill 70% complete

Test Scenarios:
- [ ] Fill formulas with absolute references
- [ ] Pattern detection with reference adjustments
- [ ] Fill down with mixed reference types
- [ ] Preview showing reference changes

### Wave 3: Combined Feature Tests (Tomorrow)

#### Mega Test: All Features Together
- [ ] Select column (Agent 2)
- [ ] Find/replace in selection (Agent 4)
- [ ] With formulas containing absolute refs (Agent 1)
- [ ] Then insert rows (Agent 3)
- [ ] And fill formulas down (Agent 5)

## 🧪 Test Infrastructure

### Required Test Utilities
```typescript
// integration-test-utils.ts
- createTestSpreadsheet()
- populateWithFormulas() 
- measureOperationTime()
- validateReferences()
- checkFormulaIntegrity()
```

### Performance Benchmarks
| Operation | Target | Pass Criteria |
|-----------|---------|--------------|
| Column Selection | < 50ms | 10k rows |
| Find/Replace | < 1s | 100k cells |
| Insert/Delete | < 200ms | 1k rows |
| Formula Fill | < 200ms | 10k cells |

### Error Scenarios to Test
1. Circular reference detection after operations
2. Memory limits with massive selections
3. Undo/redo across feature boundaries
4. Concurrent operations handling
5. Edge cases (max rows/cols)

## 📊 Success Criteria

### Functional
- [ ] All individual feature tests pass
- [ ] Cross-feature operations work correctly
- [ ] No regression in existing functionality
- [ ] Consistent vim behavior across features

### Performance  
- [ ] Meet or exceed all performance targets
- [ ] No memory leaks in long operations
- [ ] Smooth UI responsiveness

### Quality
- [ ] Zero TypeScript errors
- [ ] All linting rules pass
- [ ] Test coverage > 80%
- [ ] Clear error messages

## 🚨 Rollback Plan

If critical issues found:
1. Revert integration branch to last stable
2. Isolate problematic feature
3. Fix in feature branch
4. Re-attempt integration

## 📝 Documentation Updates

After successful integration:
- [ ] Update main README with new features
- [ ] Create feature showcase videos
- [ ] Write vim command reference
- [ ] Update performance benchmarks
- [ ] Create user guide for each feature

## 🎯 Timeline

**Day 1 (Tomorrow Morning)**
- 9:00 AM - Wave 1 Integration (Agent 2)
- 11:00 AM - Wave 2 Test Set A
- 2:00 PM - Wave 2 Test Set B
- 4:00 PM - Wave 2 Test Set C

**Day 2**
- Wave 3 Combined Tests
- Performance profiling
- Documentation updates
- Prepare for main branch merge