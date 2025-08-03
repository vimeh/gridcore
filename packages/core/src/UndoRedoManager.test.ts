import { beforeEach, describe, expect, test } from "bun:test";
import type { SpreadsheetState } from "./types/SpreadsheetState";
import { UndoRedoManager } from "./UndoRedoManager";

describe("UndoRedoManager", () => {
  let manager: UndoRedoManager;
  let testState: SpreadsheetState;

  beforeEach(() => {
    manager = new UndoRedoManager();
    testState = {
      version: "1.0",
      dimensions: { rows: 10, cols: 10 },
      cells: [
        {
          address: { row: 0, col: 0 },
          cell: {
            rawValue: "A1",
            computedValue: "A1",
          },
        },
      ],
      dependencies: {
        dependencies: [],
        dependents: [],
      },
    };
  });

  describe("recordState", () => {
    test("should record initial state", () => {
      manager.recordState(testState, "Initial state");
      const snapshot = manager.getCurrentSnapshot();

      expect(snapshot).toBeTruthy();
      expect(snapshot?.description).toBe("Initial state");
      expect(snapshot?.state.cells).toEqual(testState.cells);
    });

    test("should create new snapshots with parent-child relationships", () => {
      manager.recordState(testState, "State 1");
      const snapshot1 = manager.getCurrentSnapshot();

      const modifiedState = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "Modified",
              computedValue: "Modified",
            },
          },
        ],
      };

      manager.recordState(modifiedState, "State 2");
      const snapshot2 = manager.getCurrentSnapshot();

      expect(snapshot2?.parentId).toBe(snapshot1?.id);
      expect(snapshot1?.childIds).toContain(snapshot2?.id);
    });
  });

  describe("undo", () => {
    test("should return null when no undo is possible", () => {
      expect(manager.undo()).toBeNull();
    });

    test("should undo to previous state", () => {
      manager.recordState(testState, "State 1");

      const modifiedState = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "Modified",
              computedValue: "Modified",
            },
          },
        ],
      };

      manager.recordState(modifiedState, "State 2");

      const undoneState = manager.undo();
      expect(undoneState).not.toBeNull();
      expect(undoneState?.cells[0].cell.rawValue).toBe("A1");
    });

    test("should handle multiple undo operations", () => {
      manager.recordState(testState, "State 1");

      const state2 = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "State 2",
              computedValue: "State 2",
            },
          },
        ],
      };
      manager.recordState(state2, "State 2");

      const state3 = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "State 3",
              computedValue: "State 3",
            },
          },
        ],
      };
      manager.recordState(state3, "State 3");

      // Undo twice
      manager.undo();
      const result = manager.undo();

      expect(result?.cells[0].cell.rawValue).toBe("A1");
    });
  });

  describe("redo", () => {
    test("should return null when no redo is possible", () => {
      expect(manager.redo()).toBeNull();
    });

    test("should redo to next state", () => {
      manager.recordState(testState, "State 1");

      const modifiedState = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "Modified",
              computedValue: "Modified",
            },
          },
        ],
      };

      manager.recordState(modifiedState, "State 2");
      manager.undo();

      const redoneState = manager.redo();
      expect(redoneState).not.toBeNull();
      expect(redoneState?.cells[0].cell.rawValue).toBe("Modified");
    });

    test("should handle branching history", () => {
      manager.recordState(testState, "State 1");

      const state2 = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "State 2",
              computedValue: "State 2",
            },
          },
        ],
      };
      manager.recordState(state2, "State 2");

      // Undo to state 1
      manager.undo();

      // Create a new branch
      const state2b = {
        ...testState,
        cells: [
          {
            address: { row: 0, col: 0 },
            cell: {
              rawValue: "State 2b",
              computedValue: "State 2b",
            },
          },
        ],
      };
      manager.recordState(state2b, "State 2b");

      // Should not be able to redo to original State 2
      const currentSnapshot = manager.getCurrentSnapshot();
      expect(currentSnapshot?.state.cells[0].cell.rawValue).toBe("State 2b");
    });
  });

  describe("canUndo/canRedo", () => {
    test("canUndo should return false initially", () => {
      expect(manager.canUndo()).toBe(false);
    });

    test("canUndo should return false for first snapshot", () => {
      manager.recordState(testState, "State 1");
      expect(manager.canUndo()).toBe(false);
    });

    test("canUndo should return true after multiple states", () => {
      manager.recordState(testState, "State 1");
      manager.recordState(testState, "State 2");
      expect(manager.canUndo()).toBe(true);
    });

    test("canRedo should return false initially", () => {
      expect(manager.canRedo()).toBe(false);
    });

    test("canRedo should return true after undo", () => {
      manager.recordState(testState, "State 1");
      manager.recordState(testState, "State 2");
      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });

    test("canRedo should return false after recording new state", () => {
      manager.recordState(testState, "State 1");
      manager.recordState(testState, "State 2");
      manager.undo();
      manager.recordState(testState, "State 3");
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe("history management", () => {
    test("should handle history with branching", () => {
      const smallManager = new UndoRedoManager({ maxHistorySize: 10 });

      // Create initial states
      smallManager.recordState(testState, "State 1");
      smallManager.recordState(testState, "State 2");
      smallManager.recordState(testState, "State 3");

      // Go back and create a branch
      smallManager.undo(); // Back to State 2
      smallManager.recordState(testState, "State 3b");

      // We should have both branches in history
      const history = smallManager.getHistory();
      const descriptions = history.map((h) => h.description);
      expect(descriptions).toContain("State 3");
      expect(descriptions).toContain("State 3b");
    });

    test("should always preserve current lineage for undo", () => {
      const smallManager = new UndoRedoManager({ maxHistorySize: 3 });

      // Create a long chain of states
      for (let i = 0; i < 10; i++) {
        smallManager.recordState(testState, `State ${i + 1}`);
      }

      // Even though we exceed maxHistorySize, we should be able to undo
      // all the way back because current lineage is preserved
      let undoCount = 0;
      while (smallManager.canUndo()) {
        smallManager.undo();
        undoCount++;
      }

      // Should be able to undo 9 times (from State 10 back to State 1)
      expect(undoCount).toBe(9);
    });
  });

  describe("clear", () => {
    test("should clear all history", () => {
      manager.recordState(testState, "State 1");
      manager.recordState(testState, "State 2");

      manager.clear();

      expect(manager.getCurrentSnapshot()).toBeNull();
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
      expect(manager.getHistory()).toHaveLength(0);
    });
  });
});
