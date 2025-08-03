import { beforeEach, describe, expect, test } from "bun:test"
import { SpreadsheetEngine } from "./SpreadsheetEngine"

describe("SpreadsheetEngine - Undo/Redo", () => {
  let engine: SpreadsheetEngine

  beforeEach(() => {
    engine = new SpreadsheetEngine(10, 10)
  })

  test("should undo cell changes", () => {
    // Set initial value
    engine.setCell({ row: 0, col: 0 }, "Initial")
    
    // Change the value
    engine.setCell({ row: 0, col: 0 }, "Modified")
    
    // Verify the change
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Modified")
    
    // Undo the change
    const undoResult = engine.undo()
    expect(undoResult).toBe(true)
    
    // Verify the value was restored
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Initial")
  })

  test("should redo cell changes", () => {
    engine.setCell({ row: 0, col: 0 }, "Initial")
    engine.setCell({ row: 0, col: 0 }, "Modified")
    
    // Undo then redo
    engine.undo()
    const redoResult = engine.redo()
    expect(redoResult).toBe(true)
    
    // Verify the value was restored
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Modified")
  })

  test("should handle multiple undo/redo operations", () => {
    engine.setCell({ row: 0, col: 0 }, "Step 1")
    engine.setCell({ row: 0, col: 0 }, "Step 2")
    engine.setCell({ row: 0, col: 0 }, "Step 3")
    
    // Undo twice
    engine.undo() // Back to Step 2
    engine.undo() // Back to Step 1
    
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Step 1")
    
    // Redo once
    engine.redo() // Forward to Step 2
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Step 2")
  })

  test("should undo/redo batch operations", () => {
    const updates = [
      { address: { row: 0, col: 0 }, value: "A1" },
      { address: { row: 0, col: 1 }, value: "B1" },
      { address: { row: 1, col: 0 }, value: "A2" },
    ]
    
    engine.setCells(updates)
    
    // Verify all cells were set
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("A1")
    expect(engine.getCell({ row: 0, col: 1 })?.rawValue).toBe("B1")
    expect(engine.getCell({ row: 1, col: 0 })?.rawValue).toBe("A2")
    
    // Undo the batch operation
    engine.undo()
    
    // All cells should be empty
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBeUndefined()
    expect(engine.getCell({ row: 0, col: 1 })?.rawValue).toBeUndefined()
    expect(engine.getCell({ row: 1, col: 0 })?.rawValue).toBeUndefined()
    
    // Redo the batch operation
    engine.redo()
    
    // All cells should be restored
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("A1")
    expect(engine.getCell({ row: 0, col: 1 })?.rawValue).toBe("B1")
    expect(engine.getCell({ row: 1, col: 0 })?.rawValue).toBe("A2")
  })

  test("should undo/redo formula changes", () => {
    // Set some values
    engine.setCell({ row: 0, col: 0 }, 10)
    engine.setCell({ row: 0, col: 1 }, 20)
    
    // Set a formula
    engine.setCell({ row: 0, col: 2 }, "=A1+B1", "=A1+B1")
    expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(30)
    
    // Change the formula
    engine.setCell({ row: 0, col: 2 }, "=A1*B1", "=A1*B1")
    expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(200)
    
    // Undo to previous formula
    engine.undo()
    expect(engine.getCell({ row: 0, col: 2 })?.formula).toBe("=A1+B1")
    expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(30)
    
    // Redo to multiplication formula
    engine.redo()
    expect(engine.getCell({ row: 0, col: 2 })?.formula).toBe("=A1*B1")
    expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(200)
  })

  test("should track canUndo and canRedo states", () => {
    // Initially cannot undo (only initial state recorded)
    expect(engine.canUndo()).toBe(false)
    expect(engine.canRedo()).toBe(false)
    
    // After a change, can undo but not redo
    engine.setCell({ row: 0, col: 0 }, "Value")
    expect(engine.canUndo()).toBe(true)
    expect(engine.canRedo()).toBe(false)
    
    // After undo, can redo
    engine.undo()
    expect(engine.canUndo()).toBe(false) // Back to initial state
    expect(engine.canRedo()).toBe(true)
    
    // After redo, can undo again
    engine.redo()
    expect(engine.canUndo()).toBe(true)
    expect(engine.canRedo()).toBe(false)
  })

  test("should clear redo history when making new changes", () => {
    engine.setCell({ row: 0, col: 0 }, "Step 1")
    engine.setCell({ row: 0, col: 0 }, "Step 2")
    
    // Undo to Step 1
    engine.undo()
    expect(engine.canRedo()).toBe(true)
    
    // Make a new change (creates a branch)
    engine.setCell({ row: 0, col: 0 }, "Step 2b")
    
    // Can no longer redo to original Step 2
    expect(engine.canRedo()).toBe(false)
  })

  test("should handle clearCell with undo/redo", () => {
    engine.setCell({ row: 0, col: 0 }, "Value")
    engine.clearCell({ row: 0, col: 0 })
    
    expect(engine.getCell({ row: 0, col: 0 })).toBeUndefined()
    
    // Undo the clear
    engine.undo()
    expect(engine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Value")
    
    // Redo the clear
    engine.redo()
    expect(engine.getCell({ row: 0, col: 0 })).toBeUndefined()
  })

  test("should preserve state when loading from SpreadsheetState", () => {
    // Create some state
    engine.setCell({ row: 0, col: 0 }, "A1")
    engine.setCell({ row: 0, col: 1 }, "B1")
    
    // Get the state
    const state = engine.toState()
    
    // Create a new engine from the state
    const newEngine = SpreadsheetEngine.fromState(state)
    
    // Verify the state was preserved
    expect(newEngine.getCell({ row: 0, col: 0 })?.rawValue).toBe("A1")
    expect(newEngine.getCell({ row: 0, col: 1 })?.rawValue).toBe("B1")
    
    // Verify undo/redo works in the new engine
    newEngine.setCell({ row: 0, col: 0 }, "Modified")
    expect(newEngine.canUndo()).toBe(true)
    
    newEngine.undo()
    expect(newEngine.getCell({ row: 0, col: 0 })?.rawValue).toBe("A1")
  })
})