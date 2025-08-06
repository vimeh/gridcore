# Rust Core Migration Plan - Detailed Implementation

## Overview

This document outlines the migration of `@gridcore/core` from TypeScript to Rust with WASM bindings. The approach emphasizes iterative development with continuous WASM integration, using chumsky for formula parsing and maintaining full TypeScript API compatibility.

## Core Strategy: Iterative Development with Continuous WASM Integration

Each component will be immediately exposed via WASM bindings after implementation, ensuring continuous validation of the Rust-TypeScript boundary.

## Phase 1: Foundation & Basic Types (Week 1)

### 1.1 Project Setup

```
gridcore-rs/
├── Cargo.toml (workspace)
├── gridcore-core/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── error.rs
│       ├── types/
│       └── wasm/
└── gridcore-wasm/
    ├── Cargo.toml
    ├── package.json
    └── src/lib.rs
```

### 1.2 Error System

```rust
// gridcore-core/src/error.rs
use thiserror::Error;

#[derive(Debug, Error, Clone)]
#[cfg_attr(feature = "wasm", derive(serde::Serialize))]
pub enum SpreadsheetError {
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Invalid cell reference: {0}")]
    InvalidRef(String),
    #[error("Invalid cell address: {0}")]
    InvalidAddress(String),
    #[error("#DIV/0!")]
    DivideByZero,
    #[error("#VALUE!")]
    ValueError,
    #[error("#REF!")]
    RefError,
    #[error("#NAME?")]
    NameError,
    #[error("#NUM!")]
    NumError,
    #[error("Circular dependency detected")]
    CircularDependency,
}

pub type Result<T> = std::result::Result<T, SpreadsheetError>;
```

### 1.3 CellValue with WASM Bindings

```rust
// gridcore-core/src/types/cell_value.rs
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    Number(f64),
    String(String),
    Boolean(bool),
    Null,
    Error(String),
}

#[wasm_bindgen]
impl CellValue {
    #[wasm_bindgen(constructor)]
    pub fn from_js(value: JsValue) -> Result<CellValue, JsValue> {
        // Handle JS type conversion
    }
    
    #[wasm_bindgen(js_name = "toJS")]
    pub fn to_js(&self) -> JsValue {
        // Convert to JS representation
    }
}
```

### 1.4 CellAddress with Chumsky Parser

```rust
// gridcore-core/src/types/cell_address.rs
use chumsky::prelude::*;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct CellAddress {
    #[wasm_bindgen(readonly)]
    pub col: u32,
    #[wasm_bindgen(readonly)]
    pub row: u32,
}

impl CellAddress {
    // Chumsky parser for A1 notation
    fn parser() -> impl Parser<char, CellAddress, Error = Simple<char>> {
        let col = text::ascii::uppercase()
            .repeated()
            .at_least(1)
            .collect::<String>()
            .map(|s| {
                s.chars().fold(0u32, |acc, c| {
                    acc * 26 + (c as u32 - 'A' as u32 + 1)
                }) - 1
            });
        
        let row = text::int(10)
            .map(|s: String| s.parse::<u32>().unwrap() - 1);
        
        col.then(row)
            .map(|(col, row)| CellAddress { col, row })
    }
}

#[wasm_bindgen]
impl CellAddress {
    #[wasm_bindgen(constructor)]
    pub fn new(col: u32, row: u32) -> CellAddress {
        CellAddress { col, row }
    }
    
    #[wasm_bindgen(js_name = "fromString")]
    pub fn from_string(s: &str) -> Result<CellAddress, JsValue> {
        CellAddress::from_str(s)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "toString")]
    pub fn to_string(&self) -> String {
        format!("{}{}", 
            column_number_to_label(self.col),
            self.row + 1
        )
    }
}
```

**Immediate Testing:** Create TypeScript tests that validate CellValue and CellAddress work correctly through WASM.

## Phase 2: Formula AST & Parser (Week 2) ✅ COMPLETED

**Status:** Implementation complete with manual recursive descent parser. The original plan used Chumsky 0.9 API, but we're using 0.10 which is a complete rewrite with breaking changes. Rather than migrate the parser design to the new API during implementation, a simpler manual parser was built.

**Future Work:** Once familiar with Chumsky 0.10's new API (zero-copy parsing, context-sensitive grammars, pratt combinators), we can rewrite the parser to use it for better error recovery and performance.

**Test Coverage:** Basic tests implemented. See [FORMULA_PARSER_TEST_PLAN.md](./FORMULA_PARSER_TEST_PLAN.md) for comprehensive test plan to be implemented before Phase 3.

### 2.1 Formula AST Definition ✅

