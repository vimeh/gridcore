import { describe, expect, test } from "bun:test";
import { CellAddress, CellRange } from "@gridcore/core";
import {
  createCommandState,
  createEditingState,
  createFillState,
  createNavigationState,
  createResizeState,
  createSpreadsheetVisualState,
  isCellVisualMode,
  isCommandMode,
  isEditingMode,
  isFillMode,
  isInsertMode,
  isNavigationMode,
  isResizeMode,
  isSpreadsheetVisualMode,
  isVisualMode,
  type Selection,
  type UIState,
} from "./UIState";

describe("UIState", () => {
  const defaultCursor = CellAddress.create(0, 0).value;
  const defaultViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };

  describe("state creation", () => {
    test("createNavigationState", () => {
      const state = createNavigationState(defaultCursor, defaultViewport);
      expect(state.spreadsheetMode).toBe("navigation");
      expect(state.cursor).toEqual(defaultCursor);
      expect(state.viewport).toEqual(defaultViewport);
    });

    test("createEditingState with defaults", () => {
      const state = createEditingState(defaultCursor, defaultViewport);
      expect(state.spreadsheetMode).toBe("editing");
      expect(state.cellMode).toBe("normal");
      expect(state.editingValue).toBe("");
      expect(state.cursorPosition).toBe(0);
    });

    test("createEditingState with custom values", () => {
      const state = createEditingState(
        defaultCursor,
        defaultViewport,
        "insert",
        "test content",
      );
      expect(state.cellMode).toBe("insert");
      expect(state.editingValue).toBe("test content");
      expect(state.cursorPosition).toBe(12); // Length of "test content"
    });

    test("createCommandState", () => {
      const state = createCommandState(defaultCursor, defaultViewport, "w");
      expect(state.spreadsheetMode).toBe("command");
      expect(state.commandValue).toBe("w");
    });

    test("createResizeState", () => {
      const state = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        5,
        100,
      );
      expect(state.spreadsheetMode).toBe("resize");
      expect(state.resizeTarget).toBe("column");
      expect(state.resizeIndex).toBe(5);
      expect(state.originalSize).toBe(100);
      expect(state.currentSize).toBe(100);
    });

    test("createSpreadsheetVisualState", () => {
      const anchor = CellAddress.create(1, 1).value;
      const selection: Selection = {
        type: { type: "column", columns: [1, 2] },
        anchor,
      };

      const state = createSpreadsheetVisualState(
        defaultCursor,
        defaultViewport,
        "column",
        anchor,
        selection,
      );

      expect(state.spreadsheetMode).toBe("visual");
      expect(state.visualMode).toBe("column");
      expect(state.anchor).toEqual(anchor);
      expect(state.selection).toEqual(selection);
      expect(state.cursor).toEqual(defaultCursor);
      expect(state.viewport).toEqual(defaultViewport);
    });
  });

  describe("type guards", () => {
    test("isNavigationMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const editState = createEditingState(defaultCursor, defaultViewport);

      expect(isNavigationMode(navState)).toBe(true);
      expect(isNavigationMode(editState)).toBe(false);
    });

    test("isEditingMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const editState = createEditingState(defaultCursor, defaultViewport);

      expect(isEditingMode(navState)).toBe(false);
      expect(isEditingMode(editState)).toBe(true);
    });

    test("isCommandMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const cmdState = createCommandState(defaultCursor, defaultViewport);

      expect(isCommandMode(navState)).toBe(false);
      expect(isCommandMode(cmdState)).toBe(true);
    });

    test("isResizeMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "row",
        0,
        50,
      );

      expect(isResizeMode(navState)).toBe(false);
      expect(isResizeMode(resizeState)).toBe(true);
    });

    test("isSpreadsheetVisualMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const editState = createEditingState(defaultCursor, defaultViewport);
      const anchor = CellAddress.create(1, 1).value;
      const selection: Selection = {
        type: { type: "row", rows: [0, 1] },
        anchor,
      };
      const visualState = createSpreadsheetVisualState(
        defaultCursor,
        defaultViewport,
        "row",
        anchor,
        selection,
      );

      expect(isSpreadsheetVisualMode(navState)).toBe(false);
      expect(isSpreadsheetVisualMode(editState)).toBe(false);
      expect(isSpreadsheetVisualMode(visualState)).toBe(true);
    });
  });

  describe("editing mode helpers", () => {
    test("isInsertMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const normalEditState = createEditingState(
        defaultCursor,
        defaultViewport,
        "normal",
      );
      const insertEditState = createEditingState(
        defaultCursor,
        defaultViewport,
        "insert",
      );

      expect(isInsertMode(navState)).toBe(false);
      expect(isInsertMode(normalEditState)).toBe(false);
      expect(isInsertMode(insertEditState)).toBe(true);
    });

    test("isCellVisualMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const normalEditState = createEditingState(
        defaultCursor,
        defaultViewport,
        "normal",
      );
      const visualEditState: UIState = {
        ...createEditingState(defaultCursor, defaultViewport, "visual"),
        visualType: "character",
        visualStart: 0,
      };

      expect(isCellVisualMode(navState)).toBe(false);
      expect(isCellVisualMode(normalEditState)).toBe(false);
      expect(isCellVisualMode(visualEditState)).toBe(true);
    });

    test("isVisualMode (legacy)", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport);
      const visualEditState: UIState = {
        ...createEditingState(defaultCursor, defaultViewport, "visual"),
        visualType: "character",
        visualStart: 0,
      };

      expect(isVisualMode(navState)).toBe(false);
      expect(isVisualMode(visualEditState)).toBe(true);
    });
  });

  describe("state properties", () => {
    test("all states have cursor and viewport", () => {
      const anchor = CellAddress.create(1, 1).value;
      const selection: Selection = {
        type: { type: "cell", address: defaultCursor },
      };

      const states: UIState[] = [
        createNavigationState(defaultCursor, defaultViewport),
        createEditingState(defaultCursor, defaultViewport),
        createCommandState(defaultCursor, defaultViewport),
        createResizeState(defaultCursor, defaultViewport, "column", 0, 100),
        createSpreadsheetVisualState(
          defaultCursor,
          defaultViewport,
          "char",
          anchor,
          selection,
        ),
      ];

      states.forEach((state) => {
        expect(state.cursor).toEqual(defaultCursor);
        expect(state.viewport).toEqual(defaultViewport);
      });
    });

    test("editing state with visual mode properties", () => {
      const state: UIState = {
        spreadsheetMode: "editing",
        cursor: defaultCursor,
        viewport: defaultViewport,
        cellMode: "visual",
        editingValue: "test",
        cursorPosition: 2,
        visualType: "character",
        visualStart: 0,
      };

      expect(isEditingMode(state)).toBe(true);
      expect(isVisualMode(state)).toBe(true);
      expect(state.visualType).toBe("character");
      expect(state.visualStart).toBe(0);
    });

    test("editing state with insert variant", () => {
      const state: UIState = {
        spreadsheetMode: "editing",
        cursor: defaultCursor,
        viewport: defaultViewport,
        cellMode: "insert",
        editingValue: "test",
        cursorPosition: 2,
        editVariant: "a",
      };

      expect(isInsertMode(state)).toBe(true);
      expect(state.editVariant).toBe("a");
    });

    test("spreadsheet visual state with different visual modes", () => {
      const anchor = CellAddress.create(1, 1).value;
      const cursor = CellAddress.create(2, 3).value;

      // Test column selection
      const columnSelection: Selection = {
        type: { type: "column", columns: [1, 2, 3] },
        anchor,
      };
      const columnState = createSpreadsheetVisualState(
        cursor,
        defaultViewport,
        "column",
        anchor,
        columnSelection,
      );

      expect(isSpreadsheetVisualMode(columnState)).toBe(true);
      expect(columnState.visualMode).toBe("column");
      expect(columnState.selection.type.type).toBe("column");
      expect(columnState.selection.type.columns).toEqual([1, 2, 3]);

      // Test row selection
      const rowSelection: Selection = {
        type: { type: "row", rows: [0, 1] },
        anchor,
      };
      const rowState = createSpreadsheetVisualState(
        cursor,
        defaultViewport,
        "row",
        anchor,
        rowSelection,
      );

      expect(rowState.visualMode).toBe("row");
      expect(rowState.selection.type.type).toBe("row");
      expect(rowState.selection.type.rows).toEqual([0, 1]);

      // Test range selection
      const rangeSelection: Selection = {
        type: {
          type: "range",
          start: anchor,
          end: cursor,
        },
        anchor,
      };
      const rangeState = createSpreadsheetVisualState(
        cursor,
        defaultViewport,
        "block",
        anchor,
        rangeSelection,
      );

      expect(rangeState.visualMode).toBe("block");
      expect(rangeState.selection.type.type).toBe("range");
      expect(rangeState.selection.type.start).toEqual(anchor);
      expect(rangeState.selection.type.end).toEqual(cursor);
    });

    test("navigation state with optional selection", () => {
      const selection: Selection = {
        type: { type: "cell", address: defaultCursor },
      };

      const stateWithSelection = createNavigationState(
        defaultCursor,
        defaultViewport,
        selection,
      );

      const stateWithoutSelection = createNavigationState(
        defaultCursor,
        defaultViewport,
      );

      expect(stateWithSelection.selection).toEqual(selection);
      expect(stateWithoutSelection.selection).toBeUndefined();
    });
  });
});
