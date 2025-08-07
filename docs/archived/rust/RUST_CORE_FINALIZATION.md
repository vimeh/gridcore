# Detailed Implementation Plan for Missing @gridcore-rs/ Features

## Executive Summary

The Rust implementation of GridCore is currently **75-80% complete**. This document outlines the remaining work needed to achieve full feature parity with the TypeScript implementation and enable complete replacement in production environments.

**Estimated Timeline:** 6 weeks  
**Critical Path:** Fill Engine → References System → Workbook/Sheet abstractions

## Current Status

### ✅ Completed Features
- **Core Engine:** Formula parsing, evaluation, cell storage, dependency tracking, undo/redo
- **Controller:** Full Vim behaviors, resize behaviors, selection management, state machine
- **Integration:** WASM bindings, TypeScript adapter, event system
- **Testing:** Performance tests, integration tests, WASM tests

### ❌ Missing Features (This Plan)
- Fill Engine (drag-to-fill operations)
- References System (reference parsing and adjustment)
- Workbook/Sheet abstractions (multi-sheet support)
- Advanced functions (VLOOKUP, INDEX, MATCH, etc.)
- Performance optimizations (sparse grid, caching)
- UI enhancements (formula highlighting, autocomplete)

---

## 1. Fill Engine System (Priority: Critical)

**Location:** `gridcore-core/src/fill/`  
**Timeline:** Week 1-2

### Module Structure
```
gridcore-core/src/fill/
├── mod.rs           # Module exports and types
├── engine.rs        # Main FillEngine implementation
├── patterns/
│   ├── mod.rs
│   ├── detector.rs  # Pattern detection logic
│   ├── numeric.rs   # Numeric series patterns
│   ├── date.rs      # Date/time patterns
│   ├── text.rs      # Text patterns
│   └── custom.rs    # Custom/formula patterns
├── adjuster.rs      # Formula reference adjuster
└── tests.rs         # Comprehensive tests
```

### Core Types

```rust
// fill/mod.rs
pub enum FillDirection {
    Down, Up, Left, Right
}

pub enum PatternType {
    Linear(f64),           // slope
    Exponential(f64),      // growth rate
    Date(Duration),        // increment
    Text,                  // copy or increment
    Custom(String),        // formula pattern
}

pub struct FillOperation {
    source_range: CellRange,
    target_range: CellRange,
    direction: FillDirection,
    pattern: Option<PatternType>,
}

pub struct FillResult {
    affected_cells: Vec<(CellAddress, CellValue)>,
    formulas_adjusted: Vec<(CellAddress, String)>,
}
```

### Key Components

#### Pattern Detector (`patterns/detector.rs`)
- Analyze 2+ cells to detect patterns
- Support numeric sequences (arithmetic, geometric)
- Detect date patterns (daily, weekly, monthly)
- Recognize text patterns with numbers
- Handle formula patterns with relative references

#### Formula Adjuster (`adjuster.rs`)
- Parse formulas during fill operations
- Adjust relative references based on fill direction
- Preserve absolute references ($A$1)
- Handle mixed references ($A1, A$1)

#### WASM Bindings
- Expose `FillEngine::fill()` method
- Return preview before confirmation
- Support undo/redo for fill operations

### Tests Required
- Pattern detection accuracy tests
- Formula adjustment correctness
- Edge cases (empty cells, mixed data)
- Performance with large ranges

---

## 2. References System (Priority: Critical)

**Location:** `gridcore-core/src/references/`  
**Timeline:** Week 3

### Module Structure
```
gridcore-core/src/references/
├── mod.rs
├── parser.rs        # Parse cell references from formulas
├── detector.rs      # Detect reference types
├── adjuster.rs      # Adjust references on structural changes
├── tracker.rs       # Track reference dependencies
└── tests.rs
```

### Core Types

```rust
pub enum ReferenceType {
    Relative(i32, i32),      // A1
    Absolute(u32, u32),      // $A$1
    MixedCol(u32, i32),      // $A1
    MixedRow(i32, u32),      // A$1
    Range(Box<Reference>, Box<Reference>), // A1:B10
    Sheet(String, Box<Reference>),         // Sheet1!A1
    External(String, Box<Reference>),      // [Book1]Sheet1!A1
}

pub struct ReferenceAdjuster {
    operation: StructuralOperation,
    affected_range: CellRange,
}
```

### Key Components

#### Reference Parser
- Use existing formula parser as base
- Extract all references from formula AST
- Classify reference types
- Build dependency map

#### Reference Adjuster
- Adjust references when rows/columns inserted/deleted
- Handle range expansion/contraction
- Update formulas in dependent cells
- Maintain reference integrity

### Integration Points
- Hook into structural operations
- Update dependency graph
- Trigger recalculation cascade

