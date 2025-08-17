# GridCore Benchmarks

Performance benchmarks for all three layers of the GridCore architecture.

## Structure

```
benches/
├── src/
│   ├── core/          # Core business logic benchmarks
│   ├── controller/    # State management benchmarks  
│   └── ui/           # UI rendering benchmarks (WASM)
```

## Running Benchmarks

### Core Benchmarks
```bash
cargo bench --bench transformer_bench
cargo bench --bench structural_ops_bench
cargo bench --bench fill_bench
cargo bench --bench memory_bench
cargo bench --bench undo_redo_benchmark
```

### Controller Benchmarks
```bash
cargo bench --bench viewport_bench
cargo bench --bench selection_bench
cargo bench --bench vim_bench
cargo bench --bench event_handling_bench
```

### UI Benchmarks
UI benchmarks require WASM context and use wasm-bindgen-test:
```bash
wasm-pack test --headless --chrome gridcore-rs/benches
```

### Run All Native Benchmarks
```bash
cargo bench
```

## Benchmark Categories

### Core Layer
- **transformer_bench**: Formula transformation and optimization
- **structural_ops_bench**: Insert/delete row/column operations
- **fill_bench**: Pattern detection and fill operations
- **memory_bench**: Memory usage and allocation patterns
- **undo_redo_benchmark**: Command history performance

### Controller Layer
- **viewport_bench**: Viewport scrolling and cell position calculations
- **selection_bench**: Selection creation, iteration, and bounds checking
- **vim_bench**: Vim command parsing and execution
- **event_handling_bench**: Keyboard/mouse event processing

### UI Layer (WASM)
- **render_bench**: Canvas rendering performance
- **interaction_bench**: Mouse and keyboard interaction handling

## Customizing Benchmark Runs

### Quick runs (for development)
```bash
cargo bench --bench <name> -- --warm-up-time 0.5 --measurement-time 1 --sample-size 10
```

### Detailed runs (for reporting)
```bash
cargo bench --bench <name> -- --warm-up-time 3 --measurement-time 10 --sample-size 100
```

### Save baseline
```bash
cargo bench --bench <name> -- --save-baseline main
```

### Compare against baseline
```bash
cargo bench --bench <name> -- --baseline main
```