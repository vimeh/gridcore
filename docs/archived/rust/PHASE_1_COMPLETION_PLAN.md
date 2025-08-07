# Plan to Complete Phase 1: Core Engine with WASM Bindings

## Overview
This document outlines the remaining work needed to fully complete Phase 1 of the Rust Core Migration. Currently, we have completed 7 out of 10 sub-phases in the detailed plan.

## Current Status

### Completed Components
- ✅ Basic types and error handling (CellAddress, CellValue, SpreadsheetError)
- ✅ Formula parser with Chumsky
- ✅ Core infrastructure (Cell repository, dependency graph)
- ✅ Formula evaluator with basic function library
- ✅ SpreadsheetFacade with batch operations
- ✅ Undo/Redo with Command pattern
- ✅ WASM bindings for all core components
- ✅ Basic TypeScript adapter (facade.ts)

### Partially Complete
- ⚠️ WASM bundle size: 541KB (target: < 500KB)
- ⚠️ TypeScript adapter: Only facade implemented, need full Workbook/Sheet API
- ⚠️ Test parity: Some TypeScript tests not yet validated against Rust

### Missing Components
- ❌ Fill engine (pattern detection, sequences)
- ❌ Reference system (parsing, adjustment, detection)
- ❌ Complete formula function library (statistical, text, date functions)
- ❌ Bulk operations (transform, format, find/replace)
- ❌ Feature flag system for gradual rollout
- ❌ Performance benchmarks comparing TypeScript vs Rust

## Phase 8: TypeScript Adapter Layer (Week 8)

### 8.1 Complete WASM Build Pipeline
```bash
# Build script with optimizations
wasm-pack build --target web --release \
  --out-dir pkg \
  -- --features wasm

# Optimize with wasm-opt
wasm-opt -O3 -o pkg/optimized.wasm pkg/gridcore_wasm_bg.wasm
```

### 8.2 Full TypeScript Adapter Implementation

#### Workbook Class
```typescript
// packages/core/src/rust-adapter/workbook.ts
import { SpreadsheetFacade } from './facade'
import { Sheet } from './sheet'

export class Workbook {
  private sheets: Map<string, Sheet>
  private activeSheet: string
  
  constructor() {
    this.sheets = new Map()
    this.activeSheet = 'Sheet1'
    this.addSheet('Sheet1')
  }
  
  addSheet(name: string): Sheet {
    const facade = new SpreadsheetFacade()
    const sheet = new Sheet(name, facade)
    this.sheets.set(name, sheet)
    return sheet
  }
  
  getSheet(name: string): Sheet | undefined {
    return this.sheets.get(name)
  }
  
  // ... rest of Workbook API
}
```

#### Sheet Class
```typescript
// packages/core/src/rust-adapter/sheet.ts
export class Sheet {
  constructor(
    private name: string,
    private facade: SpreadsheetFacade
  ) {}
  
  setCellValue(address: string, value: any): Result<Cell> {
    const addr = this.parseAddress(address)
    return this.facade.setCellValue(addr, value)
  }
  
  // ... rest of Sheet API
}
```

### 8.3 Integration Layer

#### Feature Flags
```typescript
// packages/core/src/index.ts
const FEATURE_FLAGS = {
  USE_RUST_CORE: process.env.USE_RUST_CORE === 'true',
  USE_RUST_FORMULAS: process.env.USE_RUST_FORMULAS === 'true',
  USE_RUST_FILL: process.env.USE_RUST_FILL === 'true',
}

let coreImplementation;

if (FEATURE_FLAGS.USE_RUST_CORE) {
  const wasmCore = await import('./rust-adapter')
  await wasmCore.init()
  coreImplementation = wasmCore
} else {
  coreImplementation = await import('./typescript-impl')
}

export const { Workbook, Cell, CellAddress } = coreImplementation
```

## Phase 9: Feature Parity Validation (Week 9)

### 9.1 Test Migration Strategy

1. **Identify all TypeScript tests**
   - Unit tests: 50+ test files
   - Integration tests: facade, structural operations, references
   - Performance tests: bulk operations

2. **Create parity test suite**
```typescript
// packages/core/tests/rust-parity.test.ts
import { describe, test, expect } from 'bun:test'
import { Workbook as TSWorkbook } from '../src/typescript-impl'
import { Workbook as RustWorkbook } from '../src/rust-adapter'

describe('Rust-TypeScript Parity', () => {
  test.each([
    ['TypeScript', TSWorkbook],
    ['Rust', RustWorkbook]
  ])('%s: should handle basic operations', async (name, WorkbookClass) => {
    const wb = new WorkbookClass()
    const sheet = wb.getSheet('Sheet1')
    
    // Test identical behavior
    sheet.setCellValue('A1', 10)
    sheet.setCellValue('B1', 20)
    sheet.setCellValue('C1', '=A1+B1')
    
    expect(sheet.getCellValue('C1')).toBe(30)
  })
})
```

### 9.2 Missing Features to Implement

#### Fill Engine
- Linear pattern detection
- Exponential pattern detection
- Fibonacci sequence detection
- Custom sequence patterns
- Date/time patterns

#### Reference System
- Reference parsing (A1, $A$1, A:A, 1:1)
- Reference adjustment on insert/delete
- Reference detection in formulas
- Range operations