### Tests Required
- Reference parsing accuracy
- Adjustment correctness for all operations
- Cross-sheet reference handling
- Performance with many dependencies

---

## 3. Workbook/Sheet Abstractions (Priority: High)

**Location:** `gridcore-core/src/workbook/`  
**Timeline:** Week 4

### Module Structure
```
gridcore-core/src/workbook/
├── mod.rs
├── workbook.rs      # Workbook container
├── sheet.rs         # Individual sheet
├── sheet_manager.rs # Sheet operations
└── tests.rs
```

### Core Types

```rust
pub struct Workbook {
    sheets: HashMap<String, Sheet>,
    active_sheet: String,
    metadata: WorkbookMetadata,
    shared_formulas: HashMap<String, Formula>,
}

pub struct Sheet {
    name: String,
    cells: CellRepository,
    dependencies: DependencyGraph,
    properties: SheetProperties,
}

pub struct SheetProperties {
    visible: bool,
    protected: bool,
    column_widths: HashMap<u32, f64>,
    row_heights: HashMap<u32, f64>,
}
```

### Sheet Operations
- Create/delete/rename sheets
- Copy/move sheets
- Hide/show sheets
- Sheet protection

### Cross-Sheet Features
- Cross-sheet formulas (Sheet1!A1)
- Cross-sheet dependencies
- Cascade calculations across sheets
- Sheet-level undo/redo

### WASM Bindings
- Expose sheet management APIs
- Handle sheet switching in UI
- Maintain sheet state

### Tests Required
- Multi-sheet formula evaluation
- Sheet operation correctness
- Cross-sheet dependency tracking
- Memory efficiency with many sheets

---

## 4. Advanced Functions Library (Priority: High)

**Location:** `gridcore-core/src/evaluator/functions/`  
**Timeline:** Week 5

### Module Structure
```
gridcore-core/src/evaluator/functions/
├── mod.rs
├── lookup.rs        # VLOOKUP, HLOOKUP, INDEX, MATCH
├── datetime.rs      # DATE, TIME, NOW, TODAY
├── statistical.rs   # STDEV, VAR, MEDIAN, MODE
├── financial.rs     # PMT, FV, PV, RATE
├── text_advanced.rs # SUBSTITUTE, FIND, MID, TRIM
├── logical.rs       # IFS, SWITCH, XOR
└── array.rs         # FILTER, SORT, UNIQUE (dynamic arrays)
```

### Implementation Priority

#### Phase 1: Lookup Functions (Most requested)
- `VLOOKUP(lookup_value, table_array, col_index, [exact_match])`
- `HLOOKUP(lookup_value, table_array, row_index, [exact_match])`
- `INDEX(array, row_num, [col_num])`
- `MATCH(lookup_value, lookup_array, [match_type])`

#### Phase 2: Date/Time Functions
- `DATE(year, month, day)`
- `DATEDIF(start_date, end_date, unit)`
- `WORKDAY(start_date, days, [holidays])`
- `NETWORKDAYS(start_date, end_date, [holidays])`

#### Phase 3: Statistical Functions
- `STDEV.P`, `STDEV.S`
- `VAR.P`, `VAR.S`
- `MEDIAN`, `MODE.SNGL`
- `PERCENTILE`, `QUARTILE`

#### Phase 4: Text Functions
- `SUBSTITUTE(text, old_text, new_text, [instance])`
- `FIND(find_text, within_text, [start_num])`
- `MID(text, start_num, num_chars)`
- `PROPER`, `TRIM`, `CLEAN`

### Tests Required
- Function accuracy tests
- Edge case handling
- Performance with large datasets
- Compatibility with Excel/Google Sheets

---

## 5. Performance Optimizations (Priority: Medium)

**Location:** `gridcore-core/src/storage/`  
**Timeline:** Week 6

### Sparse Grid Implementation

```rust
pub struct SparseGrid<T> {
    chunks: HashMap<ChunkId, Chunk<T>>,
    chunk_size: usize, // e.g., 256x256
}

struct Chunk<T> {
    data: HashMap<LocalAddress, T>,
    bounds: ChunkBounds,
}
```

### Formula Cache

```rust
pub struct FormulaCache {
    parsed: LruCache<String, Expr>,
    evaluated: LruCache<CellAddress, CellValue>,
    dependencies: HashMap<CellAddress, HashSet<CellAddress>>,
}
```

### Lazy Evaluation
- Only calculate visible cells immediately
- Queue off-screen calculations
- Progressive calculation for large sheets

### Memory Optimizations
- Cell value compression
- Formula deduplication
- Efficient string interning

---

## 6. UI Enhancement Features (Priority: Medium)

**Location:** `gridcore-controller/src/ui/`  
**Timeline:** Week 6

### Formula Highlighter

