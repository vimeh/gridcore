# Visual Mode Testing Instructions

## To test visual mode selection rendering:

1. Open browser at http://localhost:8081/
2. Click on any cell to select it
3. Press 'v' to enter visual mode
4. Use hjkl or arrow keys to extend the selection
5. The selection should be visible as a semi-transparent blue overlay
6. Press Escape to exit visual mode

## Expected behavior:
- When entering visual mode with 'v', the current cell should be highlighted
- Moving with hjkl should extend the selection from the anchor point
- The selection should be rendered with a blue overlay (rgba(0, 120, 215, 0.2))
- Pressing Escape should clear the selection and return to navigation mode

## Visual indicators:
- Selected cells: semi-transparent blue fill
- Selection border: blue outline (rgba(0, 120, 215, 0.8))
- Active cell: thicker border (remains visible on top of selection)