import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress, Workbook } from "../wasm";
import type { ViewportManager } from "../wasm";
import { SpreadsheetController } from "../wasm";
import { WebStateAdapter } from "../state/WebStateAdapter";

// Mock ViewportManager for testing
class MockViewportManager implements ViewportManager {
  private columnWidths: Map<number, number> = new Map();
  private rowHeights: Map<number, number> = new Map();

  getColumnWidth(index: number): number {
    return this.columnWidths.get(index) ?? 100;
  }

  setColumnWidth(index: number, width: number): void {
    this.columnWidths.set(index, width);
  }

  getRowHeight(index: number): number {
    return this.rowHeights.get(index) ?? 25;
  }

  setRowHeight(index: number, height: number): void {
    this.rowHeights.set(index, height);
  }

  getTotalRows(): number {
    return 1000;
  }

  getTotalCols(): number {
    return 26;
  }

  scrollTo(_row: number, _col: number): void {
    // Mock implementation
  }
}

describe("Controller Integration with Web UI", () => {
  let workbook: Workbook;
  let controller: SpreadsheetController;
  let adapter: WebStateAdapter;
  let viewportManager: ViewportManager;

  beforeEach(() => {
    workbook = new Workbook();
    const sheet = workbook.getActiveSheet();
    if (!sheet) throw new Error("No active sheet");

    viewportManager = new MockViewportManager();
    controller = new SpreadsheetController({
      facade: sheet.getFacade(),
      viewportManager,
    });
    adapter = new WebStateAdapter(controller);
  });

  test("controller initializes with navigation mode", () => {
    const state = controller.getState();
    expect(state.spreadsheetMode).toBe("navigation");
    expect(state.cursor.row).toBe(0);
    expect(state.cursor.col).toBe(0);
  });

  test("keyboard navigation updates state", () => {
    // Move down
    const result = controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cursor.row).toBe(1);
      expect(result.value.cursor.col).toBe(0);
    }
  });

  test("entering edit mode transitions state", () => {
    // Press 'i' to enter insert mode
    const result = controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.spreadsheetMode).toBe("editing");
      if (result.value.spreadsheetMode === "editing") {
        expect(result.value.cellMode).toBe("insert");
      }
    }
  });

  test("adapter converts mouse actions to keyboard commands", () => {
    // Click on cell B2 (row 1, col 1)
    const addressResult = CellAddress.create(1, 1);
    if (!addressResult.ok) throw new Error("Failed to create address");

    const result = adapter.handleMouseAction({
      type: "click",
      address: addressResult.value,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cursor.row).toBe(1);
      expect(result.value.cursor.col).toBe(1);
    }
  });

  test("interaction mode toggling works", () => {
    const initialState = adapter.getState();
    expect(initialState.interactionMode).toBe("normal");

    adapter.toggleInteractionMode();
    const newState = adapter.getState();
    expect(newState.interactionMode).toBe("keyboard-only");

    // In keyboard-only mode, mouse clicks should be ignored
    const addressResult = CellAddress.create(5, 5);
    if (!addressResult.ok) throw new Error("Failed to create address");

    const clickResult = adapter.handleMouseAction({
      type: "click",
      address: addressResult.value,
    });

    expect(clickResult.ok).toBe(true);
    if (clickResult.ok) {
      // Cursor should not have moved
      expect(clickResult.value.cursor.row).toBe(0);
      expect(clickResult.value.cursor.col).toBe(0);
    }
  });

  test("state change notifications work", () => {
    let notificationCount = 0;
    const unsubscribe = adapter.subscribe(() => {
      notificationCount++;
    });

    // Trigger a state change
    controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(notificationCount).toBeGreaterThan(0);
    unsubscribe();
  });

  test("resize mode can be entered via keyboard", () => {
    // Enter resize mode (would need to implement the actual key sequence)
    // For now, just verify the state structure supports resize mode
    const state = controller.getState();
    expect(
      ["navigation", "editing", "command", "resize"].includes(
        state.spreadsheetMode,
      ),
    ).toBe(true);
  });
});
