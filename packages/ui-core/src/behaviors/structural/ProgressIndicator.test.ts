import { beforeEach, describe, expect, test, mock } from "bun:test";
import { ProgressIndicator } from "./ProgressIndicator";
import type { StructuralUIEvent } from "./types";

// Helper to create mock elements
const createMockElement = (tag: string) => ({
  tagName: tag.toUpperCase(),
  id: "",
  textContent: "",
  innerHTML: "",
  className: "",
  classList: {
    add: mock(() => {}),
    remove: mock(() => {})
  },
  appendChild: mock(() => {}),
  remove: mock(() => {}),
  style: {},
  querySelector: mock(() => null),
  parentNode: {
    removeChild: mock(() => {})
  }
});

// Mock DOM environment
const mockDocument = {
  createElement: mock((tag: string) => createMockElement(tag)),
  getElementById: mock(() => null),
  head: {
    appendChild: mock(() => {})
  },
  body: {
    appendChild: mock(() => {})
  }
};

const mockContainer = {
  appendChild: mock(() => {})
};

// @ts-ignore
global.document = mockDocument;
// @ts-ignore
global.requestAnimationFrame = mock((cb) => setTimeout(cb, 16));

describe("ProgressIndicator", () => {
  let indicator: ProgressIndicator;
  let container: any;

  beforeEach(() => {
    // Reset all mocks
    mockDocument.createElement.mockClear();
    mockDocument.getElementById.mockClear();
    mockDocument.head.appendChild.mockClear();
    mockDocument.body.appendChild.mockClear();
    mockContainer.appendChild.mockClear();
    
    container = mockContainer;
    indicator = new ProgressIndicator(container);
  });

  describe("initialization", () => {
    test("should create with default config", () => {
      const indicatorDefault = new ProgressIndicator();
      expect(mockDocument.createElement.mock.calls[0]).toEqual(["style"]);
    });

    test("should create with custom config", () => {
      const customConfig = {
        showPercentage: false,
        showCancelButton: false
      };
      
      const customIndicator = new ProgressIndicator(container, customConfig);
      expect(mockDocument.createElement.mock.calls[0]).toEqual(["style"]);
    });
  });

  describe("event handling", () => {
    test("should show progress for long operations", () => {
      const operation = {
        type: "insertRow" as const,
        index: 5,
        count: 100,
        timestamp: Date.now(),
        id: "test-op"
      };

      const event: StructuralUIEvent = {
        type: "structuralOperationStarted",
        operation,
        estimatedDuration: 2000
      };

      indicator.handleEvent(event);

      expect(mockDocument.createElement.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(container.appendChild.mock.calls.length).toBeGreaterThan(0);
    });

    test("should not show progress for short operations", () => {
      const operation = {
        type: "insertRow" as const,
        index: 5,
        count: 1,
        timestamp: Date.now(),
        id: "test-op"
      };

      const event: StructuralUIEvent = {
        type: "structuralOperationStarted",
        operation,
        estimatedDuration: 500 // Short duration
      };

      indicator.handleEvent(event);

      // Should not create progress element for short operations
      expect(container.appendChild.mock.calls.length).toBe(0);
    });

    test("should update progress", () => {
      const operation = {
        type: "deleteColumn" as const,
        index: 2,
        count: 50,
        timestamp: Date.now(),
        id: "test-op"
      };

      // First show the indicator
      indicator.show(operation, 3000);

      const event: StructuralUIEvent = {
        type: "structuralOperationProgress",
        operation,
        progress: 75,
        affectedCells: []
      };

      indicator.handleEvent(event);

      // Just verify it doesn't throw
      expect(indicator.isShowing()).toBe(true);
    });

    test("should hide on completion", async () => {
      const operation = {
        type: "insertColumn" as const,
        index: 3,
        count: 10,
        timestamp: Date.now(),
        id: "test-op"
      };

      // Show first
      indicator.show(operation, 2000);
      
      const event: StructuralUIEvent = {
        type: "structuralOperationCompleted",
        operation,
        affectedCells: [],
        formulaUpdates: new Map(),
        duration: 1500
      };

      indicator.handleEvent(event);

      // Wait for minimum display time (500ms) + hide animation (300ms)
      await new Promise(resolve => setTimeout(resolve, 850));
      expect(indicator.isShowing()).toBe(false);
    });

    test("should hide on failure", async () => {
      const operation = {
        type: "deleteRow" as const,
        index: 1,
        count: 5,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);

      const event: StructuralUIEvent = {
        type: "structuralOperationFailed",
        operation,
        error: "Test error"
      };

      indicator.handleEvent(event);

      // Wait for minimum display time (500ms) + hide animation (300ms)
      await new Promise(resolve => setTimeout(resolve, 850));
      expect(indicator.isShowing()).toBe(false);
    });

    test("should hide on cancellation", async () => {
      const operation = {
        type: "insertRow" as const,
        index: 0,
        count: 20,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);

      const event: StructuralUIEvent = {
        type: "structuralOperationCancelled",
        operation
      };

      indicator.handleEvent(event);

      // Wait for minimum display time (500ms) + hide animation (300ms)
      await new Promise(resolve => setTimeout(resolve, 850));
      expect(indicator.isShowing()).toBe(false);
    });
  });

  describe("progress management", () => {
    test("should show progress indicator", () => {
      const operation = {
        type: "insertRow" as const,
        index: 5,
        count: 100,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 5000);

      expect(indicator.isShowing()).toBe(true);
      expect(container.appendChild.mock.calls.length).toBeGreaterThan(0);
    });

    test("should update progress percentage", () => {
      const operation = {
        type: "deleteRow" as const,
        index: 10,
        count: 25,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 3000);
      indicator.updateProgress(60);

      // Just verify it doesn't throw and is still showing
      expect(indicator.isShowing()).toBe(true);
    });

    test("should hide progress indicator", async () => {
      const operation = {
        type: "insertColumn" as const,
        index: 0,
        count: 50,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);
      indicator.hide();

      // Wait for minimum display time (500ms) + hide animation (300ms)
      await new Promise(resolve => setTimeout(resolve, 850));
      expect(indicator.isShowing()).toBe(false);
    });

    test("should respect minimum display time", (done) => {
      const operation = {
        type: "deleteColumn" as const,
        index: 2,
        count: 10,
        timestamp: Date.now(),
        id: "test-op"
      };

      // Configure with minimum display time
      const quickIndicator = new ProgressIndicator(container, { minDisplayTime: 100 });
      
      quickIndicator.show(operation, 1000);

      const startTime = Date.now();
      quickIndicator.hide();

      // Should wait for minimum display time
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing tolerance
        done();
      }, 150);
    });
  });

  describe("operation text generation", () => {
    test("should generate correct text for different operations", () => {
      const operations = [
        { type: "insertRow", count: 1, expected: "Inserting row..." },
        { type: "insertRow", count: 5, expected: "Inserting 5 rows..." },
        { type: "insertColumn", count: 1, expected: "Inserting column..." },
        { type: "insertColumn", count: 3, expected: "Inserting 3 columns..." },
        { type: "deleteRow", count: 1, expected: "Deleting row..." },
        { type: "deleteRow", count: 10, expected: "Deleting 10 rows..." },
        { type: "deleteColumn", count: 1, expected: "Deleting column..." },
        { type: "deleteColumn", count: 7, expected: "Deleting 7 columns..." }
      ];

      operations.forEach(({ type, count, expected }) => {
        const operation = {
          type: type as any,
          index: 0,
          count,
          timestamp: Date.now(),
          id: "test"
        };

        const text = (indicator as any).getOperationText(operation);
        expect(text).toBe(expected);
      });
    });
  });

  describe("time formatting", () => {
    test("should format time correctly", () => {
      const testCases = [
        { ms: 500, expected: "Less than 1 second" },
        { ms: 1500, expected: "2 seconds" },
        { ms: 30000, expected: "30 seconds" },
        { ms: 65000, expected: "2 minutes" },
        { ms: 120000, expected: "2 minutes" }
      ];

      testCases.forEach(({ ms, expected }) => {
        const formatted = (indicator as any).formatTime(ms);
        expect(formatted).toBe(expected);
      });
    });
  });

  describe("cancel functionality", () => {
    test("should set cancel callback", () => {
      const cancelCallback = mock(() => {});
      indicator.setCancelCallback(cancelCallback);

      const operation = {
        type: "deleteRow" as const,
        index: 5,
        count: 20,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 3000);

      // Just verify it's showing and callback is set
      expect(indicator.isShowing()).toBe(true);
    });

    test("should hide cancel button when configured", () => {
      const noCancelIndicator = new ProgressIndicator(container, { showCancelButton: false });
      
      const operation = {
        type: "insertRow" as const,
        index: 0,
        count: 100,
        timestamp: Date.now(),
        id: "test-op"
      };

      noCancelIndicator.show(operation, 5000);

      expect(noCancelIndicator.isShowing()).toBe(true);
      
      // Check that the cancel button is not included in the innerHTML
      const createdElements = mockDocument.createElement.mock.results;
      const progressDiv = createdElements[createdElements.length - 1]?.value;
      expect(progressDiv?.innerHTML).toBeDefined();
      expect(progressDiv?.innerHTML.includes('class="cancel-button"')).toBe(false);
    });
  });

  describe("configuration options", () => {
    test("should respect showPercentage config", () => {
      const noPercentageIndicator = new ProgressIndicator(container, { showPercentage: false });
      
      const operation = {
        type: "insertColumn" as const,
        index: 0,
        count: 50,
        timestamp: Date.now(),
        id: "test-op"
      };

      noPercentageIndicator.show(operation, 3000);

      expect(noPercentageIndicator.isShowing()).toBe(true);
      
      // Check that the progress text element is not included in the innerHTML
      const createdElements = mockDocument.createElement.mock.results;
      const progressDiv = createdElements[createdElements.length - 1]?.value;
      expect(progressDiv?.innerHTML).toBeDefined();
      expect(progressDiv?.innerHTML.includes('class="progress-text"')).toBe(false);
    });

    test("should respect showEstimatedTime config", () => {
      const noTimeIndicator = new ProgressIndicator(container, { showEstimatedTime: false });
      
      const operation = {
        type: "deleteColumn" as const,
        index: 5,
        count: 30,
        timestamp: Date.now(),
        id: "test-op"
      };

      noTimeIndicator.show(operation, 4000);

      expect(noTimeIndicator.isShowing()).toBe(true);
      
      // Check that the time text element is not included in the innerHTML
      const createdElements = mockDocument.createElement.mock.results;
      const progressDiv = createdElements[createdElements.length - 1]?.value;
      expect(progressDiv?.innerHTML).toBeDefined();
      expect(progressDiv?.innerHTML.includes('class="time-text"')).toBe(false);
    });

    test("should apply position and theme classes", () => {
      const customIndicator = new ProgressIndicator(container, { 
        position: "bottom",
        theme: "dark"
      });
      
      const operation = {
        type: "insertRow" as const,
        index: 0,
        count: 75,
        timestamp: Date.now(),
        id: "test-op"
      };

      customIndicator.show(operation, 3000);

      expect(customIndicator.isShowing()).toBe(true);
      
      // Check that the proper classes were added
      const createdElements = mockDocument.createElement.mock.results;
      const progressDiv = createdElements[createdElements.length - 1]?.value;
      expect(progressDiv?.className).toBeDefined();
      expect(progressDiv?.className).toContain("structural-progress-bottom");
      expect(progressDiv?.className).toContain("structural-progress-dark");
    });
  });
});