```rust
// gridcore-core/src/formula/ast.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Expr {
    Literal(CellValue),
    Reference(CellAddress),
    Range(CellRange),
    FunctionCall {
        name: String,
        args: Vec<Expr>,
    },
    UnaryOp {
        op: UnaryOperator,
        expr: Box<Expr>,
    },
    BinaryOp {
        op: BinaryOperator,
        left: Box<Expr>,
        right: Box<Expr>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BinaryOperator {
    Add, Subtract, Multiply, Divide, Power,
    Equal, NotEqual, LessThan, GreaterThan,
    LessThanOrEqual, GreaterThanOrEqual,
    Concat,
}
```

### 2.2 Chumsky Formula Parser ✅ (Manual Implementation)

**Note:** The design below targets Chumsky 0.9. We implemented a manual recursive descent parser instead because Chumsky 0.10 (which we're using) is a complete rewrite with different APIs. The manual parser works well for our current needs.

```rust
// gridcore-core/src/formula/parser.rs (original Chumsky 0.9 design - not implemented)
use chumsky::prelude::*;

pub struct FormulaParser;

impl FormulaParser {
    pub fn parser() -> impl Parser<char, Expr, Error = Simple<char>> {
        recursive(|expr| {
            // Literals
            let number = text::int(10)
                .then(just('.').then(text::digits(10)).or_not())
                .map(|(int, frac)| {
                    let s = match frac {
                        Some((_, frac)) => format!("{}.{}", int, frac),
                        None => int,
                    };
                    Expr::Literal(CellValue::Number(s.parse().unwrap()))
                });
            
            let string = just('"')
                .ignore_then(none_of('"').repeated())
                .then_ignore(just('"'))
                .collect::<String>()
                .map(|s| Expr::Literal(CellValue::String(s)));
            
            // Cell references
            let cell_ref = CellAddress::parser()
                .map(Expr::Reference);
            
            // Functions
            let function = text::ident()
                .then(expr.clone()
                    .separated_by(just(','))
                    .allow_trailing()
                    .delimited_by(just('('), just(')')))
                .map(|(name, args)| Expr::FunctionCall { name, args });
            
            // Binary operators with precedence
            let atom = choice((
                number,
                string,
                function,
                cell_ref,
                expr.clone().delimited_by(just('('), just(')')),
            ));
            
            // Build expression parser with operator precedence
            let op = |c| just(c).padded();
            
            let factor = atom.clone()
                .then(op('^').then(atom).repeated())
                .foldl(|lhs, (op, rhs)| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Power,
                        left: Box::new(lhs),
                        right: Box::new(rhs),
                    }
                });
            
            let term = factor.clone()
                .then(choice((op('*'), op('/'))).then(factor).repeated())
                .foldl(|lhs, (op, rhs)| {
                    let operator = match op {
                        '*' => BinaryOperator::Multiply,
                        '/' => BinaryOperator::Divide,
                        _ => unreachable!(),
                    };
                    Expr::BinaryOp {
                        op: operator,
                        left: Box::new(lhs),
                        right: Box::new(rhs),
                    }
                });
            
            term.clone()
                .then(choice((op('+'), op('-'))).then(term).repeated())
                .foldl(|lhs, (op, rhs)| {
                    let operator = match op {
                        '+' => BinaryOperator::Add,
                        '-' => BinaryOperator::Subtract,
                        _ => unreachable!(),
                    };
                    Expr::BinaryOp {
                        op: operator,
                        left: Box::new(lhs),
                        right: Box::new(rhs),
                    }
                })
        })
    }
}
```

### 2.3 WASM Bindings for Parser

```rust
#[wasm_bindgen]
pub struct WasmFormulaParser;

#[wasm_bindgen]
impl WasmFormulaParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmFormulaParser
    }
    
    pub fn parse(&self, formula: &str) -> Result<JsValue, JsValue> {
        let formula = formula.trim_start_matches('=');
        let result = FormulaParser::parser().parse(formula);
        
        match result {
            Ok(ast) => serde_wasm_bindgen::to_value(&ast)
                .map_err(|e| JsValue::from_str(&e.to_string())),
            Err(errors) => {
                let error_msgs: Vec<String> = errors.iter()
                    .map(|e| format!("Parse error at position {}: expected {}", 
                        e.span().start, e.expected()))
                    .collect();
                Err(JsValue::from_str(&error_msgs.join(", ")))
            }
        }
    }
}
```

## Phase 3: Core Infrastructure with WASM (Week 3)

### 3.1 Cell Repository

```rust
// gridcore-core/src/repository/cell_repository.rs
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct CellRepository {
    cells: HashMap<String, Cell>,
}

#[wasm_bindgen]
impl CellRepository {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        CellRepository {
            cells: HashMap::new(),
        }
    }
    
    pub fn get(&self, address: &CellAddress) -> Option<Cell> {
        self.cells.get(&address.to_string()).cloned()
    }
    
    pub fn set(&mut self, address: &CellAddress, cell: Cell) {
        self.cells.insert(address.to_string(), cell);
    }
}
```

### 3.2 Dependency Graph with petgraph

```rust
// gridcore-core/src/dependency/graph.rs
use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::algo::toposort;

pub struct DependencyGraph {
    graph: DiGraph<CellAddress, ()>,
    node_map: HashMap<CellAddress, NodeIndex>,
}

impl DependencyGraph {
    pub fn add_dependency(&mut self, from: CellAddress, to: CellAddress) {
        let from_idx = self.get_or_create_node(from);
        let to_idx = self.get_or_create_node(to);
        self.graph.add_edge(from_idx, to_idx, ());
    }
    
    pub fn get_calculation_order(&self) -> Result<Vec<CellAddress>> {
        toposort(&self.graph, None)
            .map(|indices| {
                indices.into_iter()
                    .map(|idx| self.graph[idx].clone())
                    .collect()
            })
            .map_err(|_| SpreadsheetError::CircularDependency)
    }
}
```

## Phase 4: Formula Evaluator with AST Walking (Week 4)

### 4.1 Recursive Evaluator

```rust
// gridcore-core/src/formula/evaluator.rs
pub struct FormulaEvaluator<'a> {
    repository: &'a CellRepository,
}

impl<'a> FormulaEvaluator<'a> {
    pub fn evaluate(&self, ast: &Expr) -> Result<CellValue> {
        match ast {
            Expr::Literal(val) => Ok(val.clone()),
            
            Expr::Reference(addr) => {
                self.repository.get(addr)
                    .map(|cell| cell.computed_value)
                    .ok_or_else(|| SpreadsheetError::InvalidRef(addr.to_string()))
            }
            
            Expr::BinaryOp { op, left, right } => {
                let lhs = self.evaluate(left)?;
                let rhs = self.evaluate(right)?;
                self.apply_binary_op(*op, lhs, rhs)
            }
            
            Expr::FunctionCall { name, args } => {
                let evaluated_args: Result<Vec<_>> = args.iter()
                    .map(|arg| self.evaluate(arg))
                    .collect();
                self.apply_function(name, evaluated_args?)
            }
            
            _ => todo!()
        }
    }
    
    fn apply_binary_op(&self, op: BinaryOperator, lhs: CellValue, rhs: CellValue) -> Result<CellValue> {
        use BinaryOperator::*;
        use CellValue::*;
        
        match (op, lhs, rhs) {
            (Add, Number(a), Number(b)) => Ok(Number(a + b)),
            (Subtract, Number(a), Number(b)) => Ok(Number(a - b)),
            (Multiply, Number(a), Number(b)) => Ok(Number(a * b)),
            (Divide, Number(a), Number(b)) => {
                if b == 0.0 {
                    Err(SpreadsheetError::DivideByZero)
                } else {
                    Ok(Number(a / b))
                }
            }
            _ => Err(SpreadsheetError::ValueError)
        }
    }
}
```

## Phase 5: SpreadsheetFacade with Event Callbacks (Week 5)

### 5.1 Main Facade with JS Callbacks

```rust
#[wasm_bindgen]
pub struct SpreadsheetFacade {
    repository: Rc<RefCell<CellRepository>>,
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    parser: FormulaParser,
    #[wasm_bindgen(skip)]
    on_cell_update: Option<js_sys::Function>,
}

#[wasm_bindgen]
impl SpreadsheetFacade {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        SpreadsheetFacade {
            repository: Rc::new(RefCell::new(CellRepository::new())),
            dependency_graph: Rc::new(RefCell::new(DependencyGraph::new())),
            parser: FormulaParser,
            on_cell_update: None,
        }
    }
    
    #[wasm_bindgen(js_name = "onCellUpdate")]
    pub fn set_on_cell_update(&mut self, callback: js_sys::Function) {
        self.on_cell_update = Some(callback);
    }
    
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(&mut self, address: &CellAddress, value: JsValue) -> Result<JsValue, JsValue> {
        // Parse if formula, evaluate, update dependencies
        // Emit event via callback
        if let Some(ref callback) = self.on_cell_update {
            let event = object! {
                "type": "cell_updated",
                "address": address.to_string(),
                "value": value.clone()
            };
            callback.call1(&JsValue::NULL, &event)?;
        }
        Ok(JsValue::TRUE)
    }
}
```

## Phase 6: Structural Operations on AST (Week 6)

### 6.1 AST Transformer for Insert/Delete

```rust
// gridcore-core/src/formula/transformer.rs
pub struct FormulaTransformer;

impl FormulaTransformer {
    pub fn adjust_for_row_insert(&self, ast: Expr, inserted_row: u32) -> Expr {
        match ast {
            Expr::Reference(mut addr) => {
                if addr.row >= inserted_row {
                    addr.row += 1;
                }
                Expr::Reference(addr)
            }
            Expr::Range(mut range) => {
                if range.start.row >= inserted_row {
                    range.start.row += 1;
                }
                if range.end.row >= inserted_row {
                    range.end.row += 1;
                }
                Expr::Range(range)
            }
            Expr::BinaryOp { op, left, right } => {
                Expr::BinaryOp {
                    op,
                    left: Box::new(self.adjust_for_row_insert(*left, inserted_row)),
                    right: Box::new(self.adjust_for_row_insert(*right, inserted_row)),
                }
            }
            Expr::FunctionCall { name, args } => {
                Expr::FunctionCall {
                    name,
                    args: args.into_iter()
                        .map(|arg| self.adjust_for_row_insert(arg, inserted_row))
                        .collect(),
                }
            }
            other => other,
        }
    }
}
```

## Phase 7: Undo/Redo with Command Pattern (Week 7)

### 7.1 Command System

```rust
#[derive(Debug, Clone)]
pub enum Command {
    SetValues {
        previous: Vec<(CellAddress, CellValue)>,
        new: Vec<(CellAddress, CellValue)>,
    },
    InsertRow { index: u32 },
    DeleteRow { index: u32, cells: Vec<(CellAddress, Cell)> },
    InsertColumn { index: u32 },
    DeleteColumn { index: u32, cells: Vec<(CellAddress, Cell)> },
}

pub struct UndoRedoManager {
    undo_stack: Vec<Command>,
    redo_stack: Vec<Command>,
}

impl UndoRedoManager {
    pub fn execute(&mut self, command: Command) {
        self.undo_stack.push(command);
        self.redo_stack.clear(); // Clear redo on new action
    }
    
    pub fn undo(&mut self) -> Option<Command> {
        self.undo_stack.pop().map(|cmd| {
            let inverse = self.invert_command(cmd.clone());
            self.redo_stack.push(cmd);
            inverse
        })
    }
}
```

## TypeScript Integration Layer

```typescript
// packages/core/src/rust-adapter/index.ts
import init, { 
  SpreadsheetFacade as WasmFacade,
  CellAddress as WasmAddress,
  CellValue as WasmValue,
  WasmFormulaParser
} from '@gridcore/core-wasm';

export class SpreadsheetFacade {
  private wasmFacade?: WasmFacade;
  private parser?: WasmFormulaParser;
  
  async init() {
    await init();
    this.wasmFacade = new WasmFacade();
    this.parser = new WasmFormulaParser();
    
    // Set up event bridge
    this.wasmFacade.onCellUpdate((event: any) => {
      this.emit('cell:update', event);
    });
  }
  
  setCellValue(address: CellAddress, value: unknown): Result<Cell> {
    const wasmAddr = new WasmAddress(address.col, address.row);
    const result = this.wasmFacade!.setCellValue(wasmAddr, value);
    return this.convertResult(result);
  }
  
  parseFormula(formula: string): ParsedFormula {
    return this.parser!.parse(formula);
  }
}
```

## Build & Test Pipeline

### Workspace Configuration

```toml
# gridcore-rs/Cargo.toml
[workspace]
members = ["gridcore-core", "gridcore-wasm"]
resolver = "2"

[workspace.dependencies]
chumsky = { version = "0.10", default-features = false }
thiserror = "2.0"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
wasm-bindgen = "0.2"
petgraph = "0.8"
js-sys = "0.3"
web-sys = "0.3"
```

### Core Library Configuration

```toml
# gridcore-core/Cargo.toml
[package]
name = "gridcore-core"
version = "0.1.0"
edition = "2021"

[dependencies]
chumsky = { workspace = true }
thiserror = { workspace = true }
serde = { workspace = true }
petgraph = { workspace = true }

[features]
default = []
wasm = ["dep:wasm-bindgen", "dep:js-sys", "dep:web-sys"]

[dependencies.wasm-bindgen]
workspace = true
optional = true

[dependencies.js-sys]
workspace = true
optional = true

[dependencies.web-sys]
workspace = true
optional = true
```

### WASM Package Configuration

```toml
# gridcore-wasm/Cargo.toml
[package]
name = "gridcore-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
gridcore-core = { path = "../gridcore-core", features = ["wasm"] }
wasm-bindgen = { workspace = true }
serde-wasm-bindgen = { workspace = true }
js-sys = { workspace = true }
web-sys = { workspace = true }

[package.metadata.wasm-pack]
"wasm-opt" = ["-O4"]
```

### Build Scripts

```json
// gridcore-wasm/package.json
{
  "name": "@gridcore/core-wasm",
  "version": "0.1.0",
  "scripts": {
    "build": "wasm-pack build --target web --out-dir pkg",
    "build:node": "wasm-pack build --target nodejs --out-dir pkg-node",
    "test": "wasm-pack test --headless --firefox",
    "size": "wc -c pkg/*_bg.wasm"
  },
  "files": [
    "pkg"
  ],
  "main": "./pkg/gridcore_wasm.js",
  "types": "./pkg/gridcore_wasm.d.ts"
}
```

## Testing Strategy

### Rust Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cell_address_parsing() {
        let addr = CellAddress::from_str("A1").unwrap();
        assert_eq!(addr.col, 0);
        assert_eq!(addr.row, 0);
        
        let addr = CellAddress::from_str("AA10").unwrap();
        assert_eq!(addr.col, 26);
        assert_eq!(addr.row, 9);
    }
    
    #[test]
    fn test_formula_parsing() {
        let parser = FormulaParser::parser();
        let result = parser.parse("A1 + B2 * 2");
        assert!(result.is_ok());
    }
}
```

### WASM Integration Tests

```typescript
// packages/core/tests/wasm-integration.test.ts
import { beforeAll, describe, expect, test } from 'bun:test'
import init, { CellAddress, CellValue, WasmFormulaParser } from '@gridcore/core-wasm'

