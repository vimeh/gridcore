# GridCore New Architecture

This directory contains the refactored GridCore architecture following Domain-Driven Design principles and SOLID patterns.

## Architecture Overview

The new architecture is organized into the following layers:

### Domain Layer (`/domain`)
Contains the core business logic and models:
- **Models**: Value objects like `CellAddress`, `CellRange`, `Cell`, `Formula`
- **Interfaces**: Repository and service contracts

### Infrastructure Layer (`/infrastructure`)
Contains concrete implementations:
- **Repositories**: `InMemoryCellRepository`, `InMemoryDependencyRepository`
- **Parsers**: `FormulaParser` for parsing formula expressions
- **Evaluators**: `FormulaEvaluator` for evaluating parsed formulas
- **Stores**: `EventStore` for event management

### Application Layer (`/application`)
Contains application services and coordination:
- **Services**: `FormulaService`, `CalculationService`
- **Facade**: `SpreadsheetFacade` - main entry point coordinating all services

### Adapters Layer (`/adapters`)
Contains adapters for external interfaces:
- `SpreadsheetEngineAdapter`: Provides backward compatibility with the old API

## Key Features

### 1. Type-Safe Error Handling
Uses `Result<T, E>` type for functional error handling instead of exceptions:
```typescript
const result = facade.setCellValue(address, "=A1+B1")
if (result.ok) {
  console.log("Cell updated:", result.value)
} else {
  console.log("Error:", result.error)
}
```

### 2. Event-Driven Architecture
All state changes emit typed events:
```typescript
eventStore.on("CellValueChanged", (event) => {
  console.log(`Cell ${event.address} changed from ${event.oldValue} to ${event.newValue}`)
})
```

### 3. Dependency Injection
All components use constructor injection for testability:
```typescript
const facade = new SpreadsheetFacade(
  cellRepository,
  dependencyRepository,
  calculationService,
  formulaService,
  eventStore
)
```

### 4. Immutable Value Objects
Domain models are immutable with factory methods:
```typescript
const address = CellAddress.create(0, 0) // Result<CellAddress>
const range = CellRange.create(address1, address2) // Result<CellRange>
```

### 5. Batch Operations
Support for efficient bulk updates:
```typescript
const batchId = facade.beginBatch()
facade.setCellValue(a1, 10)
facade.setCellValue(b1, 20)
facade.setCellValue(c1, "=A1+B1")
facade.commitBatch(batchId)
```

## Migration Guide

To migrate from the old `SpreadsheetEngine` to the new architecture:

### Option 1: Use the Compatibility Adapter
```typescript
import { SpreadsheetEngineAdapter } from "@gridcore/core/new-architecture"

// Drop-in replacement for SpreadsheetEngine
const engine = new SpreadsheetEngineAdapter(1000, 26)
engine.setCell({ row: 0, col: 0 }, 42)
```

### Option 2: Use the New API Directly
```typescript
import { 
  SpreadsheetFacade,
  InMemoryCellRepository,
  InMemoryDependencyRepository,
  CalculationService,
  FormulaService,
  FormulaParser,
  FormulaEvaluator,
  EventStore,
  CellAddress
} from "@gridcore/core/new-architecture"

// Set up infrastructure
const cellRepository = new InMemoryCellRepository()
const dependencyRepository = new InMemoryDependencyRepository()
const eventStore = new EventStore()
const parser = new FormulaParser()
const evaluator = new FormulaEvaluator()
const formulaService = new FormulaService(parser, evaluator)
const calculationService = new CalculationService(
  cellRepository,
  dependencyRepository,
  formulaService,
  eventStore
)

// Create facade
const facade = new SpreadsheetFacade(
  cellRepository,
  dependencyRepository,
  calculationService,
  formulaService,
  eventStore
)

// Use the facade
const address = CellAddress.create(0, 0).value
facade.setCellValue(address, 42)
```

## Testing

All components are fully unit tested. Run tests with:
```bash
bun test
```

## Future Enhancements

- [ ] Pivot table support
- [ ] Advanced state management
- [ ] Undo/redo functionality
- [ ] Cell formatting and styles
- [ ] Named ranges
- [ ] Data validation
- [ ] Conditional formatting