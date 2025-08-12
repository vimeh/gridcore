# GridCore UI Benchmark Usage Guide

## Overview
The GridCore UI includes a comprehensive performance benchmarking system that allows you to measure rendering performance, interaction responsiveness, and memory usage directly from the browser interface.

## Running Benchmarks from the UI

### Quick Benchmark
1. Open GridCore in your browser (http://localhost:8080)
2. Click the **"Quick Benchmark"** button in the top toolbar
3. Wait for the benchmark to complete (takes ~5-10 seconds)
4. View results in the overlay that appears

The quick benchmark runs a single scroll performance test with minimal iterations, perfect for quick performance checks during development.

### Full Benchmark Suite
1. Open GridCore in your browser
2. Click the **"Full Benchmark Suite"** button in the top toolbar
3. Wait for all benchmarks to complete (takes ~30-60 seconds)
4. View comprehensive results in the overlay

The full suite runs:
- Smooth scroll performance test
- Jump navigation test
- Large dataset scroll test (100K rows)

## Understanding the Results

### Quick Benchmark Output
```
Benchmark Complete!
Scenarios: 1
Avg FPS: 58.3
P95 FPS: 55.2
Avg Latency: 12.3ms
Memory Growth: 0.5MB
```

### Full Benchmark Report
```
=== Benchmark Report ===
Total Scenarios: 3
Successful: 3
Failed: 0
Total Duration: 45231.2ms

=== Performance ===
Avg FPS: 57.8
P95 FPS: 52.1
Avg Latency: 15.2ms
P95 Latency: 28.3ms
Memory Growth: 2.34MB

=== Warnings ===
⚠️ Low FPS detected in 'Large Dataset Scroll': 28.5 FPS (target: 60 FPS)

=== Suggestions ===
💡 Consider optimizing rendering performance - average FPS is below 50
```

## Performance Metrics Explained

### FPS (Frames Per Second)
- **Target**: 60 FPS for smooth performance
- **Acceptable**: 30+ FPS for heavy operations
- **P95**: 95th percentile - worst-case performance

### Latency
- **Input Latency**: Time from user action to visual feedback
- **Target**: <50ms for cell editing
- **Target**: <100ms for selection operations

### Memory
- **Memory Growth**: Amount of memory allocated during benchmark
- **Target**: <10MB for standard operations
- **Warning**: >50MB indicates potential memory leak

## Running Benchmarks Programmatically

### From Console
```javascript
// Access the demo controller and run benchmarks
// Note: This requires accessing internal Leptos state
```

### From Rust Code
```rust
use gridcore_ui::benchmark::{
    runner::UIBenchmarkRunner,
    scenarios::scroll::SmoothScrollBenchmark,
    config::BenchmarkPresets,
};

// Create benchmark runner
let mut runner = UIBenchmarkRunner::new(controller)
    .with_config(BenchmarkPresets::standard());

// Add scenarios
runner.add_scenario(Box::new(SmoothScrollBenchmark::new()));

// Run benchmarks
let report = runner.run_all();
println!("Results: {:?}", report.summary);
```

## Available Benchmark Scenarios

### Currently Implemented
1. **Smooth Scroll** - Measures FPS during smooth vertical scrolling
2. **Jump Navigation** - Tests viewport updates for large position jumps
3. **Large Dataset Scroll** - Performance with 100K+ rows of data

### Coming Soon
4. **Cell Edit** - Input latency for cell editing operations
5. **Selection** - Performance of range and multi-select operations
6. **Formula Calculation** - Formula engine performance impact
7. **Memory Test** - Long-running memory usage patterns
8. **Canvas Rendering** - Draw call optimization testing

## Customizing Benchmarks

### Configuration Presets
- **Smoke Test**: Quick validation (1 warmup, 3 iterations)
- **Standard**: Default configuration (3 warmup, 10 iterations)
- **Thorough**: Detailed testing (5 warmup, 20 iterations)
- **Mobile**: Simulates mobile device (throttled CPU/network)
- **Low-End**: Tests on constrained resources

### Custom Configuration
```rust
use gridcore_ui::benchmark::BenchmarkConfig;

let config = BenchmarkConfig::default()
    .with_iterations(5, 15)  // 5 warmup, 15 measurement
    .with_viewport(1920, 1080)
    .with_cpu_throttle(4.0);  // 4x slowdown
```

## Interpreting Warnings

### Common Warnings
- **"Low FPS detected"**: Frame rate below 30 FPS
- **"High input latency"**: Response time >100ms
- **"Significant memory growth"**: >10MB allocated
- **"Dropped frames detected"**: Stuttering during animation

### Performance Thresholds
| Metric | Excellent | Good | Acceptable | Poor |
|--------|-----------|------|------------|------|
| FPS | 60 | 50-59 | 30-49 | <30 |
| Input Latency | <16ms | 16-50ms | 50-100ms | >100ms |
| Memory/Cell | <10KB | 10-50KB | 50-100KB | >100KB |
| Scroll Jank | 0% | <5% | 5-10% | >10% |

## Tips for Best Results

### Before Running Benchmarks
1. Close unnecessary browser tabs
2. Disable browser extensions (especially React/Vue DevTools)
3. Use Chrome or Edge for best performance metrics
4. Ensure no background processes are consuming CPU

### During Benchmarks
1. Don't interact with the page
2. Keep the browser tab in focus
3. Wait for all benchmarks to complete
4. Run multiple times for consistency

### After Benchmarks
1. Compare results across different scenarios
2. Look for performance regressions
3. Identify bottlenecks from warnings
4. Use Chrome DevTools for deeper profiling

## Troubleshooting

### Benchmark Won't Start
- Check browser console for errors
- Ensure spreadsheet is loaded
- Try refreshing the page

### Inconsistent Results
- Close other applications
- Run benchmarks multiple times
- Use incognito/private mode
- Check for thermal throttling

### Memory Metrics Show 0
- Chrome: Enable `--enable-precise-memory-info` flag
- Firefox: Memory metrics not available
- Safari: Limited memory information

## CI/CD Integration

### Running in CI
```bash
# Start the development server
trunk serve --port 8080 &

# Wait for server to start
sleep 5

# Run benchmarks with Playwright
npx playwright test benchmarks.spec.ts
```

### Playwright Test Example
```typescript
test('Run performance benchmarks', async ({ page }) => {
  await page.goto('http://localhost:8080');
  
  // Click benchmark button
  await page.click('button:has-text("Quick Benchmark")');
  
  // Wait for results
  await page.waitForSelector('text=/Benchmark Complete/');
  
  // Extract metrics
  const results = await page.textContent('pre');
  console.log(results);
  
  // Assert performance thresholds
  expect(results).toContain('Avg FPS:');
  const fps = parseFloat(results.match(/Avg FPS: ([\d.]+)/)[1]);
  expect(fps).toBeGreaterThan(30);
});
```

## Export Formats

### JSON Export
Results can be exported as JSON for analysis:
```json
{
  "timestamp": 1642329600000,
  "scenarios": [...],
  "summary": {
    "avg_fps": 57.8,
    "p95_fps": 52.1,
    "avg_latency": 15.2,
    "memory_growth": 2.34
  }
}
```

### CSV Export
For spreadsheet analysis:
```csv
Scenario,Iteration,Success,FPS_Avg,FPS_P95,Latency_Avg,Memory_Growth
Smooth Scroll,1,true,58.3,55.2,12.3,0.5
Jump Navigation,1,true,45.2,41.8,23.1,1.2
```

## Contributing New Benchmarks

To add a new benchmark scenario:

1. Create a new file in `gridcore-ui/src/benchmark/scenarios/`
2. Implement the `BenchmarkScenario` trait
3. Register in `scenarios/mod.rs`
4. Add to UI menu in `demo/mod.rs`

Example:
```rust
pub struct MyBenchmark {
    // benchmark state
}

impl BenchmarkScenario for MyBenchmark {
    fn name(&self) -> &str { "My Benchmark" }
    fn description(&self) -> &str { "Tests specific functionality" }
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) { /* ... */ }
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult { /* ... */ }
    fn cleanup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) { /* ... */ }
}
```