describe('WASM Integration', () => {
  beforeAll(async () => {
    await init()
  })
  
  test('CellAddress parsing', () => {
    const addr = CellAddress.fromString('A1')
    expect(addr.col).toBe(0)
    expect(addr.row).toBe(0)
    expect(addr.toString()).toBe('A1')
  })
  
  test('Formula parsing', () => {
    const parser = new WasmFormulaParser()
    const ast = parser.parse('A1 + B2 * 2')
    expect(ast).toBeDefined()
  })
})
```

## Performance Targets

- **Formula Evaluation**: 10-100x faster than TypeScript
- **Memory Usage**: 50% reduction for large spreadsheets
- **WASM Bundle Size**: < 500KB gzipped
- **Parsing Speed**: < 1ms for typical formulas
- **Recalculation**: < 100ms for 10k dependent cells

## Migration Checklist

### Phase 1 (Completed)

- [x] Set up Rust workspace
- [x] Implement SpreadsheetError with thiserror
- [x] Implement CellValue with WASM bindings
- [x] Implement CellAddress (simplified parser, chumsky pending)
- [x] Create initial TypeScript tests
- [x] Successfully compile to 76KB WASM bundle

### Phase 2 (Completed)

- [x] Define Formula AST
- [x] Implement chumsky parser (using Chumsky 0.10 with pratt parsing)
- [x] Create WASM parser bindings
- [x] Test formula parsing from TypeScript

### Phase 3

- [x] Implement CellRepository
- [x] Create DependencyGraph with petgraph
- [x] Add topological sort for calculation order

### Phase 4

- [x] Implement recursive AST evaluator
- [x] Add basic arithmetic operations
- [x] Add function support (SUM, AVERAGE, etc.)

### Phase 5 (Completed)

- [x] Create SpreadsheetFacade with event system
- [x] Add event callbacks to JS via WASM bindings
- [x] Implement batch operations with optimized recalculation
- [x] Create TypeScript adapter for seamless integration
- [x] Add comprehensive integration tests

### Phase 6

- [ ] AST transformer for structural operations
- [ ] Row/column insert/delete support
- [ ] Reference adjustment logic

### Phase 7

- [ ] Command pattern for undo/redo
- [ ] Undo/redo stack management
- [ ] Command inversion logic

## Key Advantages

1. **Continuous Validation**: Each component immediately testable through WASM
1. **AST-Based Operations**: All formula manipulation on AST ensures correctness
1. **Rich Error Handling**: Chumsky provides detailed parse errors with positions
1. **Type Safety**: Strong typing across Rust-JS boundary with serde
1. **Performance**: Chumsky generates efficient parsers, petgraph provides optimal algorithms
1. **Event-Driven**: JS callbacks enable reactive UI updates

This iterative approach ensures validation of each component before proceeding, significantly reducing integration risk.

