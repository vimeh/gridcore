import { beforeEach, describe, expect, test } from "bun:test";
import {
  createSpreadsheetStateMachine,
  type SpreadsheetState,
  SpreadsheetStateMachine,
} from "./SpreadsheetStateMachine";

describe("SpreadsheetStateMachine", () => {
  let stateMachine: SpreadsheetStateMachine;

  beforeEach(() => {
    stateMachine = new SpreadsheetStateMachine();
  });

  describe("initialization", () => {
    test("starts in navigation mode with normal interaction", () => {
      const state = stateMachine.getState();
      expect(state.type).toBe("navigation");
      expect(state.interactionMode).toBe("normal");
      expect(stateMachine.isNavigating()).toBe(true);
      expect(stateMachine.isEditing()).toBe(false);
    });

    test("can be initialized with custom state", () => {
      const customState: SpreadsheetState = {
        type: "editing",
        substate: { type: "insert", mode: "append" },
        interactionMode: "keyboard-only",
      };
      const sm = new SpreadsheetStateMachine(customState);
      expect(sm.getState()).toEqual(customState);
    });

    test("factory function works", () => {
      const sm = createSpreadsheetStateMachine();
      expect(sm).toBeInstanceOf(SpreadsheetStateMachine);
    });
  });

  describe("navigation state transitions", () => {
    test("can start editing", () => {
      const result = stateMachine.transition({ type: "START_EDITING" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isEditing()).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("can start editing with initial mode", () => {
      const result = stateMachine.transition({
        type: "START_EDITING",
        editMode: "append",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInInsertMode()).toBe(true);
      expect(stateMachine.getInsertMode()).toBe("append");
    });

    test("can toggle interaction mode", () => {
      const result = stateMachine.transition({
        type: "TOGGLE_INTERACTION_MODE",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInKeyboardOnlyMode()).toBe(true);
    });

    test("can set interaction mode", () => {
      const result = stateMachine.transition({
        type: "SET_INTERACTION_MODE",
        mode: "keyboard-only",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.getInteractionMode()).toBe("keyboard-only");
    });

    test("invalid transitions return error", () => {
      const result = stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });
  });

  describe("editing state transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
    });

    test("can stop editing", () => {
      const result = stateMachine.transition({ type: "STOP_EDITING" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isNavigating()).toBe(true);
    });

    test("escape returns to navigation", () => {
      const result = stateMachine.transition({ type: "ESCAPE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isNavigating()).toBe(true);
    });

    test("preserves interaction mode when stopping editing", () => {
      stateMachine.transition({
        type: "SET_INTERACTION_MODE",
        mode: "keyboard-only",
      });
      stateMachine.transition({ type: "STOP_EDITING" });
      expect(stateMachine.getInteractionMode()).toBe("keyboard-only");
    });

    test("can toggle interaction mode while editing", () => {
      // Start with normal mode
      expect(stateMachine.getInteractionMode()).toBe("normal");
      
      // Toggle to keyboard-only
      const result1 = stateMachine.transition({ type: "TOGGLE_INTERACTION_MODE" });
      expect(result1.ok).toBe(true);
      expect(stateMachine.isEditing()).toBe(true);
      expect(stateMachine.getInteractionMode()).toBe("keyboard-only");
      
      // Toggle back to normal
      const result2 = stateMachine.transition({ type: "TOGGLE_INTERACTION_MODE" });
      expect(result2.ok).toBe(true);
      expect(stateMachine.isEditing()).toBe(true);
      expect(stateMachine.getInteractionMode()).toBe("normal");
    });

    test("escape preserves interaction mode when returning to navigation", () => {
      // Set to keyboard-only mode
      stateMachine.transition({
        type: "SET_INTERACTION_MODE",
        mode: "keyboard-only",
      });
      expect(stateMachine.getInteractionMode()).toBe("keyboard-only");
      
      // Use escape to return to navigation
      const result = stateMachine.transition({ type: "ESCAPE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isNavigating()).toBe(true);
      expect(stateMachine.getInteractionMode()).toBe("keyboard-only");
    });
  });

  describe("normal editing substate transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
    });

    test("can enter insert mode", () => {
      const result = stateMachine.transition({ type: "ENTER_INSERT_MODE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInInsertMode()).toBe(true);
      expect(stateMachine.getInsertMode()).toBe("insert");
    });

    test("can enter insert mode with specific mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_INSERT_MODE",
        mode: "append",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.getInsertMode()).toBe("append");
    });

    test("can enter visual mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "character",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInVisualMode()).toBe(true);
      expect(stateMachine.getVisualMode()).toBe("character");
    });

    test("can enter visual line mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "line",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.getVisualMode()).toBe("line");
    });

    test("can enter visual block mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_VISUAL_BLOCK_MODE",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.getVisualMode()).toBe("block");
    });

    test("can enter resize mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: { type: "column", index: 5 },
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInResizeMode()).toBe(true);
    });
  });

  describe("insert mode transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({ type: "ENTER_INSERT_MODE", mode: "insert" });
    });

    test("can exit insert mode", () => {
      const result = stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("escape exits insert mode", () => {
      const result = stateMachine.transition({ type: "ESCAPE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("can change edit mode", () => {
      const result = stateMachine.transition({
        type: "SET_EDIT_MODE",
        mode: "replace",
      });
      expect(result.ok).toBe(true);
      expect(stateMachine.getInsertMode()).toBe("replace");
    });

    test("cannot enter visual mode from insert mode", () => {
      const result = stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "character",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("visual mode transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "character",
      });
    });

    test("can exit visual mode", () => {
      const result = stateMachine.transition({ type: "EXIT_VISUAL_MODE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("escape exits visual mode", () => {
      const result = stateMachine.transition({ type: "ESCAPE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("cannot enter insert mode from visual mode", () => {
      const result = stateMachine.transition({ type: "ENTER_INSERT_MODE" });
      expect(result.ok).toBe(false);
    });
  });

  describe("resize mode transitions", () => {
    beforeEach(() => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: { type: "column", index: 3 },
      });
    });

    test("can exit resize mode", () => {
      const result = stateMachine.transition({ type: "EXIT_RESIZE_MODE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });

    test("escape exits resize mode", () => {
      const result = stateMachine.transition({ type: "ESCAPE" });
      expect(result.ok).toBe(true);
      expect(stateMachine.isInNormalMode()).toBe(true);
    });
  });

  describe("query methods", () => {
    test("mode string representation", () => {
      expect(stateMachine.getModeString()).toBe("navigation");

      stateMachine.transition({ type: "START_EDITING" });
      expect(stateMachine.getModeString()).toBe("editing:normal");

      stateMachine.transition({ type: "ENTER_INSERT_MODE", mode: "append" });
      expect(stateMachine.getModeString()).toBe("editing:insert:append");

      stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "line",
      });
      expect(stateMachine.getModeString()).toBe("editing:visual:line");

      stateMachine.transition({ type: "EXIT_VISUAL_MODE" });
      stateMachine.transition({
        type: "ENTER_RESIZE_MODE",
        target: { type: "row", index: 1 },
      });
      expect(stateMachine.getModeString()).toBe("editing:resize:row");
    });

    test("returns undefined for modes when not in that state", () => {
      expect(stateMachine.getInsertMode()).toBeUndefined();
      expect(stateMachine.getVisualMode()).toBeUndefined();
    });
  });

  describe("state subscriptions", () => {
    test("notifies listeners on state change", () => {
      let notificationCount = 0;
      let lastState: SpreadsheetState | null = null;

      const unsubscribe = stateMachine.subscribe((state) => {
        notificationCount++;
        lastState = state;
      });

      stateMachine.transition({ type: "START_EDITING" });
      expect(notificationCount).toBe(1);
      expect(lastState?.type).toBe("editing");

      stateMachine.transition({ type: "ENTER_INSERT_MODE" });
      expect(notificationCount).toBe(2);

      unsubscribe();
      stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      expect(notificationCount).toBe(2); // No more notifications
    });

    test("does not notify on failed transitions", () => {
      let notificationCount = 0;

      stateMachine.subscribe(() => {
        notificationCount++;
      });

      stateMachine.transition({ type: "EXIT_INSERT_MODE" }); // Invalid transition
      expect(notificationCount).toBe(0);
    });
  });

  describe("error handling", () => {
    test("provides meaningful error messages", () => {
      const result = stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    test("prevents invalid substate transitions", () => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({ type: "ENTER_INSERT_MODE" });

      const result = stateMachine.transition({
        type: "ENTER_VISUAL_MODE",
        visualType: "character",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });
  });
});
