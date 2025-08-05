import { beforeEach, describe, expect, test } from "bun:test";
import type { StructuralAnalysis } from "@gridcore/core";
import { StructuralOperationManager } from "./StructuralOperationManager";
import type { StructuralOperation, StructuralUIEvent, StructuralWarning } from "./types";

describe("StructuralOperationManager", () => {
  let manager: StructuralOperationManager;
  let events: StructuralUIEvent[];

  beforeEach(() => {
    manager = new StructuralOperationManager();
    events = [];
    
    manager.subscribe((event) => {
      events.push(event);
    });
  });

  const createOperation = (type: "insertRow" | "deleteRow", count = 1): StructuralOperation => ({
    type,
    index: 5,
    count,
    timestamp: Date.now(),
    id: `test-${type}-${Date.now()}`
  });

  const createAnalysis = (warnings: StructuralWarning[] = []): StructuralAnalysis => ({
    warnings,
    affectedCells: [{ row: 5, col: 0 }, { row: 5, col: 1 }],
    formulaUpdates: new Map()
  });

  describe("operation lifecycle", () => {
    test("should emit started event for simple operation", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);

      // Find the started event among all events
      const startedEvent = events.find(e => e.type === "structuralOperationStarted");
      expect(startedEvent).toBeDefined();
      expect(startedEvent).toEqual({
        type: "structuralOperationStarted",
        operation,
        estimatedDuration: expect.any(Number)
      });
    });

    test("should complete operation successfully", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);
      const affectedCells = [{ row: 6, col: 0 }];
      const formulaUpdates = new Map();
      
      manager.completeOperation(affectedCells, formulaUpdates);

      // Find the completed event
      const completedEvent = events.find(e => e.type === "structuralOperationCompleted");
      expect(completedEvent).toBeDefined();
      expect(completedEvent).toEqual({
        type: "structuralOperationCompleted",
        operation,
        affectedCells,
        formulaUpdates,
        duration: expect.any(Number)
      });
    });

    test("should fail operation with error", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);
      manager.failOperation("Test error");

      // Find the failed event
      const failedEvent = events.find(e => e.type === "structuralOperationFailed");
      expect(failedEvent).toBeDefined();
      expect(failedEvent).toEqual({
        type: "structuralOperationFailed",
        operation,
        error: "Test error"
      });
    });

    test("should cancel operation", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);
      manager.cancelOperation();

      // Find the cancelled event
      const cancelledEvent = events.find(e => e.type === "structuralOperationCancelled");
      expect(cancelledEvent).toBeDefined();
      expect(cancelledEvent).toEqual({
        type: "structuralOperationCancelled",
        operation
      });
    });
  });

  describe("confirmation flow", () => {
    test("should require confirmation for large deletion", async () => {
      const operation = createOperation("deleteRow", 10); // Above default threshold
      const analysis = createAnalysis();

      const confirmationPromise = manager.startOperation(operation, analysis);

      // Should emit confirmation required event
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("structuralOperationConfirmationRequired");
      
      const confirmationEvent = events[0] as any;
      expect(confirmationEvent.operation).toEqual(operation);
      expect(typeof confirmationEvent.onConfirm).toBe("function");
      expect(typeof confirmationEvent.onCancel).toBe("function");

      // Simulate confirmation
      confirmationEvent.onConfirm();
      const confirmed = await confirmationPromise;

      expect(confirmed).toBe(true);
      // Find the started event after confirmation
      const startedEvent = events.find(e => e.type === "structuralOperationStarted");
      expect(startedEvent).toBeDefined();
    });

    test("should handle cancellation from confirmation dialog", async () => {
      const operation = createOperation("deleteRow", 10);
      const analysis = createAnalysis();

      const confirmationPromise = manager.startOperation(operation, analysis);

      const confirmationEvent = events[0] as any;
      confirmationEvent.onCancel();
      const confirmed = await confirmationPromise;

      expect(confirmed).toBe(false);
      // Find the cancelled event
      const cancelledEvent = events.find(e => e.type === "structuralOperationCancelled");
      expect(cancelledEvent).toBeDefined();
    });

    test("should require confirmation for formula-affecting operations", async () => {
      const operation = createOperation("deleteRow", 1); // Small deletion
      const warnings: StructuralWarning[] = [{
        type: "formulaReference",
        message: "Formulas will be affected",
        affectedCells: [{ row: 10, col: 0 }],
        severity: "warning"
      }];
      const analysis = createAnalysis(warnings);

      manager.updateConfig({ confirmFormulaAffected: true });

      const confirmationPromise = manager.startOperation(operation, analysis);

      expect(events[0].type).toBe("structuralOperationConfirmationRequired");
      
      // Cancel the confirmation to complete the test
      const confirmationEvent = events[0] as any;
      confirmationEvent.onCancel();
      
      const result = await confirmationPromise;
      expect(result).toBe(false);
    });
  });

  describe("progress tracking", () => {
    test("should show progress for large operations", async () => {
      const operation = createOperation("insertRow", 200); // Above progress threshold
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);

      const startedEvent = events.find(e => e.type === "structuralOperationStarted");
      expect(startedEvent).toBeDefined();
      expect(startedEvent!.estimatedDuration).toBeGreaterThan(1000);

      // Simulate progress updates
      manager.updateProgress(50, [{ row: 5, col: 0 }]);

      // Find progress and highlight events
      const progressEvent = events.find(e => e.type === "structuralOperationProgress");
      const highlightEvent = events.find(e => e.type === "highlightCells");
      
      expect(progressEvent).toBeDefined();
      expect((progressEvent as any).progress).toBe(50);
      expect(highlightEvent).toBeDefined();
    });

    test("should not show progress for small operations", async () => {
      const operation = createOperation("insertRow", 5); // Below progress threshold
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);

      expect(events[0].type).toBe("structuralOperationStarted");
      expect(manager.getState().showProgress).toBe(false);
    });
  });

  describe("cell highlighting", () => {
    test("should highlight affected cells", () => {
      const cells = [{ row: 1, col: 1 }, { row: 2, col: 2 }];
      
      manager.highlightCells(cells, "affected", 1000);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "highlightCells",
        cells,
        highlightType: "affected",
        duration: 1000
      });

      const state = manager.getState();
      expect(state.highlights).toHaveLength(2);
      expect(state.highlights[0]).toEqual({
        address: { row: 1, col: 1 },
        type: "affected"
      });
    });

    test("should clear highlights", () => {
      const cells = [{ row: 1, col: 1 }];
      
      manager.highlightCells(cells, "affected");
      manager.clearHighlights();

      expect(events).toHaveLength(2);
      expect(events[1].type).toBe("clearHighlights");
      expect(manager.getState().highlights).toHaveLength(0);
    });

    test("should clear highlights by type", () => {
      const cells1 = [{ row: 1, col: 1 }];
      const cells2 = [{ row: 2, col: 2 }];
      
      manager.highlightCells(cells1, "affected");
      manager.highlightCells(cells2, "warning");
      
      expect(manager.getState().highlights).toHaveLength(2);
      
      manager.clearHighlights("affected");
      
      const remainingHighlights = manager.getState().highlights;
      expect(remainingHighlights).toHaveLength(1);
      expect(remainingHighlights[0].type).toBe("warning");
    });
  });

  describe("warning handling", () => {
    test("should emit warnings during operation", async () => {
      // Use a warning type that doesn't trigger confirmation
      const warnings: StructuralWarning[] = [{
        type: "performanceImpact",
        message: "Operation may be slow",
        affectedCells: [{ row: 5, col: 0 }],
        severity: "warning"
      }];
      
      const operation = createOperation("insertRow"); // Use insert to avoid deletion confirmation
      const analysis = createAnalysis(warnings);

      await manager.startOperation(operation, analysis);
      manager.completeOperation([], new Map());

      // Find warning event
      const warningEvent = events.find(e => e.type === "structuralOperationWarning");
      expect(warningEvent).toBeDefined();
      expect((warningEvent as any).warnings).toHaveLength(1);
      expect((warningEvent as any).warnings[0].type).toBe("performanceImpact");
    });

    test("should auto-hide warnings when configured", async () => {
      const warnings: StructuralWarning[] = [{
        type: "performanceImpact",
        message: "Operation may be slow",
        affectedCells: [{ row: 5, col: 0 }],
        severity: "warning"
      }];

      manager.updateConfig({ autoHideWarnings: true, warningTimeout: 50 });
      
      const operation = createOperation("insertRow");
      const analysis = createAnalysis(warnings);

      await manager.startOperation(operation, analysis);
      manager.completeOperation([], new Map());

      // Warnings should be present initially
      expect(manager.getState().warnings).toHaveLength(1);

      // Wait for the timeout to pass
      await new Promise(resolve => setTimeout(resolve, 100));

      // Warnings should be cleared
      expect(manager.getState().warnings).toHaveLength(0);
    });
  });

  describe("configuration", () => {
    test("should update configuration", () => {
      const newConfig = {
        confirmDeletionAbove: 10,
        showProgressAbove: 50
      };

      manager.updateConfig(newConfig);

      // Test updated thresholds
      const smallDeleteOperation = createOperation("deleteRow", 8);
      const largeDeleteOperation = createOperation("deleteRow", 12);

      // Small deletion should not require confirmation
      expect(manager['needsConfirmation'](smallDeleteOperation, createAnalysis())).toBe(false);
      
      // Large deletion should require confirmation
      expect(manager['needsConfirmation'](largeDeleteOperation, createAnalysis())).toBe(true);
    });

    test("should use default configuration", () => {
      const state = manager.getState();
      expect(state.isActive).toBe(false);
      expect(state.highlights).toHaveLength(0);
      expect(state.warnings).toHaveLength(0);
    });
  });

  describe("state management", () => {
    test("should track operation state", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      // Initial state
      expect(manager.getState().isActive).toBe(false);

      // Start operation
      await manager.startOperation(operation, analysis);
      expect(manager.getState().isActive).toBe(true);
      expect(manager.getState().operation).toEqual(operation);

      // Complete operation
      manager.completeOperation([], new Map());
      expect(manager.getState().isActive).toBe(false);
      expect(manager.getState().operation).toBeUndefined();
    });

    test("should reset state on failure", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);
      expect(manager.getState().isActive).toBe(true);

      manager.failOperation("Test error");
      expect(manager.getState().isActive).toBe(false);
    });

    test("should reset state on cancellation", async () => {
      const operation = createOperation("insertRow");
      const analysis = createAnalysis();

      await manager.startOperation(operation, analysis);
      expect(manager.getState().isActive).toBe(true);

      manager.cancelOperation();
      expect(manager.getState().isActive).toBe(false);
    });
  });
});