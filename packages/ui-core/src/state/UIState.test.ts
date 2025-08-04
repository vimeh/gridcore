import { expect, test, describe } from "bun:test"
import {
  createNavigationState,
  createEditingState,
  createCommandState,
  createResizeState,
  isNavigationMode,
  isEditingMode,
  isCommandMode,
  isResizeMode,
  isInsertMode,
  isVisualMode,
  type UIState,
} from "./UIState"
import { CellAddress } from "@gridcore/core"

describe("UIState", () => {
  const defaultCursor = CellAddress.create(0, 0).value
  const defaultViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 }

  describe("state creation", () => {
    test("createNavigationState", () => {
      const state = createNavigationState(defaultCursor, defaultViewport)
      expect(state.spreadsheetMode).toBe("navigation")
      expect(state.cursor).toEqual(defaultCursor)
      expect(state.viewport).toEqual(defaultViewport)
    })

    test("createEditingState with defaults", () => {
      const state = createEditingState(defaultCursor, defaultViewport)
      expect(state.spreadsheetMode).toBe("editing")
      expect(state.cellMode).toBe("normal")
      expect(state.editingValue).toBe("")
      expect(state.cursorPosition).toBe(0)
    })

    test("createEditingState with custom values", () => {
      const state = createEditingState(
        defaultCursor,
        defaultViewport,
        "insert",
        "test content"
      )
      expect(state.cellMode).toBe("insert")
      expect(state.editingValue).toBe("test content")
      expect(state.cursorPosition).toBe(12) // Length of "test content"
    })

    test("createCommandState", () => {
      const state = createCommandState(defaultCursor, defaultViewport, "w")
      expect(state.spreadsheetMode).toBe("command")
      expect(state.commandValue).toBe("w")
    })

    test("createResizeState", () => {
      const state = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        5,
        100
      )
      expect(state.spreadsheetMode).toBe("resize")
      expect(state.resizeTarget).toBe("column")
      expect(state.resizeIndex).toBe(5)
      expect(state.originalSize).toBe(100)
      expect(state.currentSize).toBe(100)
    })
  })

  describe("type guards", () => {
    test("isNavigationMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const editState = createEditingState(defaultCursor, defaultViewport)
      
      expect(isNavigationMode(navState)).toBe(true)
      expect(isNavigationMode(editState)).toBe(false)
    })

    test("isEditingMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const editState = createEditingState(defaultCursor, defaultViewport)
      
      expect(isEditingMode(navState)).toBe(false)
      expect(isEditingMode(editState)).toBe(true)
    })

    test("isCommandMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const cmdState = createCommandState(defaultCursor, defaultViewport)
      
      expect(isCommandMode(navState)).toBe(false)
      expect(isCommandMode(cmdState)).toBe(true)
    })

    test("isResizeMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "row",
        0,
        50
      )
      
      expect(isResizeMode(navState)).toBe(false)
      expect(isResizeMode(resizeState)).toBe(true)
    })
  })

  describe("editing mode helpers", () => {
    test("isInsertMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const normalEditState = createEditingState(defaultCursor, defaultViewport, "normal")
      const insertEditState = createEditingState(defaultCursor, defaultViewport, "insert")
      
      expect(isInsertMode(navState)).toBe(false)
      expect(isInsertMode(normalEditState)).toBe(false)
      expect(isInsertMode(insertEditState)).toBe(true)
    })

    test("isVisualMode", () => {
      const navState = createNavigationState(defaultCursor, defaultViewport)
      const normalEditState = createEditingState(defaultCursor, defaultViewport, "normal")
      const visualEditState: UIState = {
        ...createEditingState(defaultCursor, defaultViewport, "visual"),
        visualType: "character",
        visualStart: 0,
      }
      
      expect(isVisualMode(navState)).toBe(false)
      expect(isVisualMode(normalEditState)).toBe(false)
      expect(isVisualMode(visualEditState)).toBe(true)
    })
  })

  describe("state properties", () => {
    test("all states have cursor and viewport", () => {
      const states: UIState[] = [
        createNavigationState(defaultCursor, defaultViewport),
        createEditingState(defaultCursor, defaultViewport),
        createCommandState(defaultCursor, defaultViewport),
        createResizeState(defaultCursor, defaultViewport, "column", 0, 100),
      ]

      states.forEach(state => {
        expect(state.cursor).toEqual(defaultCursor)
        expect(state.viewport).toEqual(defaultViewport)
      })
    })

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
      }

      expect(isEditingMode(state)).toBe(true)
      expect(isVisualMode(state)).toBe(true)
      expect(state.visualType).toBe("character")
      expect(state.visualStart).toBe(0)
    })

    test("editing state with insert variant", () => {
      const state: UIState = {
        spreadsheetMode: "editing",
        cursor: defaultCursor,
        viewport: defaultViewport,
        cellMode: "insert",
        editingValue: "test",
        cursorPosition: 2,
        editVariant: "a",
      }

      expect(isInsertMode(state)).toBe(true)
      expect(state.editVariant).toBe("a")
    })
  })
})