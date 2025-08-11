# Phase 4.2: Data Structure Optimization Benchmark Results

## Baseline Metrics (Before Optimizations)

Date: 2025-08-11

### Memory Allocation Patterns

```
Test Case                       | Allocations | Deallocations | Bytes Allocated
--------------------------------|-------------|---------------|----------------
cell_creation (1000 cells)      | TBD         | TBD           | TBD
cell_cloning (100 cells)        | TBD         | TBD           | TBD
formula_parsing (500 formulas)  | TBD         | TBD           | TBD
repository_batch_insert (10K)   | TBD         | TBD           | TBD
address_to_string (10K)         | TBD         | TBD           | TBD
small_hashmap_ops (100x10)      | TBD         | TBD           | TBD
vec_without_capacity (100x100)  | TBD         | TBD           | TBD
vec_with_capacity (100x100)     | TBD         | TBD           | TBD
```

## Optimization 1: FxHashMap Replacement

**Changes Made:**
- Replaced `HashMap` with `FxHashMap` in:
  - `workbook/sheet.rs`: column_widths, row_heights, named_ranges
  - `dependency/graph.rs`: node_map
  - `services/batch_manager.rs`: batches
  - `behaviors/vim/mod.rs`: registers, marks, _settings

**Expected Benefits:**
- Faster hashing algorithm (FxHash vs SipHash)
- Better performance for integer keys
- Reduced CPU cycles for hash operations

### Benchmark Results After FxHashMap

```
Test Case                       | Allocations | Change | Bytes Allocated | Change
--------------------------------|-------------|--------|-----------------|--------
small_hashmap_ops (100x10)      | TBD         | TBD%   | TBD             | TBD%
repository_batch_insert (10K)   | TBD         | TBD%   | TBD             | TBD%
```

## Optimization 2: Vec Capacity Hints

**Changes Made:**
- Added `Vec::with_capacity()` in:
  - `fill/engine.rs`:
    - `get_source_values()`: capacity = range.iter_cells().count()
    - `generate_values()`: capacity = target_range.iter_cells().count()
    - `adjust_formulas()`: capacity = source_count * target_count
  - `evaluator/engine.rs`:
    - `evaluate_function()`: capacity = args.len()
    - Range evaluation: capacity = cells.len()
    - `evaluate_range()`: capacity = cells.len()
  - `repository/cell_repository.rs`:
    - `shift_rows()`: capacity = self.cells.len()
    - `shift_columns()`: capacity = self.cells.len()

**Expected Benefits:**
- Eliminated reallocation during vector growth
- Reduced memory fragmentation
- Fewer allocator calls

### Benchmark Results After Vec Capacity Hints

```
Test Case                       | Allocations | Change | Bytes Allocated | Change
--------------------------------|-------------|--------|-----------------|--------
vec_without_capacity (100x100)  | TBD         | -      | TBD             | -
vec_with_capacity (100x100)     | TBD         | TBD%   | TBD             | TBD%
formula_parsing (500 formulas)  | TBD         | TBD%   | TBD             | TBD%
repository_batch_insert (10K)   | TBD         | TBD%   | TBD             | TBD%
```

## Future Optimizations (Planned)

### Optimization 3: String Interning
- Target: Cell addresses, sheet names
- Expected reduction: 40-60% in string allocations

### Optimization 4: Object Pooling
- Target: Temporary vectors in evaluator and fill engine
- Expected reduction: 30-50% in allocations during evaluation

### Optimization 5: Cow<'_, str> for Formula Text
- Target: Formula storage and processing
- Expected reduction: 20-30% in string cloning

## Summary

| Metric                     | Before | After | Improvement |
|----------------------------|--------|-------|-------------|
| Total Allocations          | TBD    | TBD   | TBD%        |
| Total Bytes Allocated      | TBD    | TBD   | TBD%        |
| HashMap Operations (ns)    | TBD    | TBD   | TBD%        |
| Vec Reallocations          | TBD    | TBD   | TBD%        |
| String Allocations         | TBD    | TBD   | TBD%        |

## Test Environment
- OS: macOS
- Rust Version: 1.XX.X
- CPU: [System specs]
- Memory: [System specs]
- Build Profile: Release with LTO

## Notes
- Measurements taken using custom allocator tracking
- Each benchmark run 100 times, median values reported
- All tests run with warm cache