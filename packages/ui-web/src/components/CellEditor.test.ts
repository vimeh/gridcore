import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CellAddress, Workbook } from "../wasm";
import type { ViewportManager } from "../wasm";
import { SpreadsheetController } from "../wasm";
import { Window } from "happy-dom";
import { CellEditor } from "./CellEditor";
import type { Viewport } from "./Viewport";

// Set up DOM environment
const happyWindow = new Window();

// Override globals without type conflicts
Object.assign(global, {
  window: happyWindow,
  document: happyWindow.document,
  KeyboardEvent: happyWindow.KeyboardEvent,
});

// Use the document from the global object
const document = happyWindow.document;

// Mock ViewportManager
class MockViewportManager implements ViewportManager {
  getColumnWidth(_index: number): number {
    return 100;
  }
  setColumnWidth(_index: number, _width: number): void {}
  getRowHeight(_index: number): number {
    return 25;
  }
  setRowHeight(_index: number, _height: number): void {}
  getTotalRows(): number {
    return 1000;
  }
  getTotalCols(): number {
    return 26;
  }
  scrollTo(_row: number, _col: number): void {}
  getViewport(): { startRow: number; endRow: number; startCol: number; endCol: number } {
    return { startRow: 0, endRow: 100, startCol: 0, endCol: 26 };
  }
  setViewport(_startRow: number, _endRow: number, _startCol: number, _endCol: number): void {}
  getScrollPosition(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }
  getCellAt(_x: number, _y: number): CellAddress | null {
    return null;
  }
}

// Mock Viewport
class MockViewport {
  getCellPosition(address: CellAddress) {
    return {
      x: address.col * 100,
      y: address.row * 25,
      width: 100,
      height: 25,
    };
  }
}

describe("CellEditor", () => {
  let cellEditor: CellEditor;
  let container: ReturnType<typeof document.createElement>;
  let workbook: Workbook;
  let controller: SpreadsheetController;
  let viewportManager: ViewportManager;
  let viewport: MockViewport;
  let committedValue: string | null;
  let cancelCalled: boolean;
  let _committedAddress: CellAddress | null;

  beforeEach(() => {
    // Reset test state
    committedValue = null;
    cancelCalled = false;
    _committedAddress = null;

    // Create container
    container = document.createElement("div");
    document.body.appendChild(container);

    // Create mocks
    workbook = new Workbook();
    const sheet = workbook.getActiveSheet();
    if (!sheet) throw new Error("No active sheet");

    viewportManager = new MockViewportManager();
    viewport = new MockViewport();

    controller = new SpreadsheetController({
      facade: sheet.getFacade(),
      viewportManager,
    });

    // Create CellEditor
    cellEditor = new CellEditor(
      container as unknown as HTMLElement,
      viewport as unknown as Viewport,
      {
        onCommit: (address: CellAddress, value: string) => {
          _committedAddress = address;
          committedValue = value;
        },
        onCancel: () => {
          cancelCalled = true;
        },
        controller,
      },
    );
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  test("double escape should save text in insert mode", () => {
    // Start editing in insert mode
    const addressResult = CellAddress.create(0, 0);
    if (!addressResult.ok) throw new Error("Failed to create address");

    // First enter edit mode by pressing 'i' in the controller
    controller.handleKeyPress("i");

    // Now start the cell editor
    cellEditor.startEditing(addressResult.value!, "");

    // Get the editor element
    const editorDiv = container.querySelector(
      ".cell-editor",
    ) as unknown as HTMLDivElement;
    expect(editorDiv).toBeDefined();

    // Type some text by simulating key presses
    const text = "Hello World";
    for (const char of text) {
      const keyEvent = new KeyboardEvent("keydown", {
        key: char,
        bubbles: true,
      });
      editorDiv.dispatchEvent(keyEvent);
      // Also update the content to simulate the browser's behavior
      editorDiv.textContent = editorDiv.textContent + char;
    }

    // Trigger input event to sync the content with the controller
    const inputEvent = new Event("input", { bubbles: true });
    editorDiv.dispatchEvent(inputEvent);

    // Simulate first escape key press
    const firstEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    });
    editorDiv.dispatchEvent(firstEscape);

    // Check that we're still editing but in normal mode
    expect(cellEditor.isCurrentlyEditing()).toBe(true);
    expect(committedValue).toBe(null);
    expect(cancelCalled).toBe(false);

    // Check controller state transitioned to normal mode
    const state1 = controller.getState();
    expect(state1.spreadsheetMode).toBe("editing");
    if (state1.spreadsheetMode === "editing") {
      expect(state1.cellMode).toBe("normal");
    }

    // Simulate second escape key press
    const secondEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    });
    editorDiv.dispatchEvent(secondEscape);

    // Check that editing stopped and value was saved
    expect(cellEditor.isCurrentlyEditing()).toBe(false);
    expect(committedValue).toBe("Hello World");
    expect(cancelCalled).toBe(false);
  });

  test("escape transitions from insert to normal mode", () => {
    // Start editing in insert mode
    const addressResult = CellAddress.create(0, 0);
    if (!addressResult.ok) throw new Error("Failed to create address");

    // Enter insert mode
    controller.handleKeyPress("i");

    cellEditor.startEditing(addressResult.value!, "");

    // Get initial controller state
    const initialState = controller.getState();
    expect(initialState.spreadsheetMode).toBe("editing");
    if (initialState.spreadsheetMode === "editing") {
      expect(initialState.cellMode).toBe("insert");
    }

    // Get the editor element
    const editorDiv = container.querySelector(
      ".cell-editor",
    ) as unknown as HTMLDivElement;

    // Simulate escape key press
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    });
    editorDiv.dispatchEvent(escapeEvent);

    // Check controller state transitioned to normal mode
    const newState = controller.getState();
    expect(newState.spreadsheetMode).toBe("editing");
    if (newState.spreadsheetMode === "editing") {
      expect(newState.cellMode).toBe("normal");
    }

    // Should still be editing
    expect(cellEditor.isCurrentlyEditing()).toBe(true);
  });
});
