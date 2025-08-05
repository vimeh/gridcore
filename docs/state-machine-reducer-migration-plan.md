# Complete Migration Plan: UIStateMachine to Reducer Pattern

## Architecture Overview
Transform the current string-based state machine into a pure functional reducer pattern with type-safe transitions, eliminating all backward compatibility requirements.

## Core Components

### 1. New State Store (replaces UIStateMachine)
```typescript
// UIStateStore.ts
export class UIStateStore {
  private state: UIState;
  private reducer: StateReducer;
  private listeners: Set<StateListener>;
  
  dispatch(action: Action): Result<UIState>
  getState(): Readonly<UIState>
  subscribe(listener: StateListener): () => void
}
```

### 2. Root Reducer Architecture
```typescript
// reducers/index.ts
export const rootReducer: StateReducer = (state, action) => {
  // Try mode-specific reducers first
  const newState = modeReducers[state.spreadsheetMode]?.(state, action);
  if (newState !== state) return newState;
  
  // Try universal actions
  return universalReducer(state, action);
};

// reducers/navigation.ts
export const navigationReducer: StateReducer = (state, action) => {
  if (!isNavigationMode(state)) return state;
  
  switch (action.type) {
    case 'START_EDITING':
      return createEditingState(state.cursor, state.viewport, ...);
    case 'ENTER_COMMAND_MODE':
      return createCommandState(state.cursor, state.viewport);
    default:
      return state;
  }
};
```

## Migration Steps

### Phase 1: Create New Reducer System
1. **Create reducer files:**
   - `reducers/index.ts` - Root reducer
   - `reducers/navigation.ts` - Navigation mode transitions
   - `reducers/editing.ts` - Editing mode (with nested cell modes)
   - `reducers/command.ts` - Command mode transitions
   - `reducers/visual.ts` - Visual mode transitions
   - `reducers/resize.ts` - Resize mode transitions
   - `reducers/structural.ts` - Insert/delete operations
   - `reducers/bulk.ts` - Bulk operations
   - `reducers/universal.ts` - Cross-mode actions (cursor, viewport, escape)

2. **Create UIStateStore class:**
   - Replace UIStateMachine class entirely
   - Use same public API (dispatch, getState, subscribe)
   - No transition map, just reducer composition

### Phase 2: Update SpreadsheetController
1. **Replace stateMachine with stateStore:**
   ```typescript
   // Before
   private stateMachine: UIStateMachine;
   this.stateMachine = new UIStateMachine(initialState);
   
   // After
   private stateStore: UIStateStore;
   this.stateStore = new UIStateStore(initialState);
   ```

2. **Update all transition calls:**
   ```typescript
   // Before
   this.stateMachine.transition({ type: "START_EDITING" });
   
   // After (same API, different implementation)
   this.stateStore.dispatch({ type: "START_EDITING" });
   ```

### Phase 3: Update Dependencies
1. **Update type exports in index.ts:**
   - Export UIStateStore instead of UIStateMachine
   - Keep Action types unchanged
   - Keep UIState types unchanged

2. **Update consumers:**
   - SpreadsheetController tests
   - StateVisualizer 
   - Documentation generation scripts

### Phase 4: Remove Old Code
1. Delete `UIStateMachine.ts`
2. Remove transition handler methods
3. Clean up unused imports

## Key Benefits of This Approach

1. **Pure Functions:** All reducers are pure, making testing trivial
2. **No String Keys:** Direct action type matching in switch statements
3. **Better Type Safety:** TypeScript can verify exhaustiveness
4. **Simpler Nested States:** Handle directly in editing reducer
5. **Easier Debugging:** Can log every action and state change
6. **Performance:** No string manipulation or map lookups

## Testing Strategy

1. **Unit test each reducer:**
   ```typescript
   test('navigationReducer handles START_EDITING', () => {
     const state = createNavigationState(cursor, viewport);
     const newState = navigationReducer(state, { type: 'START_EDITING' });
     expect(isEditingMode(newState)).toBe(true);
   });
   ```

2. **Integration test the root reducer:**
   - Test cross-mode transitions
   - Test invalid transitions return unchanged state
   - Test universal actions work in all modes

3. **E2E test through SpreadsheetController:**
   - Existing tests should pass unchanged
   - API remains the same

## Implementation Order

### Day 1: Core Infrastructure
- Create UIStateStore class
- Create root reducer and universal reducer
- Set up reducer composition pattern

### Day 2: Mode Reducers
- Implement navigation reducer
- Implement editing reducer (with nested modes)
- Implement command reducer
- Implement visual reducer

### Day 3: Specialized Reducers
- Implement resize reducer
- Implement structural operations reducer
- Implement bulk operations reducer

