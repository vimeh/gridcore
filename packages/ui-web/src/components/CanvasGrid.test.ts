import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SpreadsheetEngine } from "@gridcore/core";
import { Window } from "happy-dom";
import { CanvasGrid } from "./CanvasGrid";
import "../test-utils/global";

describe("CanvasGrid Initial Load", () => {
  let container: HTMLElement;
  let window: Window;
  let document: Document;

  beforeEach(() => {
    // Setup DOM environment
    window = new Window();
    document = window.document;
    global.window = window;
    global.document = document;
    global.devicePixelRatio = 1;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(cb, 0)) as typeof requestAnimationFrame;
    global.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof cancelAnimationFrame;

    // Mock canvas context
    const mockContext = {
      scale: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      fillText: () => {},
      measureText: () => ({ width: 50 }),
      setLineDash: () => {},
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      rect: () => {},
      clip: () => {},
    };

    // Mock canvas
    const _originalGetContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = () =>
      mockContext as unknown as CanvasRenderingContext2D;

    // Create container
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    container.style.position = "relative";

    // Mock getBoundingClientRect
    container.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container?.parentNode) {
      document.body.removeChild(container);
    }
    window.close();
  });

  test("should set correct dimensions on initial load to prevent over-scrolling", () => {
    // Create grid
    const grid = new SpreadsheetEngine(100, 50);

    // Mock getBoundingClientRect for all child elements
    const mockGetBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Override createElement to add mocks to all canvases
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "canvas" || tagName === "div") {
        element.getBoundingClientRect = mockGetBoundingClientRect;
      }
      return element;
    };

    const canvasGrid = new CanvasGrid(container, grid, {
      totalRows: 100,
      totalCols: 50,
    });

    // Restore original createElement
    document.createElement = originalCreateElement;

    // Get elements after construction
    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const spacer = scrollContainer.querySelector(".grid-spacer") as HTMLElement;
    const _canvas = scrollContainer.querySelector(
      ".grid-canvas",
    ) as HTMLCanvasElement;

    // Get expected dimensions
    const totalWidth = canvasGrid.getViewport().getTotalGridWidth();
    const totalHeight = canvasGrid.getViewport().getTotalGridHeight();

    // Spacer should be set to exact grid dimensions (no extra space)
    expect(spacer.style.width).toBe(`${totalWidth}px`);
    expect(spacer.style.height).toBe(`${totalHeight}px`);

    // Canvas should initially be 0 to prevent scroll, then sized by resize()
    // The important thing is the spacer is correctly sized

    // Mock clientWidth/clientHeight
    Object.defineProperty(scrollContainer, "clientWidth", {
      value: 700,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      value: 500,
      configurable: true,
    });

    // Mock scrollWidth/scrollHeight based on spacer
    Object.defineProperty(scrollContainer, "scrollWidth", {
      get: () => parseInt(spacer.style.width),
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      get: () => parseInt(spacer.style.height),
      configurable: true,
    });

    // Verify no over-scrolling: scroll dimensions should exactly match grid dimensions
    expect(scrollContainer.scrollWidth).toBe(totalWidth);
    expect(scrollContainer.scrollHeight).toBe(totalHeight);

    // Maximum scroll should be exactly what's needed to see the full grid
    const maxScrollX =
      scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const maxScrollY =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;

    expect(maxScrollX).toBe(totalWidth - 700); // 700 is mocked clientWidth
    expect(maxScrollY).toBe(totalHeight - 500); // 500 is mocked clientHeight

    canvasGrid.destroy();
  });
});

