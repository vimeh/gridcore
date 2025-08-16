# Canvas Rendering Optimization Plan

## Problem Statement

Currently, every cell movement in the canvas (ui-web) triggers a complete canvas rerender. This impacts performance, especially with large grids or frequent navigation. The entire canvas is cleared and redrawn even when only the active cell cursor has moved.

## Current Behavior Analysis

### Rendering Triggers
The `render()` method in `CanvasGrid.ts` is called on:
- Active cell changes (line 150: `onActiveCellChange` callback)
- Mouse clicks (line 452: after `handleCellClick`)
- Cell editing commits/cancels (lines 487, 497)
- State changes from WebStateAdapter (line 427)
- Window resize events (line 434)
- Scroll events (line 447)
- Column/row resize operations (lines 131, 135)

### Current Render Process
1. **Clear entire canvas** - `CanvasRenderer.clear()` clears the full canvas
2. **Redraw all visible cells** - Loop through visible bounds, render each cell
3. **Redraw all grid lines** - Draw all horizontal and vertical lines
4. **Redraw selection/active cell** - Draw selection overlay and active cell border

### Performance Impact
- For a 20x20 visible grid, moving one cell redraws 400+ cells
- Each render involves multiple canvas operations per cell
- No caching or dirty region tracking
- Selection changes trigger full redraws

## Proposed Optimizations

### 1. Dirty Region Tracking

Create a `DirtyRegionManager` class to track which areas need redrawing:

```typescript
class DirtyRegionManager {
  private dirtyRegions: Set<string>;
  private dirtyBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
  
  markCellDirty(address: CellAddress): void;
  markRangeDirty(range: CellRange): void;
  isDirty(address: CellAddress): boolean;
  getDirtyBounds(): ViewportBounds;
  clear(): void;
}
```

**Benefits:**
- Only redraw cells that have actually changed
- Track previous/current active cell for minimal updates
- Batch multiple changes into a single dirty region

### 2. Layer-Based Rendering

Split the single canvas into multiple layers:

#### Grid Layer (Static)
- Grid lines
- Headers
- Rarely changes, can be cached

#### Cell Content Layer
- Cell values and formatting
- Updates on data changes only

#### Selection Overlay Layer
- Active cell border
- Selection highlights
- Visual mode indicators
- Most frequent updates

**Implementation:**
```typescript
class LayeredRenderer {
  private gridLayer: OffscreenCanvas;
  private cellLayer: OffscreenCanvas;
  private selectionLayer: OffscreenCanvas;
  
  renderGridLayer(): void;  // Only on resize/scroll
  renderCellLayer(dirtyRegions: DirtyRegion[]): void;  // Only dirty cells
  renderSelectionLayer(oldSelection: Selection, newSelection: Selection): void;  // Fast updates
  composite(): void;  // Combine layers to main canvas
}
```

### 3. Optimized Selection Rendering

Instead of full canvas redraws for cursor movement:

```typescript
class SelectionRenderer {
  private previousActiveCell: CellAddress | null;
  
  updateActiveCell(newCell: CellAddress): void {
    // Clear only the previous active cell border area
    if (this.previousActiveCell) {
      this.clearCellBorder(this.previousActiveCell);
    }
    
    // Draw only the new active cell border
    this.drawActiveCellBorder(newCell);
    
    this.previousActiveCell = newCell;
  }
}
```

### 4. Render Request Batching

Improve the existing `requestAnimationFrame` usage:

```typescript
class RenderScheduler {
  private pendingRenders: Map<RenderType, RenderRequest>;
  private frameScheduled: boolean = false;
  
  scheduleRender(type: RenderType, request: RenderRequest): void {
    this.pendingRenders.set(type, request);
    
    if (!this.frameScheduled) {
      this.frameScheduled = true;
      requestAnimationFrame(() => this.processPendingRenders());
    }
  }
  
  processPendingRenders(): void {
    // Process renders in priority order
    // Combine overlapping dirty regions
    // Execute minimal set of operations
  }
}
```

### 5. Incremental Rendering for Large Operations

For operations affecting many cells:

```typescript
class IncrementalRenderer {
  renderLargeUpdate(cells: CellAddress[], batchSize: number = 50): void {
    let index = 0;
    
    const renderBatch = () => {
      const batch = cells.slice(index, index + batchSize);
      this.renderCells(batch);
      index += batchSize;
      
      if (index < cells.length) {
        requestIdleCallback(renderBatch);
      }
    };
    
    renderBatch();
  }
}
```

## Implementation Plan

### Phase 1: Dirty Region Tracking (Highest Impact)
1. Implement `DirtyRegionManager` class
2. Modify `CanvasRenderer.renderGrid()` to accept dirty regions
3. Update event handlers to mark regions dirty instead of calling `render()`
4. Implement partial canvas clearing

### Phase 2: Optimized Selection Rendering
1. Create dedicated selection rendering path
2. Cache previous selection state
3. Implement differential selection updates
4. Add fast-path for cursor movement

### Phase 3: Layer-Based Architecture
1. Create `LayeredRenderer` class
2. Split rendering into layers
3. Implement layer caching
4. Add layer composition logic

### Phase 4: Advanced Optimizations
1. Implement render request batching
2. Add incremental rendering for large updates
3. Implement off-screen canvas for complex operations
4. Add performance monitoring and adaptive quality

## Expected Performance Improvements

- **Cursor movement**: 90% reduction in render time (only redraw 2 cells vs entire grid)
- **Typing in cells**: 80% reduction (only redraw active cell)
- **Selection changes**: 70% reduction (only redraw selection overlay)
- **Scrolling**: 40% reduction (with viewport caching)

## Testing Strategy

1. **Performance benchmarks**:
   - Measure render time for various operations
   - Compare before/after metrics
   - Test with different grid sizes

2. **Visual regression tests**:
   - Ensure rendering quality is maintained
   - Verify all UI elements render correctly
   - Test edge cases (partial cells, boundaries)

3. **Memory profiling**:
   - Monitor memory usage with layers
   - Check for memory leaks in caching
   - Verify garbage collection behavior

## Rollout Plan

1. **Feature flag implementation** - Allow toggling between old and new rendering
2. **Gradual rollout** - Start with dirty region tracking, measure impact
3. **Performance monitoring** - Track real-world performance metrics
4. **Iterative improvements** - Refine based on profiling data

## Success Metrics

- Rendering time for cell navigation < 5ms
- 60 FPS maintained during rapid navigation
- Memory overhead < 10MB for layer caching
- No visual artifacts or rendering glitches

## Related Improvements

- Consider virtual scrolling for very large grids
- Investigate WebGL rendering for massive datasets
- Add rendering performance overlay in debug mode
- Implement progressive rendering for initial load