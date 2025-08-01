# GridCore UI-Web Package

This package contains the web-based UI implementation for GridCore, providing a high-performance, canvas-based spreadsheet component.

## Core Concepts

The architecture of `ui-web` is designed for performance and extensibility, especially when dealing with large datasets. The key concepts are:

### 1. Canvas-Based Rendering

Instead of using traditional DOM elements (like `<table>`), the grid is rendered on an HTML5 `<canvas>`. This approach avoids the overhead of managing thousands of DOM nodes, allowing for smooth scrolling and interaction even with millions of cells.

### 2. Multi-Canvas Architecture

To optimize rendering performance, the grid is split into four separate canvas elements:

-   **Main Grid Canvas**: Renders only the grid cells and lines.
-   **Column Header Canvas**: Renders the column headers (A, B, C...).
-   **Row Header Canvas**: Renders the row headers (1, 2, 3...).
-   **Corner Canvas**: The small square at the top-left intersection of the headers.

This separation is crucial for performance. When the user scrolls, only the relevant canvases need to be repainted. For example, a vertical scroll only requires repainting the main grid and the row headers, while the column headers and corner remain static.

### 3. Viewport Optimization

The `Viewport` class acts as a virtual "camera" looking at the grid. It calculates which cells are currently visible within the scrollable area. The rendering engine uses this information to draw only the visible cells, rather than the entire grid. This is the primary mechanism that makes rendering large spreadsheets feasible.

## Component Breakdown

The `ui-web` package is composed of several key components, each with a distinct responsibility:

-   **`CanvasGrid.ts`**: The main component and orchestrator. It initializes all other components, sets up the DOM, and manages the main interaction loop.

-   **`Viewport.ts`**: Manages the state of the visible portion of the grid, including scroll position, dimensions, and calculating which rows and columns are in view.

-   **`CanvasRenderer.ts`**: Responsible for drawing the main grid cells, their content, and the grid lines onto the main canvas.

-   **`HeaderRenderer.ts`**: A dedicated renderer for the column, row, and corner header canvases. It handles drawing the header labels and borders.

-   **`SelectionManager.ts`**: Manages the state of cell selections, including the active cell and any selected ranges.

-   **`MouseHandler.ts` & `KeyboardHandler.ts`**: These components capture and interpret user input, translating mouse clicks, drags, and keyboard shortcuts into grid actions (e.g., selecting a cell, starting an edit).

-   **`CellEditor.ts`**: Provides a DOM-based input element that overlays the canvas to allow for in-place editing of a cell's content.

-   **`GridTheme.ts`**: A configuration object that defines the visual appearance of the grid, including colors, fonts, sizes, and padding. This allows for easy theming and customization.

## How It Works: The Rendering Loop

1.  **Initialization**: `CanvasGrid` creates the canvas elements and initializes all the components.
2.  **User Interaction**: An event (e.g., scroll, click, keypress) is captured by one of the handlers.
3.  **State Update**: The handler updates the state of the `Viewport` (e.g., scroll position) or `SelectionManager`.
4.  **Render Request**: A `render()` call is scheduled using `requestAnimationFrame`.
5.  **Drawing**:
    -   The `Viewport` calculates the visible cell bounds.
    -   `CanvasRenderer` and `HeaderRenderer` are invoked.
    -   They iterate through the visible cells and draw them onto their respective canvases.
    -   This ensures that work is only done for what is visible to the user, providing a smooth and responsive experience.
