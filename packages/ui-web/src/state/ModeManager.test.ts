import { test, expect, describe, beforeEach } from "bun:test"
import { ModeManager, createModeManager } from "./ModeManager"
import { SpreadsheetModeStateMachine } from "./SpreadsheetMode"

describe("ModeManager", () => {
  let modeManager: ModeManager

  beforeEach(() => {
    modeManager = new ModeManager()
  })

  describe("initialization", () => {
    test("starts in navigation mode", () => {
      expect(modeManager.isNavigating()).toBe(true)
      expect(modeManager.isEditing()).toBe(false)
      expect(modeManager.getGridMode()).toBe("navigation")
      expect(modeManager.getCellMode()).toBe("normal")
      expect(modeManager.getInteractionMode()).toBe("normal")
    })

    test("can be created with existing state machine", () => {
      const stateMachine = new SpreadsheetModeStateMachine()
      const manager = new ModeManager(stateMachine)
      expect(manager.getStateMachine()).toBe(stateMachine)
    })

    test("createModeManager factory function works", () => {
      const manager = createModeManager()
      expect(manager).toBeInstanceOf(ModeManager)
    })
  })

  describe("mode queries", () => {
    test("navigation mode queries", () => {
      expect(modeManager.isNavigating()).toBe(true)
      expect(modeManager.isEditing()).toBe(false)
      expect(modeManager.isInInsertMode()).toBe(false)
      expect(modeManager.isInVisualMode()).toBe(false)
      expect(modeManager.isInNormalCellMode()).toBe(false)
    })

    test("editing mode queries after starting editing", () => {
      modeManager.startEditing()
      
      expect(modeManager.isNavigating()).toBe(false)
      expect(modeManager.isEditing()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
      expect(modeManager.isInInsertMode()).toBe(false)
      expect(modeManager.isInVisualMode()).toBe(false)
    })

    test("insert mode queries", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode("insert")
      
      expect(modeManager.isInInsertMode()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(false)
      expect(modeManager.getCurrentEditMode()).toBe("insert")
    })

    test("visual mode queries", () => {
      modeManager.startEditing()
      modeManager.enterVisualMode("character")
      
      expect(modeManager.isInVisualMode()).toBe(true)
      expect(modeManager.isInVisualCharacterMode()).toBe(true)
      expect(modeManager.isInVisualLineMode()).toBe(false)
      expect(modeManager.isInNormalCellMode()).toBe(false)
    })

    test("visual line mode queries", () => {
      modeManager.startEditing()
      modeManager.enterVisualMode("line")
      
      expect(modeManager.isInVisualMode()).toBe(true)
      expect(modeManager.isInVisualCharacterMode()).toBe(false)
      expect(modeManager.isInVisualLineMode()).toBe(true)
    })

    test("interaction mode queries", () => {
      expect(modeManager.isInNormalInteractionMode()).toBe(true)
      expect(modeManager.isInKeyboardOnlyMode()).toBe(false)
      
      modeManager.toggleInteractionMode()
      
      expect(modeManager.isInNormalInteractionMode()).toBe(false)
      expect(modeManager.isInKeyboardOnlyMode()).toBe(true)
    })

    test("edit mode queries", () => {
      modeManager.startEditing("append")
      modeManager.enterInsertMode()
      
      expect(modeManager.isInAppendMode()).toBe(true)
      expect(modeManager.isInReplaceMode()).toBe(false)
      expect(modeManager.getCurrentEditMode()).toBe("append")
    })
  })

  describe("transitions", () => {
    test("start and stop editing", () => {
      expect(modeManager.startEditing()).toBe(true)
      expect(modeManager.isEditing()).toBe(true)
      
      expect(modeManager.stopEditing()).toBe(true)
      expect(modeManager.isNavigating()).toBe(true)
    })

    test("enter and exit insert mode", () => {
      modeManager.startEditing()
      
      expect(modeManager.enterInsertMode("insert")).toBe(true)
      expect(modeManager.isInInsertMode()).toBe(true)
      
      expect(modeManager.exitInsertMode()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
    })

    test("enter and exit visual mode", () => {
      modeManager.startEditing()
      
      expect(modeManager.enterVisualMode()).toBe(true)
      expect(modeManager.isInVisualCharacterMode()).toBe(true)
      
      expect(modeManager.exitVisualMode()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
    })

    test("set edit mode", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode("insert")
      
      expect(modeManager.setEditMode("append")).toBe(true)
      expect(modeManager.getCurrentEditMode()).toBe("append")
    })

    test("toggle interaction mode", () => {
      expect(modeManager.toggleInteractionMode()).toBe(true)
      expect(modeManager.isInKeyboardOnlyMode()).toBe(true)
      
      expect(modeManager.toggleInteractionMode()).toBe(true)
      expect(modeManager.isInNormalInteractionMode()).toBe(true)
    })

    test("set interaction mode", () => {
      expect(modeManager.setInteractionMode("keyboard-only")).toBe(true)
      expect(modeManager.isInKeyboardOnlyMode()).toBe(true)
      
      expect(modeManager.setInteractionMode("normal")).toBe(true)
      expect(modeManager.isInNormalInteractionMode()).toBe(true)
    })

    test("escape behavior", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode("insert")
      
      // First escape exits insert mode
      expect(modeManager.handleEscape()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
      
      // Second escape exits editing
      expect(modeManager.handleEscape()).toBe(true)
      expect(modeManager.isNavigating()).toBe(true)
    })
  })

  describe("convenience methods", () => {
    test("startEditingInInsertMode", () => {
      expect(modeManager.startEditingInInsertMode("append")).toBe(true)
      expect(modeManager.isInInsertMode()).toBe(true)
      expect(modeManager.getCurrentEditMode()).toBe("append")
    })

    test("startEditingInVisualMode", () => {
      expect(modeManager.startEditingInVisualMode("line")).toBe(true)
      expect(modeManager.isInVisualLineMode()).toBe(true)
    })

    test("returnToNavigation", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode()
      
      expect(modeManager.returnToNavigation()).toBe(true)
      expect(modeManager.isNavigating()).toBe(true)
    })

    test("returnToNormalCellMode from insert", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode()
      
      expect(modeManager.returnToNormalCellMode()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
    })

    test("returnToNormalCellMode from visual", () => {
      modeManager.startEditing()
      modeManager.enterVisualMode()
      
      expect(modeManager.returnToNormalCellMode()).toBe(true)
      expect(modeManager.isInNormalCellMode()).toBe(true)
    })
  })

  describe("validation", () => {
    test("canStartEditing", () => {
      expect(modeManager.canStartEditing()).toBe(true)
      
      modeManager.startEditing()
      expect(modeManager.canStartEditing()).toBe(false)
    })

    test("canStopEditing", () => {
      expect(modeManager.canStopEditing()).toBe(false)
      
      modeManager.startEditing()
      expect(modeManager.canStopEditing()).toBe(true)
    })

    test("canEnterInsertMode", () => {
      expect(modeManager.canEnterInsertMode()).toBe(false)
      
      modeManager.startEditing()
      expect(modeManager.canEnterInsertMode()).toBe(true)
      
      modeManager.enterInsertMode()
      expect(modeManager.canEnterInsertMode()).toBe(false)
    })

    test("isValidEditMode", () => {
      expect(modeManager.isValidEditMode("insert")).toBe(true)
      expect(modeManager.isValidEditMode("append")).toBe(true)
      expect(modeManager.isValidEditMode("replace")).toBe(true)
    })

    test("isValidInteractionMode", () => {
      expect(modeManager.isValidInteractionMode("normal")).toBe(true)
      expect(modeManager.isValidInteractionMode("keyboard-only")).toBe(true)
    })
  })

  describe("event subscription", () => {
    test("onModeChange subscription", () => {
      let changeCount = 0
      let lastState: any = null
      
      const unsubscribe = modeManager.onModeChange((newState, previousState) => {
        changeCount++
        lastState = newState
      })
      
      modeManager.startEditing()
      expect(changeCount).toBe(1)
      expect(lastState?.gridMode).toBe("editing")
      
      modeManager.enterInsertMode()
      expect(changeCount).toBe(2)
      expect(lastState?.cellMode).toBe("insert")
      
      unsubscribe()
      modeManager.exitInsertMode()
      expect(changeCount).toBe(2) // Should not increment after unsubscribe
    })

    test("onModeChangeFiltered subscription", () => {
      let changeCount = 0
      
      const unsubscribe = modeManager.onModeChangeFiltered(
        () => changeCount++,
        { cellMode: ["insert"] }
      )
      
      modeManager.startEditing() // Should not trigger (gridMode change only)
      expect(changeCount).toBe(0)
      
      modeManager.enterInsertMode() // Should trigger (cellMode becomes insert)
      expect(changeCount).toBe(1)
      
      modeManager.setEditMode("append") // Should trigger (still in insert mode)
      expect(changeCount).toBe(2)
      
      modeManager.exitInsertMode() // Should not trigger (cellMode becomes normal)
      expect(changeCount).toBe(2)
      
      unsubscribe()
    })
  })

  describe("utility methods", () => {
    test("getStateDescription", () => {
      expect(modeManager.getStateDescription()).toBe("Grid Navigation")
      
      modeManager.startEditing()
      expect(modeManager.getStateDescription()).toBe("Cell Edit - Normal")
      
      modeManager.enterInsertMode("append")
      expect(modeManager.getStateDescription()).toBe("Cell Edit - Insert (append)")
    })

    test("getAllowedTransitions", () => {
      const transitions = modeManager.getAllowedTransitions()
      expect(transitions).toContain("START_EDITING")
      expect(transitions).toContain("TOGGLE_INTERACTION_MODE")
      expect(transitions).not.toContain("STOP_EDITING")
    })

    test("reset", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode()
      modeManager.setInteractionMode("keyboard-only")
      
      modeManager.reset()
      
      expect(modeManager.isNavigating()).toBe(true)
      expect(modeManager.getCellMode()).toBe("normal")
      expect(modeManager.getInteractionMode()).toBe("normal")
    })

    test("getDebugInfo", () => {
      const debug = modeManager.getDebugInfo()
      expect(debug).toHaveProperty("state")
      expect(debug).toHaveProperty("description")
      expect(debug).toHaveProperty("allowedTransitions")
      expect(debug).toHaveProperty("canStartEditing")
    })
  })

  describe("error handling", () => {
    test("invalid transitions return false", () => {
      // Can't stop editing when not editing
      expect(modeManager.stopEditing()).toBe(false)
      
      // Can't enter insert mode when not editing
      expect(modeManager.enterInsertMode()).toBe(false)
      
      // Can't exit insert mode when not in insert mode
      modeManager.startEditing()
      expect(modeManager.exitInsertMode()).toBe(false)
    })

    test("returnToNormalCellMode from navigation returns false", () => {
      expect(modeManager.returnToNormalCellMode()).toBe(false)
    })

    test("startEditingInInsertMode when already in insert mode maintains state", () => {
      modeManager.startEditing()
      modeManager.enterInsertMode("insert")
      
      expect(modeManager.startEditingInInsertMode("append")).toBe(true)
      expect(modeManager.isInInsertMode()).toBe(true)
    })
  })
})