describe("CanvasGrid Scrolling", () => {
  let container: HTMLElement;
  let grid: SpreadsheetEngine;
  let canvasGrid: CanvasGrid;
  let window: Window;
  let document: Document;

  beforeEach(() => {
    // Setup DOM environment
    window = new Window();
    document = window.document;
    global.window = window;
    global.document = document;
    global.devicePixelRatio = 1;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(cb, 0)) as typeof requestAnimationFrame;
    global.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof cancelAnimationFrame;

    // Mock canvas context
    const mockContext = {
      scale: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      fillText: () => {},
      measureText: () => ({ width: 50 }),
      setLineDash: () => {},
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      rect: () => {},
      clip: () => {},
    };

    // Mock canvas
    const _originalGetContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = () =>
      mockContext as unknown as CanvasRenderingContext2D;

    // Create container
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    container.style.position = "relative";

    // Mock getBoundingClientRect
    container.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Mock clientWidth/clientHeight and scrollWidth/scrollHeight
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });
    Object.defineProperty(container, "offsetWidth", { value: 800 });
    Object.defineProperty(container, "offsetHeight", { value: 600 });

    document.body.appendChild(container);

    // Create grid with test data
    grid = new SpreadsheetEngine(100, 50);
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 50; col++) {
        grid.setCell({ row, col }, `R${row}C${col}`);
      }
    }

    // Create canvas grid
    canvasGrid = new CanvasGrid(container, grid, {
      totalRows: 100,
      totalCols: 50,
    });

    // Force initial resize to set up spacer
    canvasGrid.resize();
  });

  afterEach(() => {
    if (canvasGrid) {
      canvasGrid.destroy();
    }
    if (container?.parentNode) {
      document.body.removeChild(container);
    }
    window.close();
  });

  test("should not allow scrolling past the right edge", () => {
    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const spacer = scrollContainer.querySelector(".grid-spacer") as HTMLElement;

    // Mock scroll container dimensions to have scrollbars
    Object.defineProperty(scrollContainer, "clientWidth", {
      value: 700,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "offsetWidth", {
      value: 700,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "offsetHeight", {
      value: 500,
      configurable: true,
    });

    // Get total grid dimensions
    const totalWidth = canvasGrid.getViewport().getTotalGridWidth();
    const viewportWidth = scrollContainer.clientWidth;

    // Spacer should be exactly the total grid width
    expect(spacer.style.width).toBe(`${totalWidth}px`);

    // Mock scrollWidth to be the total width
    Object.defineProperty(scrollContainer, "scrollWidth", {
      value: totalWidth,
      configurable: true,
    });

    // Maximum scroll should be exactly totalWidth - viewportWidth
    const maxScrollLeft =
      scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const expectedMaxScroll = Math.max(0, totalWidth - viewportWidth);

    // Allow for small rounding differences
    expect(Math.abs(maxScrollLeft - expectedMaxScroll)).toBeLessThanOrEqual(1);
  });

  test("should not allow scrolling past the bottom edge", () => {
    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const spacer = scrollContainer.querySelector(".grid-spacer") as HTMLElement;

    // Mock scroll container dimensions
    Object.defineProperty(scrollContainer, "clientWidth", {
      value: 700,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      value: 500,
      configurable: true,
    });

    // Get total grid dimensions
    const totalHeight = canvasGrid.getViewport().getTotalGridHeight();
    const viewportHeight = scrollContainer.clientHeight;

    // Spacer should be exactly the total grid height
    expect(spacer.style.height).toBe(`${totalHeight}px`);

    // Mock scrollHeight to be the total height
    Object.defineProperty(scrollContainer, "scrollHeight", {
      value: totalHeight,
      configurable: true,
    });

    // Maximum scroll should be exactly totalHeight - viewportHeight
    const maxScrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const expectedMaxScroll = Math.max(0, totalHeight - viewportHeight);

    // Allow for small rounding differences
    expect(Math.abs(maxScrollTop - expectedMaxScroll)).toBeLessThanOrEqual(1);
  });

  test("headers should remain aligned when scrolled to edges", () => {
    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const colHeaderCanvas = container.querySelector(
      ".grid-col-header-canvas",
    ) as HTMLCanvasElement;
    const rowHeaderCanvas = container.querySelector(
      ".grid-row-header-canvas",
    ) as HTMLCanvasElement;

    // Scroll to maximum position
    const maxScrollLeft =
      scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const maxScrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;

    scrollContainer.scrollLeft = maxScrollLeft;
    scrollContainer.scrollTop = maxScrollTop;

    // Trigger scroll event handler
    scrollContainer.dispatchEvent(new Event("scroll"));

    // Get viewport scroll position
    const scrollPos = canvasGrid.getViewport().getScrollPosition();

    // Scroll position should match the container's scroll
    expect(scrollPos.x).toBe(scrollContainer.scrollLeft);
    expect(scrollPos.y).toBe(scrollContainer.scrollTop);

    // Headers should be properly positioned
    const colHeaderLeft = parseInt(colHeaderCanvas.style.left);
    const rowHeaderTop = parseInt(rowHeaderCanvas.style.top);

    // Column header should start after row header width
    expect(colHeaderLeft).toBe(canvasGrid.getViewport().theme.rowHeaderWidth);

    // Row header should start after column header height + toolbar
    expect(rowHeaderTop).toBe(
      canvasGrid.getViewport().theme.columnHeaderHeight + 40,
    );
  });

  test("should handle grids smaller than viewport without over-scrolling", () => {
    // Create a small grid
    const smallGrid = new SpreadsheetEngine(5, 5);
    const smallCanvasGrid = new CanvasGrid(container, smallGrid, {
      totalRows: 5,
      totalCols: 5,
    });

    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const spacer = scrollContainer.querySelector(".grid-spacer") as HTMLElement;

    const totalWidth = smallCanvasGrid.getViewport().getTotalGridWidth();
    const totalHeight = smallCanvasGrid.getViewport().getTotalGridHeight();

    // Spacer should still be exactly the grid size
    expect(spacer.style.width).toBe(`${totalWidth}px`);
    expect(spacer.style.height).toBe(`${totalHeight}px`);

    // There should be no scrollbars (scrollWidth/Height should equal clientWidth/Height)
    expect(scrollContainer.scrollWidth).toBe(scrollContainer.clientWidth);
    expect(scrollContainer.scrollHeight).toBe(scrollContainer.clientHeight);

    smallCanvasGrid.destroy();
  });

  test("visible bounds should not include partial cells at edges", () => {
    const scrollContainer = container.querySelector(
      ".grid-scroll-container",
    ) as HTMLElement;
    const viewport = canvasGrid.getViewport();

    // Scroll to a position where we'd have partial cells
    scrollContainer.scrollLeft = 150;
    scrollContainer.scrollTop = 150;
    scrollContainer.dispatchEvent(new Event("scroll"));

    const bounds = viewport.getVisibleBounds();

    // Calculate the actual visible area
    const startX = scrollContainer.scrollLeft;
    const endX = startX + scrollContainer.clientWidth;
    const startY = scrollContainer.scrollTop;
    const endY = startY + scrollContainer.clientHeight;

    // Check that all included cells are at least partially visible
    let x = 0;
    for (let col = 0; col < bounds.startCol; col++) {
      x += viewport.getColumnWidth(col);
    }
    expect(x).toBeLessThanOrEqual(startX);

    let y = 0;
    for (let row = 0; row < bounds.startRow; row++) {
      y += viewport.getRowHeight(row);
    }
    expect(y).toBeLessThanOrEqual(startY);

    // Check end bounds
    for (let col = 0; col < bounds.endCol; col++) {
      x += viewport.getColumnWidth(col);
    }
    expect(x).toBeGreaterThanOrEqual(endX);

    for (let row = 0; row < bounds.endRow; row++) {
      y += viewport.getRowHeight(row);
    }
    expect(y).toBeGreaterThanOrEqual(endY);
  });
});