### Day 4: Integration
- Update SpreadsheetController
- Update all tests
- Remove old UIStateMachine

### Day 5: Cleanup
- Update documentation
- Update type exports
- Final testing and verification

## Breaking Changes (No Backward Compatibility)

1. **UIStateMachine class removed** - Replaced by UIStateStore
2. **transition() method renamed** - Now dispatch()
3. **No transition history** - Can be added to Store if needed
4. **No string-based transition keys** - Direct action matching

## File Structure After Migration
```
packages/ui-core/src/
├── state/
│   ├── UIState.ts (unchanged)
│   ├── UIStateStore.ts (new)
│   └── reducers/
│       ├── index.ts
│       ├── navigation.ts
│       ├── editing.ts
│       ├── command.ts
│       ├── visual.ts
│       ├── resize.ts
│       ├── structural.ts
│       ├── bulk.ts
│       └── universal.ts
```

## Detailed Reducer Implementations

### Navigation Reducer
```typescript
export const navigationReducer: StateReducer = (state, action) => {
  if (!isNavigationMode(state)) return state;
  
  switch (action.type) {
    case 'START_EDITING': {
      const cellMode: CellMode = action.editMode ? "insert" : "normal";
      const newState = createEditingState(state.cursor, state.viewport, cellMode);
      
      if (action.editMode && isEditingMode(newState)) {
        return {
          ...newState,
          editVariant: action.editMode,
          editingValue: action.initialValue ?? "",
          cursorPosition: action.cursorPosition ?? 0,
        };
      }
      return newState;
    }
    
    case 'ENTER_COMMAND_MODE':
      return createCommandState(state.cursor, state.viewport);
      
    case 'ENTER_SPREADSHEET_VISUAL_MODE':
      return createSpreadsheetVisualState(
        state.cursor,
        state.viewport,
        action.visualMode,
        state.cursor,
        action.selection
      );
      
    case 'ENTER_RESIZE_MODE':
      return createResizeState(
        state.cursor,
        state.viewport,
        action.target,
        action.index,
        action.size
      );
      
    default:
      return state;
  }
};
```

### Editing Reducer (with nested modes)
```typescript
export const editingReducer: StateReducer = (state, action) => {
  if (!isEditingMode(state)) return state;
  
  // Handle cell mode transitions first
  switch (state.cellMode) {
    case 'normal':
      return normalModeReducer(state, action);
    case 'insert':
      return insertModeReducer(state, action);
    case 'visual':
      return visualModeReducer(state, action);
  }
  
  // Handle actions that work in any cell mode
  switch (action.type) {
    case 'EXIT_TO_NAVIGATION':
      return createNavigationState(state.cursor, state.viewport);
      
    case 'UPDATE_EDITING_VALUE':
      return {
        ...state,
        editingValue: action.value,
        cursorPosition: action.cursorPosition,
      };
      
    default:
      return state;
  }
};

const normalModeReducer: StateReducer = (state, action) => {
  switch (action.type) {
    case 'ENTER_INSERT_MODE':
      return {
        ...state,
        cellMode: 'insert',
        editVariant: action.mode,
      };
      
    case 'ENTER_VISUAL_MODE':
      return {
        ...state,
        cellMode: 'visual',
        visualType: action.visualType,
        visualStart: action.anchor ?? state.cursorPosition,
      };
      
    default:
      return state;
  }
};
```

### Universal Reducer (handles ESCAPE, cursor updates, etc.)
```typescript
export const universalReducer: StateReducer = (state, action) => {
  switch (action.type) {
    case 'ESCAPE':
      return handleEscape(state);
      
    case 'UPDATE_CURSOR':
      return {
        ...state,
        cursor: action.cursor,
      };
      
    case 'UPDATE_VIEWPORT':
      return {
        ...state,
        viewport: action.viewport,
      };
      
    default:
      return state;
  }
};

const handleEscape = (state: UIState): UIState => {
  if (isEditingMode(state)) {
    if (state.cellMode === 'insert' || state.cellMode === 'visual') {
      // Exit to normal mode within editing
      return {
        ...state,
        cellMode: 'normal',
        visualType: undefined,
        visualStart: undefined,
        editVariant: undefined,
      };
    }
    // Exit editing mode entirely
    return createNavigationState(state.cursor, state.viewport);
  }
  
  if (isSpreadsheetVisualMode(state)) {
    return createNavigationState(state.cursor, state.viewport, state.selection);
  }
  
  if (isCommandMode(state) || isResizeMode(state)) {
    return createNavigationState(state.cursor, state.viewport);
  }
  
  // Already in navigation, nothing to do
  return state;
};
```

This migration completely replaces the state machine with a cleaner, more maintainable reducer pattern while keeping the external API similar enough that consumers only need minimal updates.