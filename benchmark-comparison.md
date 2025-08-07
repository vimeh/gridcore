# Benchmark Comparison: TypeScript vs Rust

Generated: 2025-08-07T04:59:55.935Z

## Cell Operations

| Benchmark | TypeScript (ops/sec) | TypeScript (avg ms) | Rust (ops/sec) | Rust (avg ms) | Notes |
|-----------|---------------------|-------------------|----------------|---------------|-------|
| Single cell write | 457,679 | 0.002 | - | - | TypeScript-only benchmark |
| Single cell read (existing) | 453,968 | 0.002 | - | - | TypeScript-only benchmark |
| Single cell read (non-existing) | 1,605,479 | 0.001 | - | - | TypeScript-only benchmark |
| Sequential writes (100 cells) | 440 | 2.274 | - | - | TypeScript-only benchmark |
| Sequential writes (1000 cells) | 8 | 130.840 | - | - | TypeScript-only benchmark |
| Random writes (100 cells) | 438 | 2.283 | - | - | TypeScript-only benchmark |
| Random writes (1000 cells) | 7 | 150.036 | - | - | TypeScript-only benchmark |
| Mixed read/write (50/50) | 11,383 | 0.088 | - | - | TypeScript-only benchmark |
| Cell updates (overwrite 100 cells) | 5,603 | 0.178 | - | - | TypeScript-only benchmark |
| Cell deletion (100 cells) | 411 | 2.435 | - | - | TypeScript-only benchmark |
| Memory impact (10k cells) | 0 | 6244.709 | - | - | TypeScript-only benchmark |

## Formula Calculations

| Benchmark | TypeScript (ops/sec) | TypeScript (avg ms) | Rust (ops/sec) | Rust (avg ms) | Notes |
|-----------|---------------------|-------------------|----------------|---------------|-------|
| Simple formula (=A1+B1) | 81,380 | 0.012 | - | - | TypeScript-only benchmark |
| Multiple operations (=A1*B1+C1-D1) | 44,312 | 0.023 | - | - | TypeScript-only benchmark |
| SUM function (10 cells) | 19,965 | 0.050 | - | - | TypeScript-only benchmark |
| SUM function (100 cells) | 2,090 | 0.479 | - | - | TypeScript-only benchmark |
| AVERAGE function (50 cells) | 4,449 | 0.225 | - | - | TypeScript-only benchmark |
| Nested IF statements | 33,931 | 0.029 | - | - | TypeScript-only benchmark |
| Formula chain (10 cells) | 5,772 | 0.173 | - | - | TypeScript-only benchmark |
| Formula chain (100 cells) | 50 | 20.061 | - | - | TypeScript-only benchmark |
| Complex formulas (10 cells) | 356 | 2.810 | - | - | TypeScript-only benchmark |
| Circular dependency detection | 47,671 | 0.021 | - | - | TypeScript-only benchmark |
| Formula recalculation (dependency update) | 34,038 | 0.029 | - | - | TypeScript-only benchmark |
| Multiple dependencies (diamond pattern) | 33,807 | 0.030 | - | - | TypeScript-only benchmark |
| Mixed cell references | 8,056 | 0.124 | - | - | TypeScript-only benchmark |
| String functions (CONCAT, UPPER, LOWER) | 59,692 | 0.017 | - | - | TypeScript-only benchmark |
| Large formula (many operations) | 8,727 | 0.115 | - | - | TypeScript-only benchmark |
| [Rust] row_insert/complex_formula | - | - | 3,501,733 | 0.000 | Rust-only benchmark |
| [Rust] row_insert/simple_formula | - | - | 14,381,321 | 0.000 | Rust-only benchmark |
| [Rust] row_insert/nested_formula | - | - | 2,757,477 | 0.000 | Rust-only benchmark |
| [Rust] row_insert/large_range | - | - | 20,574,711 | 0.000 | Rust-only benchmark |
| [Rust] column_delete/simple_formula | - | - | 11,879,472 | 0.000 | Rust-only benchmark |

## Batch Operations

| Benchmark | TypeScript (ops/sec) | TypeScript (avg ms) | Rust (ops/sec) | Rust (avg ms) | Notes |
|-----------|---------------------|-------------------|----------------|---------------|-------|
| Batch write (10 cells) | 26,694 | 0.037 | - | - | TypeScript-only benchmark |
| Batch write (100 cells) | 1,041 | 0.961 | - | - | TypeScript-only benchmark |
| Batch write (1000 cells) | 20 | 49.295 | - | - | TypeScript-only benchmark |
| Batch write (10000 cells) | 0 | 4836.100 | - | - | TypeScript-only benchmark |
| Non-batched writes (1000 cells) | 7 | 138.619 | - | - | TypeScript-only benchmark |
| Batched writes (1000 cells) | 20 | 49.598 | - | - | TypeScript-only benchmark |
| Batch with formulas (500 cells) | 733 | 1.365 | - | - | TypeScript-only benchmark |
| Batch rollback (1000 cells) | 5,316 | 0.188 | - | - | TypeScript-only benchmark |
| Nested batches (3 levels) | 12,727 | 0.079 | - | - | TypeScript-only benchmark |
| Mixed batch operations (5000 ops) | 229 | 4.373 | - | - | TypeScript-only benchmark |
| Batch with cascading updates | 1,068 | 0.936 | - | - | TypeScript-only benchmark |
| Memory impact - large batch (10k cells) | 0 | 4436.542 | - | - | TypeScript-only benchmark |

## Summary

### Key Findings

1. **TypeScript Implementation**: Complete feature set with comprehensive benchmarks
2. **Rust Implementation**: Currently focused on formula transformations and undo/redo
3. **Performance Characteristics**:
   - Rust shows excellent performance for formula AST operations (sub-microsecond)
   - TypeScript handles complex spreadsheet operations well
   - Both implementations would benefit from comparable benchmarks

### Recommendations

1. **Add matching benchmarks** to enable direct comparison:
   - Rust needs: Cell read/write, batch operations, formula evaluation
   - TypeScript needs: AST transformation, structural operations
2. **Consider hybrid approach**: Use Rust for performance-critical operations
3. **Profile real-world usage**: Synthetic benchmarks may not reflect actual usage patterns
