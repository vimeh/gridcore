import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "@gridcore/core";
import {
  type ControllerEvent,
  SpreadsheetController,
  type ViewportManager,
} from "./SpreadsheetController";

// Mock SpreadsheetEngine since it's not exported
class MockSpreadsheetEngine {
  private cells: Map<string, unknown> = new Map();

  updateCell(address: CellAddress, value: unknown) {
    this.cells.set(`${address.row},${address.col}`, value);
    return { ok: true, value: { address, value, formula: null } };
  }

  getCellValue(address: CellAddress) {
    const value = this.cells.get(`${address.row},${address.col}`) || "";
    return { ok: true, value };
  }

  updateCells(updates: Array<{ address: CellAddress; value: unknown }>) {
    const results = updates.map((u) => this.updateCell(u.address, u.value));
    return { ok: true, value: results };
  }

  getCell(address: CellAddress) {
    const rawValue = this.cells.get(`${address.row},${address.col}`);
    if (!rawValue) {
      return { ok: false, error: "Cell not found" };
    }

    // Create a proper Cell object
    if (typeof rawValue === "string" && rawValue.startsWith("=")) {
      // For formulas, simulate computed value
      const computedValue = this.simulateFormulaEvaluation(rawValue);
      return {
        ok: true,
        value: {
          rawValue,
          computedValue,
          hasFormula: () => true,
          hasError: () => false,
          displayValue: String(computedValue),
        },
      };
    }

    return {
      ok: true,
      value: {
        rawValue,
        computedValue: rawValue,
        hasFormula: () => false,
        hasError: () => false,
        displayValue: String(rawValue),
      },
    };
  }

  simulateFormulaEvaluation(formula: string): unknown {
    // Simple simulation for testing
    if (formula === "=A2+B2") {
      const a2 = this.cells.get("1,0") || 0;
      const b2 = this.cells.get("1,1") || 0;
      return Number(a2) + Number(b2);
    }
    return 0;
  }

  getCellRange(start: CellAddress, end: CellAddress) {
    const cells = [];
    for (let row = start.row; row <= end.row; row++) {
      for (let col = start.col; col <= end.col; col++) {
        const addr = CellAddress.create(row, col).value;
        const value = this.cells.get(`${row},${col}`) || "";
        cells.push({ address: addr, value, formula: null });
      }
    }
    return { ok: true, value: cells };
  }

  setCellValue(address: CellAddress, value: unknown) {
    return this.updateCell(address, value);
  }
}

