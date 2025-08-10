# Phase 3.2: Introduce Domain Boundaries

## Current Architecture Analysis

### Current Module Structure
```
src/
├── domain/        # Core domain entities (Cell)
├── types/         # Value objects (CellAddress, CellValue, ErrorType)
├── repository/    # Data persistence layer
├── evaluator/     # Formula evaluation engine
├── formula/       # Formula parsing
├── dependency/    # Dependency graph management
├── references/    # Reference tracking
├── services/      # Service layer (new)
├── traits/        # Service interfaces
├── facade/        # High-level API
├── command/       # Command/Undo system
├── fill/          # Fill operations
└── workbook/      # Workbook management
```

### Identified Issues
1. **Circular Dependencies**: Services depend on facade types (BatchManager)
2. **Mixed Responsibilities**: Repository contains both data and business logic
3. **Unclear Boundaries**: No clear separation between domain, application, and infrastructure
4. **Direct Dependencies**: Components directly depend on concrete implementations

## Proposed Layered Architecture

### Layer 1: Domain Core (innermost)
**Purpose**: Pure business logic and entities
**Modules**: 
- `domain/` - Core entities (Cell, Formula)
- `types/` - Value objects (CellAddress, CellValue, ErrorType)

**Rules**:
- No dependencies on outer layers
- Only pure functions and data structures
- No I/O, no side effects

### Layer 2: Domain Services
**Purpose**: Business logic that spans multiple entities
**Modules**:
- `evaluator/` - Formula evaluation
- `dependency/` - Dependency graph
- `references/` - Reference tracking
- `formula/` - Formula parsing

**Rules**:
- Can depend on Domain Core
- No dependencies on Application or Infrastructure layers
- Define interfaces for external dependencies

### Layer 3: Application Services
**Purpose**: Use case orchestration and workflow
**Modules**:
- `services/` - Service implementations
- `traits/` - Service interfaces
- `command/` - Command pattern implementation
- `fill/` - Fill operations

**Rules**:
- Can depend on Domain Core and Domain Services
- Defines ports (interfaces) for infrastructure
- Orchestrates business workflows

### Layer 4: Infrastructure
**Purpose**: External interfaces and persistence
**Modules**:
- `repository/` - Data persistence
- `facade/` - Public API
- `workbook/` - File I/O and serialization

**Rules**:
- Can depend on all inner layers
- Implements ports defined by Application layer
- Handles all external I/O

## Implementation Steps

### Step 1: Define Layer Interfaces
1. Create `src/ports/` module for interface definitions
2. Define RepositoryPort trait for data access
3. Define EventPort trait for event handling
4. Move service traits to Application layer

### Step 2: Remove Circular Dependencies
1. Move BatchManager from facade to services
2. Remove facade dependencies from services
3. Create domain events instead of direct callbacks

### Step 3: Implement Dependency Inversion
1. Make repository implement RepositoryPort
2. Use dependency injection for all cross-layer dependencies
3. Remove direct imports between layers

### Step 4: Add Integration Tests
1. Test each layer in isolation
2. Test layer boundaries
3. Ensure no layer violations

## Success Criteria
- [ ] No circular dependencies
- [ ] Clear layer boundaries enforced by module structure
- [ ] All cross-layer communication through interfaces
- [ ] Each layer testable in isolation
- [ ] Dependency graph flows inward only

## File Structure After Refactoring
```
src/
├── core/              # Layer 1: Domain Core
│   ├── domain/
│   └── types/
├── domain_services/   # Layer 2: Domain Services  
│   ├── evaluator/
│   ├── dependency/
│   ├── references/
│   └── formula/
├── application/       # Layer 3: Application Services
│   ├── services/
│   ├── ports/        # Interface definitions
│   ├── command/
│   └── fill/
└── infrastructure/    # Layer 4: Infrastructure
    ├── repository/
    ├── facade/
    └── workbook/
```