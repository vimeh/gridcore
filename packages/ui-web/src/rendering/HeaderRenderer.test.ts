import { describe, expect, test, beforeEach } from "bun:test";
import { HeaderRenderer } from "./HeaderRenderer";
import { Viewport } from "../components/Viewport";
import { defaultTheme } from "./GridTheme";
import { Window } from "happy-dom";

describe("HeaderRenderer Resize Handle Detection", () => {
  let headerRenderer: HeaderRenderer;
  let viewport: Viewport;
  let rowHeaderCanvas: HTMLCanvasElement;
  let colHeaderCanvas: HTMLCanvasElement;
  let cornerCanvas: HTMLCanvasElement;
  let window: Window;
  let document: any;
  
  beforeEach(() => {
    // Setup DOM environment
    window = new Window();
    document = window.document;
    (global as any).window = window;
    (global as any).document = document;
    global.devicePixelRatio = 1;
    
    // Create mock canvases
    rowHeaderCanvas = document.createElement("canvas");
    colHeaderCanvas = document.createElement("canvas");
    cornerCanvas = document.createElement("canvas");
    
    // Mock canvas contexts
    const mockContext = {
      scale: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillText: () => {},
      measureText: () => ({ width: 50 }),
    };
    
    rowHeaderCanvas.getContext = () => mockContext as any;
    colHeaderCanvas.getContext = () => mockContext as any;
    cornerCanvas.getContext = () => mockContext as any;
    
    // Set canvas dimensions
    rowHeaderCanvas.width = defaultTheme.rowHeaderWidth;
    rowHeaderCanvas.height = 500;
    colHeaderCanvas.width = 800;
    colHeaderCanvas.height = defaultTheme.columnHeaderHeight;
    cornerCanvas.width = defaultTheme.rowHeaderWidth;
    cornerCanvas.height = defaultTheme.columnHeaderHeight;
    
    // Mock getBoundingClientRect
    rowHeaderCanvas.getBoundingClientRect = () => ({
      width: defaultTheme.rowHeaderWidth,
      height: 500,
      top: 0,
      left: 0,
      right: defaultTheme.rowHeaderWidth,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    
    colHeaderCanvas.getBoundingClientRect = () => ({
      width: 800,
      height: defaultTheme.columnHeaderHeight,
      top: 0,
      left: 0,
      right: 800,
      bottom: defaultTheme.columnHeaderHeight,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    
    viewport = new Viewport(defaultTheme, 100, 26);
    headerRenderer = new HeaderRenderer(
      rowHeaderCanvas,
      colHeaderCanvas,
      cornerCanvas,
      defaultTheme,
      viewport
    );
  });

  test("getColumnAtPosition detects column correctly", () => {
    const result = headerRenderer.getColumnAtPosition(50, 0);
    expect(result).toBeDefined();
    expect(result?.col).toBe(0);
    expect(result?.isResizeHandle).toBe(false);
  });

  test("getColumnAtPosition detects resize handle at right edge", () => {
    // Default column width is 100, so right edge is around 96-100
    const result = headerRenderer.getColumnAtPosition(96, 0);
    expect(result).toBeDefined();
    expect(result?.col).toBe(0);
    expect(result?.isResizeHandle).toBe(true);
  });

  test("getColumnAtPosition returns null for out of bounds", () => {
    const result = headerRenderer.getColumnAtPosition(3000, 0);
    expect(result).toBeNull();
  });

  test("getColumnAtPosition works with custom column widths", () => {
    viewport.setColumnWidth(0, 150);
    
    // Middle of first column
    let result = headerRenderer.getColumnAtPosition(75, 0);
    expect(result?.col).toBe(0);
    expect(result?.isResizeHandle).toBe(false);
    
    // Near right edge of first column (should be resize handle)
    result = headerRenderer.getColumnAtPosition(146, 0);
    expect(result?.col).toBe(0);
    expect(result?.isResizeHandle).toBe(true);
    
    // Second column
    result = headerRenderer.getColumnAtPosition(200, 0);
    expect(result?.col).toBe(1);
    expect(result?.isResizeHandle).toBe(false);
  });

  test("getColumnAtPosition accounts for scroll offset", () => {
    // Scroll right by 50 pixels
    const scrollX = 50;
    
    // With scrollX=50:
    // Column 0: starts at -50, ends at 50 (visible from 0 to 50)
    // Column 1: starts at 50, ends at 150
    
    // Position 50 is at the right edge of column 0 (resize handle area)
    const result = headerRenderer.getColumnAtPosition(50, scrollX);
    expect(result?.col).toBe(0); // Still in column 0
    expect(result?.isResizeHandle).toBe(true); // At the edge, so it's a resize handle
    
    // Position 51 should be in column 1
    const result2 = headerRenderer.getColumnAtPosition(51, scrollX);
    expect(result2?.col).toBe(1);
    expect(result2?.isResizeHandle).toBe(false);
    
    // Position 0 with scroll 50 is in the middle of column 0
    const result3 = headerRenderer.getColumnAtPosition(0, scrollX);
    expect(result3?.col).toBe(0);
    expect(result3?.isResizeHandle).toBe(false);
  });

  test("getRowAtPosition detects row correctly", () => {
    const result = headerRenderer.getRowAtPosition(10, 0);
    expect(result).toBeDefined();
    expect(result?.row).toBe(0);
    expect(result?.isResizeHandle).toBe(false);
  });

  test("getRowAtPosition detects resize handle at bottom edge", () => {
    // Default row height is 24, so bottom edge is around 20-24
    const result = headerRenderer.getRowAtPosition(22, 0);
    expect(result).toBeDefined();
    expect(result?.row).toBe(0);
    expect(result?.isResizeHandle).toBe(true);
  });

  test("getRowAtPosition works with custom row heights", () => {
    viewport.setRowHeight(0, 40);
    
    // Middle of first row
    let result = headerRenderer.getRowAtPosition(20, 0);
    expect(result?.row).toBe(0);
    expect(result?.isResizeHandle).toBe(false);
    
    // Near bottom edge of first row (should be resize handle)
    result = headerRenderer.getRowAtPosition(38, 0);
    expect(result?.row).toBe(0);
    expect(result?.isResizeHandle).toBe(true);
    
    // Second row
    result = headerRenderer.getRowAtPosition(50, 0);
    expect(result?.row).toBe(1);
    expect(result?.isResizeHandle).toBe(false);
  });

  test("getRowAtPosition accounts for scroll offset", () => {
    // Scroll down by 24 pixels (one row)
    const scrollY = 24;
    
    // Position 10 with scroll 24 should be row 1
    const result = headerRenderer.getRowAtPosition(10, scrollY);
    expect(result?.row).toBe(1);
    expect(result?.isResizeHandle).toBe(false);
  });

  test("resize handle detection respects handle width", () => {
    // Test exact boundaries of resize handle area
    // Default column width is 100, handle width is 8
    // So resize handle should be from x=96 to x=104 (100 ± 4)
    
    let result = headerRenderer.getColumnAtPosition(95, 0);
    expect(result?.isResizeHandle).toBe(false);
    
    result = headerRenderer.getColumnAtPosition(96, 0);
    expect(result?.isResizeHandle).toBe(true);
    
    result = headerRenderer.getColumnAtPosition(100, 0);
    expect(result?.isResizeHandle).toBe(true);
    
    // Position 104 is actually in the next column (col 1) but may still be
    // considered part of col 0's resize handle
    result = headerRenderer.getColumnAtPosition(104, 0);
    expect(result?.col).toBe(1);
    
    // Well into the next column should not be a resize handle
    result = headerRenderer.getColumnAtPosition(110, 0);
    expect(result?.col).toBe(1);
    expect(result?.isResizeHandle).toBe(false);
  });
});