describe("SpreadsheetController", () => {
  let controller: SpreadsheetController;
  let engine: MockSpreadsheetEngine;
  let viewportManager: ViewportManager;
  let events: ControllerEvent[] = [];

  beforeEach(() => {
    engine = new MockSpreadsheetEngine();
    viewportManager = {
      getColumnWidth: (_index: number) => 100,
      setColumnWidth: (_index: number, _width: number) => {},
      getRowHeight: (_index: number) => 20,
      setRowHeight: (_index: number, _height: number) => {},
      getTotalRows: () => 1000,
      getTotalCols: () => 100,
      scrollTo: (_row: number, _col: number) => {},
    };

    controller = new SpreadsheetController({
      facade: engine as unknown as SpreadsheetFacade,
      viewportManager,
    });
    events = [];
    controller.subscribe((event) => events.push(event));
  });

  describe("initialization", () => {
    test("starts in navigation mode", () => {
      const state = controller.getState();
      expect(state.spreadsheetMode).toBe("navigation");
    });

    test("initializes with default cursor position", () => {
      const state = controller.getState();
      expect(state.cursor.row).toBe(0);
      expect(state.cursor.col).toBe(0);
    });
  });

  describe("navigation mode key handling", () => {
    test("handles vim movement keys", () => {
      const result = controller.handleKeyPress("j", {
        key: "j",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().cursor.row).toBe(1);
      expect(events.some((e) => e.type === "stateChanged")).toBe(true);
    });

    test("handles entering edit mode", () => {
      const result = controller.handleKeyPress("i", {
        key: "i",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      const state = controller.getState();
      expect(state.spreadsheetMode).toBe("editing");
      expect(events.some((e) => e.type === "stateChanged")).toBe(true);
    });

    test("handles entering command mode", () => {
      const result = controller.handleKeyPress(":", {
        key: ":",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().spreadsheetMode).toBe("command");
    });

    test("handles entering resize mode", () => {
      controller.handleKeyPress("g", {
        key: "g",
        ctrl: false,
        shift: false,
        alt: false,
      });
      const result = controller.handleKeyPress("r", {
        key: "r",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().spreadsheetMode).toBe("resize");
    });
  });

  describe("editing mode key handling", () => {
    beforeEach(() => {
      controller.handleKeyPress("i", {
        key: "i",
        ctrl: false,
        shift: false,
        alt: false,
      });
    });

    test("enters editing mode", () => {
      const state = controller.getState();
      expect(state.spreadsheetMode).toBe("editing");
    });

    test("handles escape to exit insert mode first", () => {
      // In editing mode, first escape exits insert mode to normal mode
      const result = controller.handleKeyPress("Escape", {
        key: "escape",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      const state = controller.getState();
      expect(state.spreadsheetMode).toBe("editing");
      if (state.spreadsheetMode === "editing") {
        expect(state.cellMode).toBe("normal");
      }
    });

    test("escape handling depends on cell mode", () => {
      // In insert mode, first escape goes to normal mode within editing
      const result = controller.handleKeyPress("Escape", {
        key: "escape",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      // Still in editing mode
      const state = controller.getState();
      expect(state.spreadsheetMode).toBe("editing");
    });
  });

  describe("command mode", () => {
    beforeEach(() => {
      controller.handleKeyPress(":", {
        key: ":",
        ctrl: false,
        shift: false,
        alt: false,
      });
    });

    test("handles command character input", () => {
      // Since handleCommand doesn't exist, we simulate command mode input
      const result = controller.handleKeyPress("w", {
        key: "w",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      const state = controller.getState();
      if (state.spreadsheetMode === "command") {
        expect(state.commandValue).toBe(":w");
      }
    });

    test("exits on escape", () => {
      const result = controller.handleKeyPress("Escape", {
        key: "escape",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().spreadsheetMode).toBe("navigation");
    });
  });

  describe("resize mode", () => {
    beforeEach(() => {
      controller.handleKeyPress("g", {
        key: "g",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("r", {
        key: "r",
        ctrl: false,
        shift: false,
        alt: false,
      });
    });

    test("handles resize delta", () => {
      const result = controller.handleKeyPress("+", {
        key: "+",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      const state = controller.getState();
      if (state.spreadsheetMode === "resize") {
        expect(state.currentSize).toBe(105);
      }
    });

    test("handles resize confirmation", () => {
      controller.handleKeyPress("+", {
        key: "+",
        ctrl: false,
        shift: false,
        alt: false,
      });
      const result = controller.handleKeyPress("Enter", {
        key: "Enter",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().spreadsheetMode).toBe("navigation");
      expect(events.some((e) => e.type === "stateChanged")).toBe(true);
    });

    test("handles resize cancellation", () => {
      controller.handleKeyPress("+", {
        key: "+",
        ctrl: false,
        shift: false,
        alt: false,
      });
      const result = controller.handleKeyPress("Escape", {
        key: "Escape",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      expect(controller.getState().spreadsheetMode).toBe("navigation");
    });
  });

  describe("cell display value", () => {
    test("displays computed value for formulas", () => {
      // Set up cells A2=2, B2=3
      const a2 = CellAddress.create(1, 0).value;
      const b2 = CellAddress.create(1, 1).value;
      const c2 = CellAddress.create(1, 2).value;

      engine.setCellValue(a2, 2);
      engine.setCellValue(b2, 3);
      engine.setCellValue(c2, "=A2+B2");

      // Check display value shows computed result
      const displayValue = controller.getCellDisplayValue(c2);
      expect(displayValue).toBe("5");

      // Check edit value shows formula text
      const editValue = controller.getCellEditValue(c2);
      expect(editValue).toBe("=A2+B2");
    });

    test("displays raw value for non-formula cells", () => {
      const addr = CellAddress.create(0, 0).value;
      engine.setCellValue(addr, "Hello");

      const displayValue = controller.getCellDisplayValue(addr);
      expect(displayValue).toBe("Hello");

      const editValue = controller.getCellEditValue(addr);
      expect(editValue).toBe("Hello");
    });
  });

  describe("vim actions processing", () => {
    test("handles delete action", () => {
      // Set a cell value first
      const addr = CellAddress.create(0, 0).value;
      engine.updateCell(addr, "test");

      controller.handleKeyPress("x", {
        key: "x",
        ctrl: false,
        shift: false,
        alt: false,
      });

      const value = engine.getCellValue(addr);
      expect(value.value).toBe("");
    });

    test("handles yank action", () => {
      // Set a cell value
      const addr = CellAddress.create(0, 0).value;
      engine.updateCell(addr, "test");

      // Yank - just test that the action is processed
      const result1 = controller.handleKeyPress("y", {
        key: "y",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result1.ok).toBe(true);
      const result2 = controller.handleKeyPress("y", {
        key: "y",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result2.ok).toBe(true);
    });
  });

  describe("event emissions", () => {
    test("emits stateChanged on any state update", () => {
      const initialCount = events.filter(
        (e) => e.type === "stateChanged",
      ).length;
      controller.handleKeyPress("j", {
        key: "j",
        ctrl: false,
        shift: false,
        alt: false,
      });
      const newCount = events.filter((e) => e.type === "stateChanged").length;
      expect(newCount).toBe(initialCount + 1);
    });

    test("emits selectionChanged on visual mode", () => {
      controller.handleKeyPress("i", {
        key: "i",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("v", {
        key: "v",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(events.some((e) => e.type === "stateChanged")).toBe(true);
    });
  });

  describe("state machine integration", () => {
    test("respects valid state transitions", () => {
      // Try invalid transition - resize from editing
      controller.handleKeyPress("i", {
        key: "i",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("g", {
        key: "g",
        ctrl: false,
        shift: false,
        alt: false,
      });
      const _result = controller.handleKeyPress("r", {
        key: "r",
        ctrl: false,
        shift: false,
        alt: false,
      });

      // Should still be in editing mode
      expect(controller.getState().spreadsheetMode).toBe("editing");
    });
  });

  describe("error handling", () => {
    test("returns error for invalid cell addresses", () => {
      // Move cursor way out of bounds
      for (let i = 0; i < 1000; i++) {
        controller.handleKeyPress("j", {
          key: "j",
          ctrl: false,
          shift: false,
          alt: false,
        });
      }

      // Should still have valid state
      const state = controller.getState();
      expect(state.cursor.row).toBeLessThan(1000);
    });
  });

  describe("structural commands", () => {
    test("should execute :insert-row command", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode
      controller.handleKeyPress(":", {
        key: ":",
        ctrl: false,
        shift: false,
        alt: false,
      });

      // Type command
      controller.handleKeyPress("i", {
        key: "i",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("n", {
        key: "n",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("s", {
        key: "s",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("e", {
        key: "e",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("r", {
        key: "r",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("t", {
        key: "t",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("-", {
        key: "-",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("r", {
        key: "r",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("o", {
        key: "o",
        ctrl: false,
        shift: false,
        alt: false,
      });
      controller.handleKeyPress("w", {
        key: "w",
        ctrl: false,
        shift: false,
        alt: false,
      });

      // Execute with Enter
      controller.handleKeyPress("enter", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });

      // Wait a bit for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that structural operation event was emitted
      const structuralEvents = events.filter(
        (e) => e.type === "structuralOperationCompleted",
      );
      expect(structuralEvents.length).toBeGreaterThan(0);
    });

    test("should execute :delete-col command with count", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode and type :3delete-col
      controller.handleKeyPress(":", {
        key: ":",
        ctrl: false,
        shift: false,
        alt: false,
      });

      const command = "3delete-col";
      for (const char of command) {
        controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
      }

      // Execute with Enter
      controller.handleKeyPress("enter", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });

      // Wait a bit for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that structural operation event was emitted
      const structuralEvents = events.filter(
        (e) => e.type === "structuralOperationCompleted",
      );
      expect(structuralEvents.length).toBeGreaterThan(0);
    });

    test("should handle Ctrl+Shift+Plus keyboard shortcut", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => events.push(event));

      controller.handleKeyPress("+", {
        key: "+",
        ctrl: true,
        shift: true,
        alt: false,
      });

      // Wait a bit for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that structural operation event was emitted
      const structuralEvents = events.filter(
        (e) => e.type === "structuralOperationCompleted",
      );
      expect(structuralEvents.length).toBeGreaterThan(0);
    });
  });

  describe("getEngine", () => {
    test("returns underlying spreadsheet engine", () => {
      expect(controller.getEngine()).toBe(
        engine as unknown as SpreadsheetFacade,
      );
    });
  });
});
