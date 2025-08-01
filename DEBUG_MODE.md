# Debug Mode - Rendering Visualization

## Overview

The spreadsheet now includes a debug mode that provides real-time visualization of rendering performance and behavior. This is useful for:

- Understanding rendering performance
- Identifying rendering bottlenecks
- Visualizing which areas are being redrawn
- Monitoring frame rates and render times

## How to Use

1. Click the **Debug** checkbox next to the Import/Export buttons
2. The debug overlay will appear showing:
   - **FPS Counter**: Current frames per second
   - **Frame Time**: Time taken to render the last frame
   - **Cells Rendered**: Number of cells rendered in the current view
   - **Dirty Regions**: Number of areas marked for redraw
   - **Visual Indicators**: 
     - Blue dashed outline showing the visible viewport
     - Red semi-transparent overlays showing areas being redrawn
     - Grid pattern indicator in the top-right corner

## What the Visualizations Mean

### Blue Dashed Border
- Shows the current visible viewport bounds
- Updates as you scroll to show which cells are in view

### Red Overlays (Dirty Regions)
- Semi-transparent red rectangles show areas that were redrawn
- These fade out over 500ms to show recent rendering activity
- Helps identify unnecessary redraws or rendering hotspots

### Performance Metrics
- **FPS**: Should ideally stay at 60 FPS for smooth scrolling
- **Frame Time**: Lower is better (16.67ms = 60 FPS)
- **Cells Rendered**: Shows how many cells are currently visible
- **Dirty Regions**: Active regions being tracked for redraw

## Use Cases

### Performance Optimization
- Monitor FPS while scrolling to identify performance issues
- Check frame times when entering formulas or updating cells
- Verify that only necessary regions are being redrawn

### Debugging Rendering Issues
- Verify that cells are updating when formulas change
- Check that the viewport calculation is correct
- Ensure scrolling performance is smooth

### Development
- Useful when implementing new features that affect rendering
- Helps optimize render batching and dirty region tracking
- Validates that canvas updates are efficient

## Implementation Details

The debug mode is implemented using:
- `DebugRenderer` class that tracks performance metrics
- Integration with the main render loop to measure frame times
- Canvas overlay rendering for visual indicators
- Minimal performance impact when disabled

## Future Enhancements

Potential improvements to debug mode:
- Cell-level dirty tracking (show individual cell updates)
- Render call stack visualization
- Memory usage tracking
- Event timeline showing user interactions
- Export performance data for analysis