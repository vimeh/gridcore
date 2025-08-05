# GridCore Performance Benchmarks

This directory contains performance benchmarks for the GridCore spreadsheet engine.

## Running Benchmarks

### Run all benchmarks
```bash
bun run bench
```

### Run specific benchmark suites
```bash
bun run bench:cell      # Cell operations
bun run bench:formula   # Formula calculations
bun run bench:batch     # Batch operations
```

### Run with custom options
```bash
bun run benchmarks/index.ts --suite "Cell Operations"
bun run benchmarks/index.ts --list  # List available suites
```

### Quick demo
```bash
bun run benchmarks/quick-demo.ts
```

## Benchmark Suites

### 1. Cell Operations (`cell-operations.bench.ts`)
Tests fundamental cell operations:
- Single cell read/write
- Sequential vs random access patterns
- Cell updates and deletions
- Memory impact measurements

### 2. Formula Calculations (`formula-calculation.bench.ts`)
Tests formula evaluation performance:
- Simple arithmetic formulas
- Function calls (SUM, AVERAGE, etc.)
- Formula chains and dependencies
- Circular dependency detection
- Complex nested formulas

### 3. Batch Operations (`batch-operations.bench.ts`)
Tests transaction-like batch updates:
- Various batch sizes (10 to 10,000 cells)
- Batch vs non-batch comparison
- Batch rollback performance
- Nested transactions

## Benchmark Results

Results are saved to `results/benchmark-results-{timestamp}.json` with:
- System information
- Detailed performance metrics
- Statistical analysis (min, max, percentiles)

## Performance Metrics

Each benchmark measures:
- **Throughput**: Operations per second
- **Latency**: Average, min, max, P50, P95, P99
- **Memory Usage**: Heap and RSS deltas
- **CPU Usage**: Time spent in operations

## Adding New Benchmarks

1. Create a new file in `suites/` directory
2. Export an async function that returns benchmark results
3. Add to `BENCHMARK_SUITES` in `index.ts`
4. Optionally add a npm script in package.json

Example:
```typescript
export async function runMyBenchmarks() {
  const runner = new BenchmarkRunner()
  
  await runner.suite("My Suite", async (bench) => {
    await bench("My test", () => {
      // Test code here
    })
  })
  
  return runner.getResults()
}
```