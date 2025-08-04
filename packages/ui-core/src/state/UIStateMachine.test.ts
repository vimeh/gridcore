import { beforeEach, describe, expect, test } from "bun:test";
import {
  isCommandMode,
  isEditingMode,
  isNavigationMode,
  isResizeMode,
} from "./UIState";
import { UIStateMachine } from "./UIStateMachine";

describe("UIStateMachine", () => {
  let stateMachine: UIStateMachine;

  beforeEach(() => {
    stateMachine = new UIStateMachine();
  });

  describe("initial state", () => {
    test("should start in navigation mode", () => {
      const state = stateMachine.getState();
      expect(isNavigationMode(state)).toBe(true);
      expect(state.spreadsheetMode).toBe("navigation");
    });

    test("should have default cursor position", () => {
      const state = stateMachine.getState();
      expect(state.cursor.row).toBe(0);
      expect(state.cursor.col).toBe(0);
    });
  });

  describe("navigation to editing transitions", () => {
    test("should transition to editing mode with START_EDITING", () => {
      const result = stateMachine.transition({ type: "START_EDITING" });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();
      expect(isEditingMode(state)).toBe(true);
      expect(state.spreadsheetMode).toBe("editing");

      if (isEditingMode(state)) {
        expect(state.cellMode).toBe("normal");
        expect(state.editingValue).toBe("");
        expect(state.cursorPosition).toBe(0);
      }
    });

    test("should transition to editing mode with insert variant", () => {
      const result = stateMachine.transition({
        type: "START_EDITING",
        editMode: "i",
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isEditingMode(state)) {
        expect(state.cellMode).toBe("insert");
        expect(state.editVariant).toBe("i");
      }
    });

    test("should fail to start editing from non-navigation mode", () => {
      stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      const result = stateMachine.transition({ type: "START_EDITING" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });
  });

  describe("editing mode transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
    });

    test("should transition between normal and insert modes", () => {
      const result = stateMachine.transition({
        type: "ENTER_INSERT_MODE",
        mode: "i",
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isEditingMode(state)) {
        expect(state.cellMode).toBe("insert");
        expect(state.editVariant).toBe("i");
      }

      const exitResult = stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      expect(exitResult.ok).toBe(true);

      const exitState = stateMachine.getState();
      if (isEditingMode(exitState)) {
        expect(exitState.cellMode).toBe("normal");
        expect(exitState.editVariant).toBeUndefined();
      }
    });

    test("should transition between normal and visual modes", () => {
      const result = stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "character",
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isEditingMode(state)) {
        expect(state.cellMode).toBe("visual");
        expect(state.visualType).toBe("character");
      }

      const exitResult = stateMachine.transition({ type: "EXIT_VISUAL_MODE" });
      expect(exitResult.ok).toBe(true);

      const exitState = stateMachine.getState();
      if (isEditingMode(exitState)) {
        expect(exitState.cellMode).toBe("normal");
        expect(exitState.visualType).toBeUndefined();
      }
    });

    test("should exit to navigation mode", () => {
      const result = stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });

    test("should update editing value", () => {
      const result = stateMachine.transition({
        type: "UPDATE_EDITING_VALUE",
        value: "hello",
        cursorPosition: 5,
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isEditingMode(state)) {
        expect(state.editingValue).toBe("hello");
        expect(state.cursorPosition).toBe(5);
      }
    });
  });

  describe("command mode transitions", () => {
    test("should enter command mode from navigation", () => {
      const result = stateMachine.transition({ type: "ENTER_COMMAND_MODE" });

      expect(result.ok).toBe(true);
      expect(isCommandMode(stateMachine.getState())).toBe(true);
    });

    test("should update command value", () => {
      stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      const result = stateMachine.transition({
        type: "UPDATE_COMMAND_VALUE",
        value: ":w",
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isCommandMode(state)) {
        expect(state.commandValue).toBe(":w");
      }
    });

    test("should exit command mode", () => {
      stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      const result = stateMachine.transition({ type: "EXIT_COMMAND_MODE" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });
  });

  describe("resize mode transitions", () => {
    test("should enter resize mode with column target", () => {
      const result = stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: "column",
        index: 2,
        size: 100,
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isResizeMode(state)) {
        expect(state.resizeTarget).toBe("column");
        expect(state.resizeIndex).toBe(2);
        expect(state.originalSize).toBe(100);
        expect(state.currentSize).toBe(100);
      }
    });

    test("should update resize size", () => {
      stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: "row",
        index: 0,
        size: 25,
      });

      const result = stateMachine.transition({
        type: "UPDATE_RESIZE_SIZE",
        size: 30,
      });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isResizeMode(state)) {
        expect(state.currentSize).toBe(30);
        expect(state.originalSize).toBe(25); // Original unchanged
      }
    });

    test("should exit resize mode", () => {
      stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: "column",
        index: 0,
        size: 100,
      });

      const result = stateMachine.transition({ type: "EXIT_RESIZE_MODE" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });
  });

  describe("universal actions", () => {
    test("should update cursor in any state", () => {
      const newCursor = { row: 5, col: 10 };
      const result = stateMachine.transition({
        type: "UPDATE_CURSOR",
        cursor: newCursor,
      });

      expect(result.ok).toBe(true);
      expect(stateMachine.getState().cursor).toEqual(newCursor);
    });

    test("should update viewport in any state", () => {
      const newViewport = { startRow: 10, startCol: 5, rows: 20, cols: 15 };
      const result = stateMachine.transition({
        type: "UPDATE_VIEWPORT",
        viewport: newViewport,
      });

      expect(result.ok).toBe(true);
      expect(stateMachine.getState().viewport).toEqual(newViewport);
    });
  });

  describe("ESCAPE handling", () => {
    test("should exit from editing insert mode to normal mode", () => {
      stateMachine.transition({ type: "START_EDITING", editMode: "i" });
      const result = stateMachine.transition({ type: "ESCAPE" });

      expect(result.ok).toBe(true);
      const state = stateMachine.getState();

      if (isEditingMode(state)) {
        expect(state.cellMode).toBe("normal");
      }
    });

    test("should exit from editing normal mode to navigation", () => {
      stateMachine.transition({ type: "START_EDITING" });
      const result = stateMachine.transition({ type: "ESCAPE" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });

    test("should exit from command mode to navigation", () => {
      stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      const result = stateMachine.transition({ type: "ESCAPE" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });

    test("should do nothing in navigation mode", () => {
      const result = stateMachine.transition({ type: "ESCAPE" });

      expect(result.ok).toBe(true);
      expect(isNavigationMode(stateMachine.getState())).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    test("should reject invalid action from wrong state", () => {
      const result = stateMachine.transition({ type: "EXIT_INSERT_MODE" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });
  });

  describe("history tracking", () => {
    test("should track state history", () => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({ type: "ENTER_INSERT_MODE" });

      const history = stateMachine.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].action.type).toBe("START_EDITING");
      expect(history[1].action.type).toBe("ENTER_INSERT_MODE");
    });
  });

  describe("subscription", () => {
    test("should notify listeners on state change", () => {
      let notificationCount = 0;
      let lastState: any;
      let lastAction: any;

      const unsubscribe = stateMachine.subscribe((state, action) => {
        notificationCount++;
        lastState = state;
        lastAction = action;
      });

      stateMachine.transition({ type: "START_EDITING" });

      expect(notificationCount).toBe(1);
      expect(lastState.spreadsheetMode).toBe("editing");
      expect(lastAction.type).toBe("START_EDITING");

      unsubscribe();
      stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });

      expect(notificationCount).toBe(1); // Should not increase after unsubscribe
    });
  });

  describe("helper methods", () => {
    test("startEditingMode helper", () => {
      const result = stateMachine.startEditingMode("i");
      expect(result.ok).toBe(true);
      const state = stateMachine.getState();
      expect(state.spreadsheetMode).toBe("editing");
      if (state.spreadsheetMode === "editing") {
        expect(state.cellMode).toBe("insert");
        expect(state.editVariant).toBe("i");
      }
    });

    test("exitEditingMode helper", () => {
      stateMachine.transition({ type: "START_EDITING" });
      const result = stateMachine.exitEditingMode();
      expect(result.ok).toBe(true);
      expect(stateMachine.getState().spreadsheetMode).toBe("navigation");
    });
  });
});
