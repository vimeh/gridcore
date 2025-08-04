import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CellAddress, CellRange, cellAddressToString } from "@gridcore/core";
import type { Viewport } from "../components/Viewport";
import { defaultTheme } from "./GridTheme";
import { SelectionRenderer } from "./SelectionRenderer";

// Helper function to create CellAddress and convert to string for tests
function createCellAddressString(row: number, col: number): string {
  const result = CellAddress.create(row, col);
  if (!result.ok) throw new Error(`Failed to create CellAddress: ${result.error}`);
  return cellAddressToString(result.value);
}

// Helper function to create CellAddres for tests
function createCellAddress(row: number, col: number): CellAddress {
  const result = CellAddress.create(row, col);
  if (!result.ok) throw new Error(`Failed to create CellAddress: ${result.error}`);
  return result.value;
}

// Mock canvas context
function createMockContext() {
  const operations: string[] = [];

  return {
    operations,
    save: mock(() => operations.push("save")),
    restore: mock(() => operations.push("restore")),
    fillRect: mock((x: number, y: number, w: number, h: number) =>
      operations.push(`fillRect(${x},${y},${w},${h})`),
    ),
    strokeRect: mock((x: number, y: number, w: number, h: number) =>
      operations.push(`strokeRect(${x},${y},${w},${h})`),
    ),
    beginPath: mock(() => operations.push("beginPath")),
    moveTo: mock((x: number, y: number) =>
      operations.push(`moveTo(${x},${y})`),
    ),
    lineTo: mock((x: number, y: number) =>
      operations.push(`lineTo(${x},${y})`),
    ),
    stroke: mock(() => operations.push("stroke")),
    setLineDash: mock((segments: number[]) =>
      operations.push(`setLineDash([${segments.join(",")}])`)
    ),
    canvas: {
      width: 800,
      height: 600,
    },
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
  };
}

// Mock viewport
function createMockViewport() {
  return {
    getCellPosition: (address: CellAddress) => ({
      x: address.col * 100,
      y: address.row * 30,
      width: 100,
      height: 30,
    }),
  };
}

// Mock canvas element
function createMockCanvas(
  ctx: ReturnType<typeof createMockContext>,
): HTMLCanvasElement {
  return {
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

describe("SelectionRenderer", () => {
  let ctx: ReturnType<typeof createMockContext>;
  let viewport: ReturnType<typeof createMockViewport>;
  let canvas: HTMLCanvasElement;
  let renderer: SelectionRenderer;

  beforeEach(() => {
    ctx = createMockContext();
    viewport = createMockViewport();
    canvas = createMockCanvas(ctx);
    renderer = new SelectionRenderer(
      canvas,
      defaultTheme,
      viewport as unknown as Viewport,
    );
  });

  test("should not render anything when no cells are selected", () => {
    const selectedCells = new Set<string>();

    renderer.renderSelection(selectedCells, null, null);

    expect(ctx.operations.length).toBe(0);
  });

  test("should render cell highlights for selected cells", () => {
    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(1, 1),
    ]);

    renderer.renderSelection(selectedCells, null, null);

    expect(ctx.operations).toContain("save");
    expect(ctx.operations).toContain("fillRect(0,0,100,30)");
    expect(ctx.operations).toContain("fillRect(100,30,100,30)");
    expect(ctx.operations).toContain("restore");
    expect(ctx.fillStyle).toBe(defaultTheme.selectedCellBackgroundColor);
  });

  test("should render selection border for multiple cells", () => {
    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(0, 1),
      createCellAddressString(1, 0),
      createCellAddressString(1, 1),
    ]);

    renderer.renderSelection(selectedCells, null, null);

    // Should draw border around the selection
    expect(ctx.operations).toContain("strokeRect(0.5,0.5,199,59)");
  });

  test("should use selection range when provided", () => {
    const selectedCells = new Set<string>();
    const selectionRangeResult = CellRange.create(
      createCellAddress(1, 1),
      createCellAddress(3, 3),
    );
    if (!selectionRangeResult.ok) throw new Error(`Failed to create CellRange: ${selectionRangeResult.error}`);
    const selectionRange = selectionRangeResult.value;

    renderer.renderSelection(selectedCells, selectionRange, null);

    // Should draw border based on range
    expect(ctx.operations).toContain("strokeRect(100.5,30.5,299,89)");
  });

  test("should apply different styles for visual modes", () => {
    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(1, 1),
    ]);

    // Test line mode (dashed border)
    renderer.renderSelection(selectedCells, null, "line");
    expect(ctx.operations).toContain("setLineDash([5,3])");

    // Test block mode (thicker border)
    ctx.operations.length = 0;
    renderer.renderSelection(selectedCells, null, "block");
    expect(ctx.lineWidth).toBe(3);
    expect(ctx.operations).toContain("setLineDash([])");
  });

  test("should draw corner indicators for visual modes", () => {
    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(1, 1),
    ]);

    renderer.renderSelection(selectedCells, null, "character");

    // Check for corner indicator paths
    const beginPathCount = ctx.operations.filter(
      (op) => op === "beginPath",
    ).length;
    const strokeCount = ctx.operations.filter((op) => op === "stroke").length;

    // Should have 4 corners + initial path = 5 beginPath calls
    expect(beginPathCount).toBeGreaterThanOrEqual(4);
    expect(strokeCount).toBeGreaterThanOrEqual(4);
  });

  test("should handle empty selection gracefully", () => {
    const selectedCells = new Set<string>([]);

    expect(() => {
      renderer.renderSelection(selectedCells, null, null);
    }).not.toThrow();
  });

  test("should update theme", () => {
    const newTheme = {
      ...defaultTheme,
      selectionBorderColor: "#ff0000",
    };

    renderer.updateTheme(newTheme);

    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(1, 1),
    ]);

    renderer.renderSelection(selectedCells, null, null);

    expect(ctx.strokeStyle).toBe("#ff0000");
  });

  test("should skip rendering cells outside viewport", () => {
    const mockViewportWithBounds = {
      getCellPosition: (address: CellAddress) => {
        // Return null for cells outside viewport
        if (address.row > 10 || address.col > 10) {
          return null;
        }
        return {
          x: address.col * 100,
          y: address.row * 30,
          width: 100,
          height: 30,
        };
      },
    };

    const rendererWithBounds = new SelectionRenderer(
      canvas,
      defaultTheme,
      mockViewportWithBounds as unknown as Viewport,
    );

    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(100, 100), // Outside viewport
    ]);

    rendererWithBounds.renderSelection(selectedCells, null, null);

    // Should only render the visible cell
    expect(
      ctx.operations.filter((op) => op.startsWith("fillRect")).length,
    ).toBe(1);
  });

  test("should calculate correct bounds for non-contiguous selection", () => {
    const selectedCells = new Set([
      createCellAddressString(0, 0),
      createCellAddressString(5, 5),
      createCellAddressString(2, 3),
    ]);

    renderer.renderSelection(selectedCells, null, "block");

    // Should create bounds that encompass all cells (0,0) to (5,5)
    expect(ctx.operations).toContain("strokeRect(0.5,0.5,599,179)");
  });
});
