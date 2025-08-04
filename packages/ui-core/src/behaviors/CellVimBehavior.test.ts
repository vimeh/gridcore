import { expect, test, describe, beforeEach } from "bun:test"
import { CellVimBehavior } from "./CellVimBehavior"
import type { UIState } from "../state/UIState"
import { createEditingState, createNavigationState } from "../state/UIState"
import { CellAddress } from "@gridcore/core"

describe("CellVimBehavior", () => {
  let behavior: CellVimBehavior
  let editingState: UIState
  let navigationState: UIState

  beforeEach(() => {
    behavior = new CellVimBehavior()
    const cursor = CellAddress.create(0, 0).value
    const viewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 }
    editingState = createEditingState(cursor, viewport, "normal", "test content", 5)
    navigationState = createNavigationState(cursor, viewport)
  })

  describe("Normal mode navigation", () => {
    test("h moves cursor left", () => {
      const action = behavior.handleKeyPress("h", { key: "h", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "left", count: 1 })
    })

    test("l moves cursor right", () => {
      const action = behavior.handleKeyPress("l", { key: "l", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "right", count: 1 })
    })

    test("0 moves to start of line", () => {
      const action = behavior.handleKeyPress("0", { key: "0", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "start" })
    })

    test("$ moves to end of line", () => {
      const action = behavior.handleKeyPress("$", { key: "$", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "end" })
    })

    test("w moves word forward", () => {
      const action = behavior.handleKeyPress("w", { key: "w", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "wordForward", count: 1 })
    })

    test("b moves word backward", () => {
      const action = behavior.handleKeyPress("b", { key: "b", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "wordBackward", count: 1 })
    })
  })

  describe("Mode transitions", () => {
    test("i enters insert mode", () => {
      const action = behavior.handleKeyPress("i", { key: "i", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "enterInsertMode", variant: "i" })
    })

    test("a enters insert mode after cursor", () => {
      const action = behavior.handleKeyPress("a", { key: "a", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "enterInsertMode", variant: "a" })
    })

    test("A enters insert mode at end of line", () => {
      const action = behavior.handleKeyPress("A", { key: "A", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "enterInsertMode", variant: "A" })
    })

    test("I enters insert mode at start of line", () => {
      const action = behavior.handleKeyPress("I", { key: "I", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "enterInsertMode", variant: "I" })
    })

    test("v enters visual mode", () => {
      const action = behavior.handleKeyPress("v", { key: "v", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "enterVisualMode", visualType: "character" })
    })

    test("escape exits insert mode", () => {
      const insertState = { ...editingState, cellMode: "insert" as const }
      const action = behavior.handleKeyPress("Escape", { key: "escape", ctrl: false, shift: false, alt: false }, insertState)
      expect(action).toEqual({ type: "exitInsertMode" })
    })

    test("escape exits visual mode", () => {
      const visualState = { ...editingState, cellMode: "visual" as const, visualType: "character" as const, visualStart: 0 }
      const action = behavior.handleKeyPress("Escape", { key: "escape", ctrl: false, shift: false, alt: false }, visualState)
      expect(action).toEqual({ type: "exitVisualMode" })
    })
  })

  describe("Insert mode", () => {
    test("handles regular character input", () => {
      const insertState = { ...editingState, cellMode: "insert" as const }
      const action = behavior.handleKeyPress("a", { key: "a", ctrl: false, shift: false, alt: false }, insertState)
      // In insert mode, regular characters return none - UI layer handles insertion
      expect(action).toEqual({ type: "none" })
    })

    test("handles Enter key", () => {
      const insertState = { ...editingState, cellMode: "insert" as const }
      const action = behavior.handleKeyPress("Enter", { key: "Enter", ctrl: false, shift: false, alt: false }, insertState)
      // Special keys also return none in insert mode
      expect(action).toEqual({ type: "none" })
    })

    test("handles Ctrl+h as Backspace", () => {
      const insertState = { ...editingState, cellMode: "insert" as const, cursorPosition: 5 }
      const action = behavior.handleKeyPress("h", { key: "h", ctrl: true, shift: false, alt: false }, insertState)
      expect(action).toEqual({ type: "deleteText", range: { start: 4, end: 5 } })
    })

    test("arrow keys return none in insert mode", () => {
      const insertState = { ...editingState, cellMode: "insert" as const }
      
      const leftAction = behavior.handleKeyPress("ArrowLeft", { key: "ArrowLeft", ctrl: false, shift: false, alt: false }, insertState)
      expect(leftAction).toEqual({ type: "none" })
      
      const rightAction = behavior.handleKeyPress("ArrowRight", { key: "ArrowRight", ctrl: false, shift: false, alt: false }, insertState)
      expect(rightAction).toEqual({ type: "none" })
    })
  })

  describe("Visual mode", () => {
    test("handles character movement", () => {
      const visualState = { ...editingState, cellMode: "visual" as const, visualType: "character" as const, visualStart: 5 }
      
      const action = behavior.handleKeyPress("l", { key: "l", ctrl: false, shift: false, alt: false }, visualState)
      expect(action).toEqual({ type: "moveCursor", direction: "right", count: 1 })
    })

    test("d deletes selection", () => {
      const visualState = { ...editingState, cellMode: "visual" as const, visualType: "character" as const, visualStart: 3, cursorPosition: 5 }
      const action = behavior.handleKeyPress("d", { key: "d", ctrl: false, shift: false, alt: false }, visualState)
      expect(action).toEqual({ type: "deleteText", range: { start: 3, end: 5 } })
    })

    test("c changes selection", () => {
      const visualState = { ...editingState, cellMode: "visual" as const, visualType: "character" as const, visualStart: 3, cursorPosition: 5 }
      const action = behavior.handleKeyPress("c", { key: "c", ctrl: false, shift: false, alt: false }, visualState)
      expect(action).toEqual({ type: "deleteText", range: { start: 3, end: 5 } })
    })
  })

  describe("Number accumulation", () => {
    test("accumulates numbers for count", () => {
      const action1 = behavior.handleKeyPress("2", { key: "2", ctrl: false, shift: false, alt: false }, editingState)
      expect(action1).toEqual({ type: "none" })
      
      const action2 = behavior.handleKeyPress("w", { key: "w", ctrl: false, shift: false, alt: false }, editingState)
      expect(action2).toEqual({ type: "moveCursor", direction: "wordForward", count: 2 })
    })

    test("0 as first character moves to start", () => {
      const action = behavior.handleKeyPress("0", { key: "0", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "start" })
    })

    test("0 after number accumulates", () => {
      behavior.handleKeyPress("2", { key: "2", ctrl: false, shift: false, alt: false }, editingState)
      const action = behavior.handleKeyPress("0", { key: "0", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "none" })
    })
  })

  describe("Delete operations", () => {
    test("x deletes character at cursor", () => {
      const state = { ...editingState, cursorPosition: 5 }
      const action = behavior.handleKeyPress("x", { key: "x", ctrl: false, shift: false, alt: false }, state)
      expect(action).toEqual({ type: "deleteText", range: { start: 5, end: 6 } })
    })

    test("dd deletes entire line", () => {
      behavior.handleKeyPress("d", { key: "d", ctrl: false, shift: false, alt: false }, editingState)
      const action = behavior.handleKeyPress("d", { key: "d", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "deleteText", range: { start: 0, end: 12 } })
    })

    test("d$ deletes to end of line", () => {
      const state = { ...editingState, cursorPosition: 5 }
      behavior.handleKeyPress("d", { key: "d", ctrl: false, shift: false, alt: false }, state)
      const action = behavior.handleKeyPress("$", { key: "$", ctrl: false, shift: false, alt: false }, state)
      expect(action).toEqual({ type: "deleteText", range: { start: 5, end: 12 } })
    })

    test("d0 deletes to start of line", () => {
      const state = { ...editingState, cursorPosition: 5 }
      behavior.handleKeyPress("d", { key: "d", ctrl: false, shift: false, alt: false }, state)
      const action = behavior.handleKeyPress("0", { key: "0", ctrl: false, shift: false, alt: false }, state)
      expect(action).toEqual({ type: "deleteText", range: { start: 0, end: 5 } })
    })
  })

  describe("Change operations", () => {
    test("cc changes entire line", () => {
      behavior.handleKeyPress("c", { key: "c", ctrl: false, shift: false, alt: false }, editingState)
      const action = behavior.handleKeyPress("c", { key: "c", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "deleteText", range: { start: 0, end: 12 } })
    })

    test("cw changes word", () => {
      const state = { ...editingState, cursorPosition: 5, editingValue: "test content" }
      behavior.handleKeyPress("c", { key: "c", ctrl: false, shift: false, alt: false }, state)
      const action = behavior.handleKeyPress("w", { key: "w", ctrl: false, shift: false, alt: false }, state)
      // At position 5 (space), next word boundary is at 12 (end of "content")
      expect(action).toEqual({ type: "deleteText", range: { start: 5, end: 12 } })
    })
  })

  describe("Non-editing state handling", () => {
    test("returns none for navigation state", () => {
      const action = behavior.handleKeyPress("h", { key: "h", ctrl: false, shift: false, alt: false }, navigationState)
      expect(action).toEqual({ type: "none" })
    })
  })

  describe("Reset", () => {
    test("reset clears internal state", () => {
      behavior.handleKeyPress("2", { key: "2", ctrl: false, shift: false, alt: false }, editingState)
      behavior.reset()
      
      const action = behavior.handleKeyPress("w", { key: "w", ctrl: false, shift: false, alt: false }, editingState)
      expect(action).toEqual({ type: "moveCursor", direction: "wordForward", count: 1 })
    })
  })
})