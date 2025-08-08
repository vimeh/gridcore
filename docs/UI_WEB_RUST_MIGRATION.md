# UI-Web Rust WASM Migration Plan

## Overview
The ui-web package currently depends on TypeScript packages (@gridcore/core and @gridcore/ui-core) that have been removed. This document outlines the migration to use the Rust WASM implementations directly.

## Current State
- **Problem**: TypeScript core and controller packages have been removed
- **Goal**: Make ui-web work entirely with Rust WASM implementation
- **Approach**: Create adapter layer to bridge WASM to existing TypeScript interfaces

## Migration Phases

### Phase 1: Set up WASM Dependencies
1. **Add WASM packages to package.json**
   - Add gridcore-wasm (core functionality) from gridcore-rs/gridcore-wasm/pkg
   - Add gridcore-controller (controller functionality) from gridcore-rs/gridcore-controller/pkg
   - Update build scripts to ensure WASM files are properly bundled

2. **Create TypeScript type definitions**
   - Create types for all WASM exports that match the old TypeScript interfaces
   - Map Rust types to TypeScript interfaces for compatibility
   - Handle Result<T, E> pattern consistently

### Phase 2: Create Adapter Layer
Location: `packages/ui-web/src/wasm/`

1. **Core Domain Models Adapter** (`wasm/core.ts`)
   - Cell adapter wrapping WasmCell
   - CellAddress adapter wrapping WasmCellAddress
   - CellValue adapter wrapping WasmCellValue
   - Workbook adapter wrapping WasmWorkbook
   - Implement Result type pattern to match existing API
   - Handle memory management (free() calls) transparently

2. **Facade Adapter** (`wasm/facade.ts`)
   - Wrap WasmSpreadsheetFacade to match existing facade interface
   - Handle event callbacks and subscriptions
   - Manage batch operations
   - Provide getCellValue, setCellValue, deleteCell methods
   - Handle formula evaluation

3. **Controller Adapter** (`wasm/controller.ts`)
   - Wrap WasmSpreadsheetController
   - Map keyboard events (KeyboardEvent -> WASM format)
   - Map mouse events (MouseEvent -> WASM format)
   - Handle state management and subscriptions
   - Provide action dispatching

### Phase 3: Update Components

1. **Update imports across all files**
   ```typescript
   // Before
   import { Cell, CellAddress } from '@gridcore/core';
   
   // After
   import { Cell, CellAddress } from '../wasm/core';
   ```

2. **Fix component implementations**
   - **CanvasGrid**: Use WASM facade for cell operations
   - **KeyboardHandler**: Convert events to WASM format
   - **MouseHandler**: Convert events to WASM format
   - **FormulaBar**: Handle WASM cell values
   - **StatusBar**: Use WASM controller state
   - **TabBar**: Use WASM workbook for sheet management
   - **CellEditor**: Handle WASM cell editing
   - **Viewport**: Update for WASM viewport management

3. **Remove TypeScript-specific code**
   - Remove direct Workbook class usage
   - Remove direct Sheet class usage
   - Update tab management for WASM workbook API

### Phase 4: Handle WASM-specific Requirements

1. **Initialize WASM module**
   ```typescript
   // In main.ts
   import init from '../wasm/gridcore_wasm.js';
   await init();
   ```

2. **Memory management**
   - Ensure all WASM objects are properly freed
   - Add cleanup in component destructors
   - Use try-finally blocks for temporary objects
   - Consider WeakRef for long-lived objects

3. **Event handling**
   - Convert DOM KeyboardEvent to WASM format
   - Convert DOM MouseEvent to WASM format
   - Handle callbacks from WASM to TypeScript
   - Manage subscription lifecycle

### Phase 5: Testing & Validation

1. **Update unit tests**
   - Mock WASM modules in test setup
   - Update test utilities for WASM
   - Fix expectations for WASM behavior

2. **E2E testing**
   - Ensure all Playwright tests pass
   - Test vim mode functionality
   - Test formula evaluation
   - Test multi-sheet operations
   - Verify performance metrics

## Key Files to Modify

### New Files to Create
- `packages/ui-web/src/wasm/core.ts` - Core domain adapters
- `packages/ui-web/src/wasm/facade.ts` - Facade adapter
- `packages/ui-web/src/wasm/controller.ts` - Controller adapter
- `packages/ui-web/src/wasm/init.ts` - WASM initialization
- `packages/ui-web/src/wasm/types.ts` - TypeScript type definitions

### Files to Update
- `packages/ui-web/package.json` - Add WASM dependencies
- `packages/ui-web/src/main.ts` - Initialize WASM and update imports
- `packages/ui-web/src/components/*.ts` - Update all components
- `packages/ui-web/src/interaction/*.ts` - Update event handlers
- `packages/ui-web/src/rendering/*.ts` - Update renderers
- `packages/ui-web/src/state/*.ts` - Update state adapters
- `packages/ui-web/src/**/*.test.ts` - Update all tests

## Implementation Order

1. **Build WASM packages** (if not already built)
   ```bash
   cd gridcore-rs/gridcore-wasm && wasm-pack build --target web
   cd ../gridcore-controller && wasm-pack build --target web
   ```

2. **Create adapter layer** - Start with core types
3. **Update main.ts** - Add WASM initialization
4. **Fix imports** - Update all import statements
5. **Update components** - One by one, starting with CanvasGrid
6. **Fix tests** - Update mocks and expectations
7. **Run E2E tests** - Validate functionality

## Benefits

- **Performance**: Direct Rust implementation is faster
- **Consistency**: Single source of truth for business logic
- **Maintainability**: No dual TypeScript/Rust implementations
- **Future-proof**: All new features in Rust only

## Potential Challenges

1. **Memory Management**: Need to carefully manage WASM object lifecycle
2. **Async Initialization**: WASM requires async init
3. **Event Conversion**: DOM events to WASM format
4. **Type Compatibility**: Ensuring TypeScript types match WASM
5. **Testing**: Mocking WASM in unit tests

## Success Criteria

- [ ] All TypeScript compilation errors resolved
- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] No memory leaks
- [ ] Performance equal or better than TypeScript version
- [ ] All interactive features working (vim mode, formulas, etc.)