#### Formula Functions
Missing functions to implement:
- Statistical: STDEV, VAR, MEDIAN, MODE, PERCENTILE
- Text: CONCATENATE, LEFT, RIGHT, MID, FIND, REPLACE
- Date: DATE, DAY, MONTH, YEAR, NOW, TODAY
- Logical: IF, AND, OR, NOT, IFERROR
- Lookup: VLOOKUP, HLOOKUP, INDEX, MATCH

### 9.3 API Compatibility Checklist

- [ ] Workbook class with all methods
- [ ] Sheet class with all methods
- [ ] Cell class with proper typing
- [ ] CellAddress with all utilities
- [ ] Event system (onChange, onRecalculate)
- [ ] Batch operations
- [ ] Transaction support
- [ ] Undo/redo integration
- [ ] Error handling with Result type

## Phase 10: Performance Optimization (Week 10)

### 10.1 WASM Bundle Optimization

Current size: 541KB → Target: < 500KB

Optimization strategies:
1. **Remove unused code**
   - Use `wee_alloc` instead of default allocator
   - Strip debug symbols in release
   - Remove unused dependencies

2. **Cargo.toml optimizations**
```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
codegen-units = 1   # Single codegen unit
strip = true        # Strip symbols
panic = "abort"     # Smaller panic handler
```

3. **Feature flags**
```toml
[features]
default = []
full = ["complex-formulas", "statistics", "charts"]
minimal = []  # Core features only
```

### 10.2 Performance Benchmarks

Create comprehensive benchmark suite:
```typescript
// packages/core/benchmarks/rust-vs-typescript.ts
import { benchmark } from './utils'

benchmark('Formula Evaluation', {
  typescript: () => {
    // TypeScript implementation
  },
  rust: () => {
    // Rust implementation
  }
})

benchmark('Large Spreadsheet (1M cells)', {
  typescript: () => {
    // TypeScript implementation
  },
  rust: () => {
    // Rust implementation
  }
})
```

Target metrics:
- Formula evaluation: 10x faster
- Memory usage: 50% reduction
- Startup time: < 100ms
- Recalculation: < 100ms for 10k dependencies

### 10.3 Critical Path Optimizations

1. **Formula parsing**: Cache parsed formulas
2. **Dependency graph**: Use bit vectors for visited tracking
3. **Cell storage**: Implement sparse matrix with chunks
4. **WASM boundary**: Batch operations to reduce crossings
5. **Memory management**: Implement object pooling

## Implementation Timeline

### Week 1 (Immediate)
- Day 1-2: Complete TypeScript adapter (Workbook, Sheet)
- Day 3: Set up feature flags and build pipeline
- Day 4-5: Run existing tests, identify gaps

### Week 2 (Feature Parity)
- Day 1-2: Implement fill engine
- Day 3: Implement reference system
- Day 4-5: Complete formula function library

### Week 3 (Optimization & Validation)
- Day 1-2: WASM bundle optimization
- Day 3: Performance benchmarking
- Day 4: Documentation
- Day 5: Final validation

## Success Criteria

### Required for Phase 1 Completion
- [ ] All core TypeScript tests pass with Rust implementation
- [ ] No performance regression (validated by benchmarks)
- [ ] Zero breaking changes in public API
- [ ] WASM bundle < 500KB
- [ ] Feature flags enable gradual rollout
- [ ] Documentation complete

### Nice to Have
- [ ] 10x performance improvement in formula evaluation
- [ ] 50% memory reduction
- [ ] WebAssembly SIMD optimizations
- [ ] Streaming compilation support

## Decision Point: Complete Phase 1 or Move to Phase 2?

### Arguments for Completing Phase 1
1. **Foundation stability**: Ensures core is rock-solid before building on it
2. **Risk mitigation**: Can rollback if issues found
3. **Performance validation**: Proves value of Rust migration
4. **Complete replacement**: True drop-in replacement ready

### Arguments for Moving to Phase 2
1. **Faster iteration**: Can validate controller/UI integration sooner
2. **User-facing features**: Phase 2 brings visible improvements
3. **Parallel development**: Can complete Phase 1 features while working on Phase 2
4. **Learning opportunity**: Phase 2 might inform Phase 1 requirements

### Recommendation
Consider moving to Phase 2 if:
- Core functionality (formulas, cells, basic operations) is working
- WASM integration is proven
- Team wants to validate full-stack Rust benefits

Complete Phase 1 first if:
- Need 100% feature parity before moving forward
- Performance is critical concern
- Want to minimize risk

## Files to Create/Modify

1. `/packages/core/src/rust-adapter/workbook.ts` - Complete Workbook class
2. `/packages/core/src/rust-adapter/sheet.ts` - Sheet wrapper class
3. `/packages/core/src/rust-adapter/index.ts` - Module exports
4. `/packages/core/src/index.ts` - Feature flag integration
5. `/packages/core/tests/rust-parity.test.ts` - Parity test suite
6. `/gridcore-wasm/build.sh` - Optimized build script
7. `/gridcore-wasm/Cargo.toml` - Optimization settings
8. `/docs/RUST_MIGRATION_GUIDE.md` - User migration guide
9. `/docs/RUST_PERFORMANCE_REPORT.md` - Benchmark results
10. `/packages/core/benchmarks/` - Performance comparison suite