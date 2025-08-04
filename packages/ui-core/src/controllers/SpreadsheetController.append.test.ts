import { beforeEach, describe, expect, test, vi } from "bun:test";
import type { SpreadsheetFacade } from "@gridcore/core";
import { CellAddress } from "@gridcore/core";
import type { ViewportManager } from "../controllers/SpreadsheetController";
import { SpreadsheetController } from "../controllers/SpreadsheetController";
import { createNavigationState } from "../state/UIState";
import { ok } from "../utils/Result";

describe("SpreadsheetController - Append Mode", () => {
  let controller: SpreadsheetController;
  let mockFacade: SpreadsheetFacade;
  let mockViewportManager: ViewportManager;
  let stateChangeEvents: Array<{ state: any; action: any }> = [];

  beforeEach(() => {
    stateChangeEvents = [];

    // Create mock facade
    mockFacade = {
      getCell: vi.fn((address: CellAddress) => {
        // Return "World" for cell B1 (row 0, col 1)
        if (address.row === 0 && address.col === 1) {
          return ok({ rawValue: "World", formattedValue: "World" });
        }
        return ok(null);
      }),
      setCell: vi.fn(() => ok(undefined)),
      setCellValue: vi.fn(() => ok(undefined)),
      getCellRange: vi.fn(() => ok([])),
      setCellRange: vi.fn(() => ok(undefined)),
      clearCells: vi.fn(() => ok(undefined)),
      getSheetDimensions: vi.fn(() => ok({ rows: 100, cols: 26 })),
    } as unknown as SpreadsheetFacade;

    // Create mock viewport manager
    mockViewportManager = {
      getColumnWidth: vi.fn(() => 100),
      setColumnWidth: vi.fn(),
      getRowHeight: vi.fn(() => 25),
      setRowHeight: vi.fn(),
      getTotalRows: () => 100,
      getTotalCols: () => 26,
      scrollTo: vi.fn(),
    };

    // Create controller with initial state at A1
    const cursor = CellAddress.create(0, 0).value!;
    const initialState = createNavigationState(cursor, {
      startRow: 0,
      startCol: 0,
      rows: 20,
      cols: 10,
    });

    controller = new SpreadsheetController({
      facade: mockFacade,
      viewportManager: mockViewportManager,
      initialState,
    });

    // Subscribe to state changes
    controller.subscribe((event) => {
      if (event.type === "stateChanged") {
        stateChangeEvents.push({ state: event.state, action: event.action });
      }
    });
  });

  test("should start editing with 'a' key in append mode", () => {
    // First move to B1 which has "World"
    const moveResult = controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    });
    expect(moveResult.ok).toBe(true);

    // Clear state change events from the move
    stateChangeEvents = [];

    // Press 'a' to enter append mode
    const result = controller.handleKeyPress("a", {
      key: "a",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    const state = result.value!;

    // Should be in editing mode
    expect(state.spreadsheetMode).toBe("editing");

    // Should be in insert cell mode
    if (state.spreadsheetMode === "editing") {
      expect(state.cellMode).toBe("insert");

      // Should have the current cell value
      expect(state.editingValue).toBe("World");

      // Cursor should be at the end for append mode
      expect(state.cursorPosition).toBe(5); // "World" has 5 characters

      // Should store the edit variant
      expect(state.editVariant).toBe("a");
    }

    // Verify state change events
    expect(stateChangeEvents.length).toBeGreaterThan(0);
    const lastEvent = stateChangeEvents[stateChangeEvents.length - 1];
    expect(lastEvent.state.spreadsheetMode).toBe("editing");
  });

  test("should start editing with 'i' key in insert mode", () => {
    // Move to B1
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    });

    // Press 'i' to enter insert mode
    const result = controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    const state = result.value!;

    expect(state.spreadsheetMode).toBe("editing");
    if (state.spreadsheetMode === "editing") {
      expect(state.cellMode).toBe("insert");
      expect(state.editingValue).toBe("World");
      expect(state.cursorPosition).toBe(0); // At beginning for insert mode
      expect(state.editVariant).toBe("i");
    }
  });

  test("should handle direct typing to start editing", () => {
    // Type a character directly
    const result = controller.handleKeyPress("H", {
      key: "H",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    const state = result.value!;

    expect(state.spreadsheetMode).toBe("editing");
    if (state.spreadsheetMode === "editing") {
      expect(state.cellMode).toBe("insert");
      // Direct typing replaces content
      expect(state.editingValue).toBe("H");
      expect(state.cursorPosition).toBe(1);
    }
  });

  test("should transition from insert to normal mode with Escape", () => {
    // Start editing
    controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    });

    // Press Escape
    const result = controller.handleKeyPress("Escape", {
      key: "Escape",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    const state = result.value!;

    // Should still be in editing mode but in normal cell mode
    expect(state.spreadsheetMode).toBe("editing");
    if (state.spreadsheetMode === "editing") {
      expect(state.cellMode).toBe("normal");
    }
  });

  test("should exit editing mode with double Escape", () => {
    // Start editing
    controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    });

    // First Escape - to normal mode
    controller.handleKeyPress("Escape", {
      key: "Escape",
      ctrl: false,
      shift: false,
      alt: false,
    });

    // Second Escape - exit editing
    const result = controller.handleKeyPress("Escape", {
      key: "Escape",
      ctrl: false,
      shift: false,
      alt: false,
    });

    expect(result.ok).toBe(true);
    const state = result.value!;

    // Should be back in navigation mode
    expect(state.spreadsheetMode).toBe("navigation");
  });
});
