# Phase 2: Controller/UI Logic Migration Plan

## Status: In Progress

Started: 2025-08-06

## Overview

Migration of `@gridcore/ui-core` TypeScript package to Rust, maintaining full API compatibility via WASM bindings.

## Phase 1 Status: ✅ COMPLETE

- 7,022 lines of Rust code implemented
- 66 passing tests
- Core components complete:
  - ✅ Cell types and addresses
  - ✅ Formula parser and evaluator
  - ✅ SpreadsheetFacade with events
  - ✅ Command pattern for undo/redo
  - ✅ Dependency graph
  - ✅ WASM bindings prepared
  - ✅ Repository pattern for cell storage

## Phase 2 Implementation Plan

### Week 1: Project Setup & State Machine (Days 1-7)

#### Day 1-2: Project Setup

- [x] Create `gridcore-rs/gridcore-controller` package
- [x] Configure Cargo.toml with dependencies
- [x] Set up module structure
- [ ] Configure WASM build pipeline

#### Day 3-7: State Machine Implementation

- [x] Port UIStateMachine from TypeScript
- [x] Implement SpreadsheetState enum
- [x] Create StateContext for shared state
- [x] Port state transitions
- [ ] Add state machine tests

**Files to create:**

- `src/state/machine.rs`
- `src/state/spreadsheet.rs`
- `src/state/context.rs`
- `src/state/transitions.rs`
- `src/state/tests.rs`

### Week 2: Controller Core (Days 8-14)

#### Day 8-10: SpreadsheetController

- [ ] Port main controller logic
- [ ] Implement ViewportManager trait
- [ ] Create event handling system

#### Day 11-14: Event System

- [ ] Define event types
- [ ] Implement event dispatcher
- [ ] Create keyboard/mouse event handlers
- [ ] Add controller tests

**Files to create:**

- `src/controller/spreadsheet.rs`
- `src/controller/events.rs`
- `src/controller/viewport.rs`
- `src/controller/tests.rs`

### Week 3: Vim Mode & Selection (Days 15-21)

#### Day 15-18: Vim Mode Implementation

- [ ] Port VimBehavior state machine
- [ ] Implement normal mode commands
- [ ] Implement visual mode selection
- [ ] Implement command mode
- [ ] Port CellVimBehavior

#### Day 19-21: Selection Management

- [ ] Port SelectionManager
- [ ] Implement ResizeBehavior
- [ ] Add selection tests

**Files to create:**

- `src/behaviors/vim/mod.rs`
- `src/behaviors/vim/normal.rs`
- `src/behaviors/vim/visual.rs`
- `src/behaviors/vim/command.rs`
- `src/behaviors/vim/cell_vim.rs`
- `src/managers/selection.rs`
- `src/behaviors/resize.rs`

### Week 4: WASM Integration & Testing (Days 22-28)

#### Day 22-24: WASM Bindings

- [ ] Create WASM exports
- [ ] Implement state machine bindings
- [ ] Create controller bindings
- [ ] Build event bridge to JavaScript

#### Day 25-28: Integration & Testing

- [ ] Port TypeScript tests to Rust
- [ ] Create integration tests
- [ ] Build WASM package
- [ ] Create TypeScript adapter
- [ ] Performance benchmarking

**Files to create:**

- `src/wasm/mod.rs`
- `src/wasm/state.rs`
- `src/wasm/controller.rs`
- `src/wasm/events.rs`
- `packages/ui-core/src/rust-adapter.ts`

## Success Metrics

- [ ] All 42 ui-core TypeScript files have Rust equivalents
- [ ] State machine transitions match exactly
- [ ] Vim mode commands work identically
- [ ] Event handling maintains 60fps performance
- [ ] Zero breaking changes in API
- [ ] All tests passing

## Technical Decisions

### Architecture

- Use trait-based design for extensibility
- Maintain exact API compatibility with TypeScript
- Use Rc/RefCell for shared state management
- Implement event system with callbacks

### Dependencies

- gridcore-core: Local dependency
- wasm-bindgen: WASM bindings
- js-sys/web-sys: JavaScript interop
- serde: Serialization

### Testing Strategy

- Unit tests for each module
- Integration tests with gridcore-core
- WASM tests using wasm-bindgen-test
- Performance benchmarks with criterion

## Risk Mitigation

1. **Parallel Development**: Keep TypeScript implementation running
1. **Feature Flags**: Use environment variables for gradual rollout
1. **Component Testing**: Test each component independently
1. **Test Coverage**: Maintain 100% test coverage for critical paths

## File Structure

```
gridcore-rs/
├── gridcore-controller/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── state/
│   │   │   ├── mod.rs
│   │   │   ├── machine.rs
│   │   │   ├── spreadsheet.rs
│   │   │   ├── context.rs
│   │   │   └── transitions.rs
│   │   ├── controller/
│   │   │   ├── mod.rs
│   │   │   ├── spreadsheet.rs
│   │   │   ├── events.rs
│   │   │   └── viewport.rs
│   │   ├── behaviors/
│   │   │   ├── mod.rs
│   │   │   ├── vim/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── normal.rs
│   │   │   │   ├── visual.rs
│   │   │   │   ├── command.rs
│   │   │   │   └── cell_vim.rs
│   │   │   └── resize.rs
│   │   ├── managers/
│   │   │   ├── mod.rs
│   │   │   └── selection.rs
│   │   └── wasm/
│   │       ├── mod.rs
│   │       ├── state.rs
│   │       ├── controller.rs
│   │       └── events.rs
│   └── tests/
│       └── integration_tests.rs
```

## Progress Tracking

### Current Status: Day 1

- Starting project setup
- Creating gridcore-controller package

### Daily Updates

- 2025-08-06: Created plan document, starting implementation

## Notes

- Prioritize exact behavior compatibility over optimization initially
- Focus on WASM API design for smooth TypeScript integration
- Consider using feature flags for experimental optimizations

