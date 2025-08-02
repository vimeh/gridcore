import { describe, expect, test } from "bun:test";
import { SpreadsheetEngine } from "./SpreadsheetEngine";
import type { SpreadsheetState } from "./types/SpreadsheetState";

describe("SpreadsheetEngine State Serialization", () => {
  test("toState() includes all required fields", () => {
    const engine = new SpreadsheetEngine(10, 10);
    
    // Add some data
    engine.setCell({ row: 0, col: 0 }, "Hello");
    engine.setCell({ row: 1, col: 0 }, 42);
    engine.setCell({ row: 2, col: 0 }, "=A1", "=A1");
    
    const state = engine.toState();
    
    expect(state.version).toBe("1.0");
    expect(state.dimensions).toEqual({ rows: 10, cols: 10 });
    expect(state.cells).toHaveLength(3);
    expect(state.dependencies).toBeDefined();
  });

  test("toState() with metadata option", () => {
    const engine = new SpreadsheetEngine(5, 5);
    engine.setCell({ row: 0, col: 0 }, "Test");
    
    const state = engine.toState({ includeMetadata: true });
    
    expect(state.metadata).toBeDefined();
    expect(state.metadata?.createdAt).toBeDefined();
    expect(state.metadata?.modifiedAt).toBeDefined();
  });

  test("fromState() restores cell data correctly", () => {
    const engine = new SpreadsheetEngine(10, 10);
    
    // Create initial state
    engine.setCell({ row: 0, col: 0 }, "Hello");
    engine.setCell({ row: 1, col: 0 }, 42);
    engine.setCell({ row: 2, col: 0 }, "=A1", "=A1");
    engine.setCell({ row: 0, col: 1 }, "World");
    
    const state = engine.toState();
    
    // Create new engine from state
    const newEngine = SpreadsheetEngine.fromState(state);
    
    // Verify data
    expect(newEngine.getCell({ row: 0, col: 0 })?.rawValue).toBe("Hello");
    expect(newEngine.getCell({ row: 1, col: 0 })?.rawValue).toBe(42);
    expect(newEngine.getCell({ row: 2, col: 0 })?.formula).toBe("=A1");
    expect(newEngine.getCell({ row: 2, col: 0 })?.computedValue).toBe("Hello");
    expect(newEngine.getCell({ row: 0, col: 1 })?.rawValue).toBe("World");
  });

  test("fromState() preserves formulas and dependencies", () => {
    const engine = new SpreadsheetEngine(10, 10);
    
    // Create a chain of formulas
    engine.setCell({ row: 0, col: 0 }, 10);
    engine.setCell({ row: 1, col: 0 }, "=A1*2", "=A1*2");
    engine.setCell({ row: 2, col: 0 }, "=A2+5", "=A2+5");
    
    const state = engine.toState();
    const newEngine = SpreadsheetEngine.fromState(state);
    
    // Verify formulas work
    expect(newEngine.getCell({ row: 1, col: 0 })?.computedValue).toBe(20);
    expect(newEngine.getCell({ row: 2, col: 0 })?.computedValue).toBe(25);
    
    // Test that changing A1 updates dependencies
    newEngine.setCell({ row: 0, col: 0 }, 5);
    expect(newEngine.getCell({ row: 1, col: 0 })?.computedValue).toBe(10);
    expect(newEngine.getCell({ row: 2, col: 0 })?.computedValue).toBe(15);
  });

  test("fromState() handles empty spreadsheet", () => {
    const engine = new SpreadsheetEngine(5, 5);
    const state = engine.toState();
    const newEngine = SpreadsheetEngine.fromState(state);
    
    expect(newEngine.getAllCells().size).toBe(0);
    expect(newEngine.getCellCount()).toBe(0);
  });

  test("state round-trip preserves all data", () => {
    const engine = new SpreadsheetEngine(10, 10);
    
    // Add various types of data
    engine.setCell({ row: 0, col: 0 }, "String value");
    engine.setCell({ row: 1, col: 0 }, 123.45);
    engine.setCell({ row: 2, col: 0 }, true);
    engine.setCell({ row: 3, col: 0 }, "=A1", "=A1");
    engine.setCell({ row: 4, col: 0 }, "=SUM(A2:A3)", "=SUM(A2:A3)");
    
    // Export and re-import
    const state = engine.toState();
    const json = JSON.stringify(state);
    const parsedState = JSON.parse(json) as SpreadsheetState;
    const newEngine = SpreadsheetEngine.fromState(parsedState);
    
    // Verify all data matches
    expect(newEngine.getCell({ row: 0, col: 0 })?.rawValue).toBe("String value");
    expect(newEngine.getCell({ row: 1, col: 0 })?.rawValue).toBe(123.45);
    expect(newEngine.getCell({ row: 2, col: 0 })?.rawValue).toBe(true);
    expect(newEngine.getCell({ row: 3, col: 0 })?.computedValue).toBe("String value");
    expect(newEngine.getCell({ row: 4, col: 0 })?.computedValue).toBe(124.45);
  });

  test("view state can be included in state", () => {
    const engine = new SpreadsheetEngine(10, 10);
    engine.setCell({ row: 0, col: 0 }, "Test");
    
    const state = engine.toState();
    
    // Add view state manually (would normally come from UI)
    state.view = {
      columnWidths: { 0: 150, 1: 200 },
      rowHeights: { 0: 30, 1: 40 }
    };
    
    // Verify it can be serialized and deserialized
    const json = JSON.stringify(state);
    const parsedState = JSON.parse(json) as SpreadsheetState;
    
    expect(parsedState.view?.columnWidths).toEqual({ 0: 150, 1: 200 });
    expect(parsedState.view?.rowHeights).toEqual({ 0: 30, 1: 40 });
  });
});