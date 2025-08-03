# GridCore Package Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan for the `@gridcore/core` package to address architectural issues, improve maintainability, and establish a solid foundation for future development. The refactoring will transform a monolithic, tightly-coupled architecture into a modular, extensible system following SOLID principles.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Refactoring Goals](#refactoring-goals)
3. [New Architecture Design](#new-architecture-design)
4. [Implementation Phases](#implementation-phases)
5. [Test Migration Strategy](#test-migration-strategy)
6. [API Migration Guide](#api-migration-guide)
7. [Success Metrics](#success-metrics)

## Current State Analysis

### Architectural Problems Identified

#### 1. God Class Anti-Pattern
**SpreadsheetEngine.ts** (578 lines, 31 methods) violates the Single Responsibility Principle by handling:
- Formula parsing and evaluation
- Event management and notifications
- Cell manipulation and state management
- Batch operations and recalculation ordering
- Pivot table lifecycle management
- Multiple serialization formats
- Circular dependency detection

#### 2. Tight Coupling
- Direct dependencies on concrete implementations (no interfaces)
- Circular dependencies: SpreadsheetEngine ↔ Grid ↔ PivotTable
- No dependency injection - all dependencies instantiated internally
- Shared state mutations without proper encapsulation

#### 3. Code Duplication
- Cell address parsing logic repeated in multiple classes
- Validation logic scattered across components
- Multiple serialization implementations for same data

#### 4. Type System Issues
- Primitive obsession (string-based cell keys)
- Confusing type organization (types.ts vs types/ directory)
- Missing domain value objects

#### 5. Testing Challenges
- Difficult to unit test due to tight coupling
- No ability to mock dependencies
- Integration tests required for simple functionality

### Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      SpreadsheetEngine                       │
│  (Formula, Events, Cells, Batch, Pivot, Serialization)      │
└─────────────────┬───────────────────┬───────────────────────┘
                  │                   │
        ┌─────────▼─────────┐ ┌──────▼──────┐
        │       Grid        │ │ Dependency  │
        │  (Cell Storage)   │ │   Graph     │
        └───────────────────┘ └─────────────┘
                  │
        ┌─────────▼─────────┐
        │   PivotTable      │
        └───────────────────┘
```

## Refactoring Goals

### Primary Goals

1. **Separation of Concerns**: Each class should have a single, well-defined responsibility
2. **Testability**: All components should be independently testable with mockable dependencies
3. **Extensibility**: New features should be addable without modifying existing code
4. **Type Safety**: Leverage TypeScript's type system with proper domain modeling
5. **Performance**: Maintain or improve current performance characteristics

### Tangible Success Metrics

- **Code Metrics**:
  - No class larger than 200 lines
  - No method larger than 30 lines
  - Cyclomatic complexity < 10 per method
  - Test coverage > 90%

- **Architecture Metrics**:
  - Zero circular dependencies
  - All public APIs have interfaces
  - 100% dependency injection for cross-module dependencies
  - Clear module boundaries with explicit exports

- **Developer Experience**:
  - New features implementable without core modifications
  - Unit tests runnable in < 1 second
  - Clear documentation for each module
  - Type-safe API with no `any` types

## New Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                  (SpreadsheetFacade)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                     Domain Services                         │
├─────────────┬───────────────┼───────────────┬─────────────┤
│   Formula   │    Event      │  Calculation  │   Pivot     │
│   Service   │   Service     │   Service     │  Service    │
└─────────────┴───────────────┴───────────────┴─────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    Domain Models                            │
├─────────────┬───────────────┼───────────────┬─────────────┤
│    Cell     │   Formula     │    Range      │   Sheet     │
│  ValueObject│  ValueObject  │  ValueObject  │   Entity    │
└─────────────┴───────────────┴───────────────┴─────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                  Infrastructure Layer                       │
├─────────────┬───────────────┼───────────────┬─────────────┤
│    Cell     │  Dependency   │    Event      │   State     │
│ Repository  │  Repository   │    Store      │ Serializer  │
└─────────────┴───────────────┴───────────────┴─────────────┘
```

### Module Structure

```
@gridcore/core/
├── application/
│   ├── SpreadsheetFacade.ts
│   └── interfaces/
│       └── ISpreadsheetEngine.ts
├── domain/
│   ├── models/
│   │   ├── Cell.ts
│   │   ├── CellAddress.ts
│   │   ├── CellRange.ts
│   │   ├── Formula.ts
│   │   └── Sheet.ts
│   ├── services/
│   │   ├── FormulaService.ts
│   │   ├── CalculationService.ts
│   │   ├── EventService.ts
│   │   └── PivotService.ts
│   └── interfaces/
│       ├── ICellRepository.ts
│       ├── IDependencyRepository.ts
│       └── IEventStore.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── InMemoryCellRepository.ts
│   │   └── InMemoryDependencyRepository.ts
│   ├── stores/
│   │   └── EventStore.ts
│   └── serializers/
│       ├── JsonSerializer.ts
│       └── StateSerializer.ts
├── shared/
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── cellAddressParser.ts
└── index.ts
```

### Key Design Patterns

#### 1. Repository Pattern
Abstracts data access from business logic:

```typescript
// domain/interfaces/ICellRepository.ts
export interface ICellRepository {
  get(address: CellAddress): Cell | undefined
  set(address: CellAddress, cell: Cell): void
  delete(address: CellAddress): void
  clear(): void
  getAllInRange(range: CellRange): Map<string, Cell>
}

// infrastructure/repositories/InMemoryCellRepository.ts
export class InMemoryCellRepository implements ICellRepository {
  private cells = new Map<string, Cell>()
  
  get(address: CellAddress): Cell | undefined {
    return this.cells.get(address.toString())
  }
  // ... implementation
}
```

#### 2. Value Objects
Immutable domain concepts with validation:

```typescript
// domain/models/CellAddress.ts
export class CellAddress {
  private constructor(
    public readonly row: number,
    public readonly col: number
  ) {}

  static create(row: number, col: number): Result<CellAddress> {
    if (row < 0 || col < 0) {
      return { ok: false, error: "Invalid cell address" }
    }
    return { ok: true, value: new CellAddress(row, col) }
  }

  toString(): string {
    return `${this.getColumnLabel()}${this.row + 1}`
  }

  equals(other: CellAddress): boolean {
    return this.row === other.row && this.col === other.col
  }

  private getColumnLabel(): string {
    // A-Z, AA-AZ, etc. conversion logic
  }
}
```

#### 3. Domain Services
Encapsulate business logic:

```typescript
// domain/services/FormulaService.ts
export class FormulaService {
  constructor(
    private parser: IFormulaParser,
    private evaluator: IFormulaEvaluator,
    private dependencyRepo: IDependencyRepository
  ) {}

  async evaluateFormula(
    formula: Formula,
    context: EvaluationContext
  ): Promise<Result<CellValue>> {
    const parseResult = await this.parser.parse(formula.expression)
    if (!parseResult.ok) return parseResult

    const dependencies = this.extractDependencies(parseResult.value)
    await this.dependencyRepo.updateDependencies(
      formula.address,
      dependencies
    )

    return this.evaluator.evaluate(parseResult.value, context)
  }
}
```

#### 4. Event-Driven Architecture
Decoupled event handling:

```typescript
// domain/services/EventService.ts
export interface IEventService {
  emit<T extends DomainEvent>(event: T): void
  on<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void
  off<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void
}

// Usage
eventService.on('CellValueChanged', async (event) => {
  await calculationService.recalculateDependents(event.address)
})
```

#### 5. Facade Pattern
Simplified API for external consumers:

```typescript
// application/SpreadsheetFacade.ts
export class SpreadsheetFacade implements ISpreadsheetEngine {
  constructor(
    private cellRepo: ICellRepository,
    private formulaService: FormulaService,
    private eventService: IEventService,
    private calculationService: CalculationService
  ) {}

  async setCell(
    address: CellAddress,
    value: unknown
  ): Promise<Result<void>> {
    const cell = Cell.create(value)
    if (!cell.ok) return cell

    this.cellRepo.set(address, cell.value)
    
    this.eventService.emit({
      type: 'CellValueChanged',
      address,
      oldValue: undefined,
      newValue: cell.value
    })

    if (cell.value.hasFormula()) {
      await this.formulaService.evaluateFormula(
        cell.value.formula!,
        this.createContext()
      )
    }

    return { ok: true, value: undefined }
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Establish core infrastructure and patterns

1. Create value objects:
   - [ ] CellAddress with validation and parsing
   - [ ] CellRange with iteration support
   - [ ] Formula with expression validation
   - [ ] Cell with immutability

2. Define core interfaces:
   - [ ] ICellRepository
   - [ ] IDependencyRepository
   - [ ] IEventService
   - [ ] IFormulaParser
   - [ ] IFormulaEvaluator

3. Implement basic repositories:
   - [ ] InMemoryCellRepository
   - [ ] InMemoryDependencyRepository

**Deliverable**: Core domain models and infrastructure interfaces

### Phase 2: Service Layer (Week 3-4)
**Goal**: Extract business logic into focused services

1. Extract formula handling:
   - [ ] FormulaService with parsing and evaluation
   - [ ] Separate built-in function registry
   - [ ] Context-based evaluation

2. Extract calculation logic:
   - [ ] CalculationService for dependency resolution
   - [ ] Topological sort implementation
   - [ ] Circular dependency detection

3. Implement event system:
   - [ ] EventService with type-safe events
   - [ ] Event handlers for cell changes
   - [ ] Batch event processing

**Deliverable**: Decoupled service layer with clear responsibilities

### Phase 3: Application Layer (Week 5)
**Goal**: Create unified facade and maintain API compatibility

1. Implement SpreadsheetFacade:
   - [ ] Coordinate services for operations
   - [ ] Transaction support for batch updates
   - [ ] Error handling and validation

2. Create compatibility adapter:
   - [ ] Map old API to new facade
   - [ ] Deprecation warnings
   - [ ] Migration helpers

**Deliverable**: New API with backward compatibility layer

### Phase 4: Advanced Features (Week 6)
**Goal**: Refactor complex features using new architecture

1. Refactor pivot tables:
   - [ ] Extract PivotService
   - [ ] Separate pivot configuration from execution
   - [ ] Event-driven pivot updates

2. Implement state management:
   - [ ] Serializer interfaces
   - [ ] Version migration support
   - [ ] Snapshot and restore functionality

**Deliverable**: Advanced features using new architecture

### Phase 5: Migration and Cleanup (Week 7-8)
**Goal**: Complete migration and remove legacy code

1. Update all dependent packages
2. Remove old implementations
3. Update documentation
4. Performance optimization

**Deliverable**: Fully migrated codebase

## Test Migration Strategy

### Testing Philosophy
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test service interactions
- **Contract Tests**: Ensure API compatibility
- **Performance Tests**: Verify no regression

### Example: Migrating SpreadsheetEngine Tests

#### Before (Tightly Coupled):
```typescript
describe("SpreadsheetEngine", () => {
  let engine: SpreadsheetEngine

  beforeEach(() => {
    engine = new SpreadsheetEngine(100, 26)
  })

  test("sets and gets cell values", () => {
    engine.setCell({ row: 0, col: 0 }, 42)
    const cell = engine.getCell({ row: 0, col: 0 })
    expect(cell?.rawValue).toBe(42)
  })
})
```

#### After (Mockable Dependencies):
```typescript
describe("SpreadsheetFacade", () => {
  let facade: SpreadsheetFacade
  let cellRepo: MockCellRepository
  let eventService: MockEventService

  beforeEach(() => {
    cellRepo = new MockCellRepository()
    eventService = new MockEventService()
    facade = new SpreadsheetFacade(
      cellRepo,
      new FormulaService(...),
      eventService,
      new CalculationService(...)
    )
  })

  test("sets cell value and emits event", async () => {
    const address = CellAddress.create(0, 0).value
    const result = await facade.setCell(address, 42)

    expect(result.ok).toBe(true)
    expect(cellRepo.get(address)?.value).toBe(42)
    expect(eventService.emittedEvents).toContainEqual({
      type: 'CellValueChanged',
      address,
      newValue: expect.objectContaining({ value: 42 })
    })
  })
})
```

### Test Organization
```
src/
├── domain/
│   ├── models/
│   │   ├── Cell.test.ts
│   │   ├── CellAddress.test.ts
│   │   └── Formula.test.ts
│   └── services/
│       ├── FormulaService.test.ts
│       └── CalculationService.test.ts
├── infrastructure/
│   └── repositories/
│       └── InMemoryCellRepository.test.ts
└── application/
    └── SpreadsheetFacade.test.ts
```

### Testing Utilities
```typescript
// test-utils/builders.ts
export class CellBuilder {
  private value: unknown = null
  private formula?: string

  withValue(value: unknown): this {
    this.value = value
    return this
  }

  withFormula(formula: string): this {
    this.formula = formula
    return this
  }

  build(): Cell {
    return Cell.create(this.value, this.formula).value
  }
}

// Usage in tests
const cell = new CellBuilder()
  .withValue(42)
  .withFormula("=A1+B1")
  .build()
```

## API Migration Guide

### For Package Consumers

#### Current API:
```typescript
import { SpreadsheetEngine } from '@gridcore/core'

const engine = new SpreadsheetEngine(100, 26)
engine.setCell({ row: 0, col: 0 }, "=SUM(A1:A10)")
const value = engine.getCell({ row: 0, col: 0 })?.computedValue
```

#### New API:
```typescript
import { createSpreadsheet } from '@gridcore/core'

const spreadsheet = createSpreadsheet({
  dimensions: { rows: 100, cols: 26 }
})

await spreadsheet.setCell("A1", "=SUM(A1:A10)")
const cell = await spreadsheet.getCell("A1")
const value = cell?.value
```

#### Migration Path:
```typescript
// Compatibility layer during migration
import { SpreadsheetEngine } from '@gridcore/core/legacy'
// or
import { SpreadsheetFacade as SpreadsheetEngine } from '@gridcore/core'
```

### Breaking Changes

1. **Async Operations**: Most operations are now async for better performance
2. **String Cell Addresses**: Can use "A1" notation or CellAddress objects
3. **Result Types**: Operations return Result<T> for better error handling
4. **Event System**: New event types and subscription model

### Migration Checklist

- [ ] Update imports to use new entry points
- [ ] Convert sync operations to async
- [ ] Handle Result types for error cases
- [ ] Update event listeners to new format
- [ ] Replace direct property access with methods
- [ ] Update tests to use new testing utilities

## Success Metrics

### Code Quality Metrics
- **Before**: 
  - Largest class: 578 lines (SpreadsheetEngine)
  - Cyclomatic complexity: up to 15
  - Test execution time: 2.5s
  - Type coverage: 75%

- **Target**:
  - Largest class: < 200 lines
  - Cyclomatic complexity: < 10
  - Test execution time: < 1s
  - Type coverage: 100%

### Architecture Metrics
- Zero circular dependencies (verified by dependency graph)
- 100% interface coverage for public APIs
- Clear module boundaries with no cross-layer imports
- All services independently testable

### Performance Targets
- Cell update: < 1ms (same as current)
- Formula evaluation: < 5ms for simple formulas
- Batch updates: O(n) where n is affected cells
- Memory usage: No more than 10% increase

### Developer Experience
- New feature implementation time: 50% reduction
- Bug fix time: 40% reduction
- Onboarding time for new developers: 30% reduction
- API documentation coverage: 100%

## Conclusion

This refactoring plan transforms the @gridcore/core package from a monolithic, tightly-coupled system into a modular, testable, and extensible architecture. By following SOLID principles and implementing clear architectural boundaries, we create a foundation that supports both current requirements and future growth.

The phased approach ensures continuous delivery of value while minimizing disruption to dependent packages. The comprehensive test migration strategy ensures quality throughout the refactoring process.

Success will be measured through concrete metrics in code quality, architecture cleanliness, performance, and developer experience. The new architecture will enable faster feature development, easier maintenance, and better overall system reliability.