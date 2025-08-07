/**
 * Integration tests for WASM controller
 * Tests the TypeScript adapter and WASM interop
 */

import { describe, test, expect, beforeAll } from "bun:test";

// Import the WASM module and initialization
import init, * as wasm from "../pkg/gridcore_controller";

describe("WASM Controller Integration", () => {
  beforeAll(async () => {
    // Initialize WASM asynchronously
    await init();
  });

  test("can create controller", () => {
    const controller = new wasm.WasmSpreadsheetController();
    expect(controller).toBeDefined();
    
    // Clean up
    controller.free();
  });

  test("can get initial state", () => {
    const controller = new wasm.WasmSpreadsheetController();
    const state = controller.getState();
    
    expect(state).toBeDefined();
    expect(state.type).toBe("Navigation");
    expect(state.cursor).toBeDefined();
    expect(state.cursor.col).toBe(0);
    expect(state.cursor.row).toBe(0);
    
    controller.free();
  });

  test("can handle keyboard events", () => {
    const controller = new wasm.WasmSpreadsheetController();
    
    // Create keyboard event for 'i' (enter insert mode)
    const event = wasm.WasmSpreadsheetController.createKeyboardEvent(
      "i", false, false, false, false
    );
    
    controller.handleKeyboardEvent(event);
    
    const state = controller.getState();
    expect(state.type).toBe("Editing");
    
    controller.free();
  });

  test("can handle mouse events", () => {
    const controller = new wasm.WasmSpreadsheetController();
    
    // Create mouse click event
    const event = wasm.WasmSpreadsheetController.createMouseEvent(
      100, 100, "left", "click"
    );
    
    controller.handleMouseEvent(event);
    
    // State should still be Navigation after a click
    const state = controller.getState();
    expect(state.type).toBe("Navigation");
    
    controller.free();
  });

  test("can transition between modes", () => {
    const controller = new wasm.WasmSpreadsheetController();
    
    // Start in Navigation
    let state = controller.getState();
    expect(state.type).toBe("Navigation");
    
    // Enter editing mode with 'i'
    const insertEvent = wasm.WasmSpreadsheetController.createKeyboardEvent(
      "i", false, false, false, false
    );
    controller.handleKeyboardEvent(insertEvent);
    
    state = controller.getState();
    expect(state.type).toBe("Editing");
    
    // Exit with Escape
    const escapeEvent = wasm.WasmSpreadsheetController.createKeyboardEvent(
      "Escape", false, false, false, false
    );
    controller.handleKeyboardEvent(escapeEvent);
    controller.handleKeyboardEvent(escapeEvent); // Need two escapes to exit fully
    
    state = controller.getState();
    expect(state.type).toBe("Navigation");
    
    controller.free();
  });

  test("can move cursor with vim keys", () => {
    const controller = new wasm.WasmSpreadsheetController();
    
    // Move down with 'j'
    const downEvent = wasm.WasmSpreadsheetController.createKeyboardEvent(
      "j", false, false, false, false
    );
    controller.handleKeyboardEvent(downEvent);
    
    let state = controller.getState();
    expect(state.cursor.row).toBe(1);
    expect(state.cursor.col).toBe(0);
    
    // Move right with 'l'
    const rightEvent = wasm.WasmSpreadsheetController.createKeyboardEvent(
      "l", false, false, false, false
    );
    controller.handleKeyboardEvent(rightEvent);
    
    state = controller.getState();
    expect(state.cursor.row).toBe(1);
    expect(state.cursor.col).toBe(1);
    
    controller.free();
  });

  test("UI State Machine works", () => {
    const stateMachine = new wasm.WasmUIStateMachine();
    
    const state = stateMachine.getState();
    expect(state).toBeDefined();
    expect(state.type).toBe("Navigation");
    
    // Test editing transition
    stateMachine.startEditing("Hello");
    const editState = stateMachine.getState();
    expect(editState.type).toBe("Editing");
    expect(editState.editing_value).toBe("Hello");
    
    stateMachine.free();
  });

  test("ActionBuilder creates actions", () => {
    const startEditAction = wasm.ActionBuilder.startEditing("test");
    expect(startEditAction).toBeDefined();
    expect(startEditAction.type).toBe("StartEditing");
    expect(startEditAction.initial_value).toBe("test");
    
    const commandAction = wasm.ActionBuilder.enterCommandMode();
    expect(commandAction).toBeDefined();
    expect(commandAction.type).toBe("EnterCommandMode");
    
    const escapeAction = wasm.ActionBuilder.escape();
    expect(escapeAction).toBeDefined();
    expect(escapeAction.type).toBe("Escape");
  });

  test("ViewportManager works", () => {
    const viewport = new wasm.WasmViewportManager(100, 50);
    
    expect(viewport.getTotalRows()).toBe(100);
    expect(viewport.getTotalCols()).toBe(50);
    
    // Test column width management
    viewport.setColumnWidth(0, 150);
    expect(viewport.getColumnWidth(0)).toBe(150);
    
    // Test row height management
    viewport.setRowHeight(0, 40);
    expect(viewport.getRowHeight(0)).toBe(40);
    
    // Test viewport to cell conversion
    const cell = viewport.viewportToCell(200, 50);
    expect(cell).toBeDefined();
    expect(cell.col).toBeGreaterThanOrEqual(0);
    expect(cell.row).toBeGreaterThanOrEqual(0);
    
    viewport.free();
  });

  test("can set and get cell values", () => {
    const controller = new wasm.WasmSpreadsheetController();
    
    // Set a cell value
    controller.setCellValue(0, 0, "Hello World");
    
    // Get the cell value
    const value = controller.getCellValue(0, 0);
    
    // The value might be wrapped in a cell object
    if (value && typeof value === "object") {
      expect(value.value || value.raw_value || value).toContain("Hello");
    } else {
      expect(value).toBe("Hello World");
    }
    
    controller.free();
  });
});

describe("WASM Types", () => {
  test("EventTypes constants are defined", () => {
    expect(wasm.EventTypes.CURSOR_MOVED()).toBe("CursorMoved");
    expect(wasm.EventTypes.MODE_CHANGED()).toBe("ModeChanged");
    expect(wasm.EventTypes.CELL_EDIT_STARTED()).toBe("CellEditStarted");
    expect(wasm.EventTypes.CELL_EDIT_COMPLETED()).toBe("CellEditCompleted");
  });

  test("MouseButtons constants are defined", () => {
    expect(wasm.MouseButtons.LEFT()).toBe("Left");
    expect(wasm.MouseButtons.RIGHT()).toBe("Right");
    expect(wasm.MouseButtons.MIDDLE()).toBe("Middle");
    expect(wasm.MouseButtons.NONE()).toBe("None");
  });

  test("MouseEventTypes constants are defined", () => {
    expect(wasm.MouseEventTypes.CLICK()).toBe("Click");
    expect(wasm.MouseEventTypes.DOUBLE_CLICK()).toBe("DoubleClick");
    expect(wasm.MouseEventTypes.DOWN()).toBe("Down");
    expect(wasm.MouseEventTypes.UP()).toBe("Up");
  });
});