```rust
pub struct FormulaHighlighter {
    syntax_rules: Vec<SyntaxRule>,
    color_scheme: ColorScheme,
}

pub struct HighlightSegment {
    start: usize,
    end: usize,
    style: HighlightStyle,
}
```

### Structural Operation Feedback

```rust
pub struct OperationFeedback {
    progress: f32,
    message: String,
    warnings: Vec<Warning>,
    affected_ranges: Vec<CellRange>,
}
```

### Autocomplete System

```rust
pub struct AutoComplete {
    function_names: Vec<String>,
    range_names: Vec<String>,
    recent_entries: LruCache<String, Vec<String>>,
}
```

---

## Implementation Schedule

### Week 1-2: Fill Engine
- [ ] Core fill engine implementation
- [ ] Pattern detection for numeric/date/text
- [ ] Formula adjuster
- [ ] WASM bindings and tests

### Week 3: References System  
- [ ] Reference parser and detector
- [ ] Reference adjuster for structural ops
- [ ] Integration with dependency system
- [ ] Comprehensive tests

### Week 4: Workbook/Sheet
- [ ] Basic workbook/sheet structure
- [ ] Sheet management operations
- [ ] Cross-sheet formulas
- [ ] WASM bindings

### Week 5: Advanced Functions
- [ ] Lookup functions (VLOOKUP, INDEX, MATCH)
- [ ] Date/time functions
- [ ] Additional text functions
- [ ] Function tests

### Week 6: Optimization & Polish
- [ ] Sparse grid implementation
- [ ] Formula cache
- [ ] UI enhancements (highlighter, feedback)
- [ ] Performance benchmarks

---

## Success Criteria

### Functional Requirements
- [ ] Fill operations work identically to TypeScript version
- [ ] All formula references update correctly on structural changes
- [ ] Multi-sheet support with cross-sheet formulas
- [ ] 20+ additional spreadsheet functions
- [ ] Feature parity with TypeScript implementation

### Performance Requirements
- [ ] 2x performance improvement on large sheets (10k+ cells)
- [ ] WASM bundle size <500KB gzipped
- [ ] Sub-100ms response time for typical operations
- [ ] Memory usage <50MB for 100k cells

### Quality Requirements
- [ ] All tests passing with >90% coverage
- [ ] Zero memory leaks in WASM
- [ ] TypeScript adapter 100% compatible
- [ ] Documentation for all public APIs

---

## Testing Strategy

### Unit Tests
- Each module with >90% coverage
- Property-based testing for complex algorithms
- Fuzzing for parser components

### Integration Tests
- Cross-module interactions
- WASM boundary testing
- TypeScript adapter compatibility

### Performance Tests
- Benchmarks for critical paths
- Memory usage profiling
- Large dataset stress tests

### Compatibility Tests
- Excel formula compatibility
- Google Sheets formula compatibility
- Cross-browser WASM support

### End-to-End Tests
- Full user workflows through UI
- Multi-sheet operations
- Import/export scenarios

---

## Risk Mitigation

### Technical Risks
1. **WASM Performance:** Profile early and often, optimize hot paths
2. **Memory Management:** Use Rust's ownership system effectively
3. **Browser Compatibility:** Test across all major browsers
4. **Bundle Size:** Monitor size continuously, use wasm-opt

### Schedule Risks
1. **Dependency on Core:** Prioritize blocking features
2. **Testing Time:** Automate testing early
3. **Integration Issues:** Continuous integration testing

---

## Deliverables

### Week 1-2
- Fill Engine module complete
- Pattern detection working
- Formula adjustment tested

### Week 3
- References System integrated
- Structural operations updated
- Dependency graph enhanced

### Week 4
- Workbook/Sheet structure complete
- Multi-sheet formulas working
- Sheet management APIs exposed

### Week 5
- 20+ new functions implemented
- Function compatibility tested
- Performance benchmarks complete

### Week 6
- All optimizations complete
- UI enhancements integrated
- Full test suite passing
- Documentation complete

---

## Post-Implementation

### Migration Guide
- Step-by-step migration from TypeScript
- Performance comparison metrics
- Feature compatibility matrix

### Maintenance Plan
- Regular performance profiling
- Continuous compatibility testing
- Feature parity tracking

### Future Enhancements
- Advanced array formulas
- Collaborative editing support
- Custom function API
- Plugin system

---

## Conclusion

This implementation plan provides a clear roadmap to achieve feature parity between the Rust and TypeScript implementations of GridCore. The focus on critical features first (Fill Engine, References System) ensures that the most important functionality is delivered early, while the modular approach allows for parallel development where possible.

With this plan executed, @gridcore-rs/ will be ready for full production deployment, offering superior performance while maintaining complete compatibility with existing TypeScript code.