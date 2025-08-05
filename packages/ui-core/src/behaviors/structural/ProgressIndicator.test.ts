import { beforeEach, describe, expect, test, jest } from "bun:test";
import { ProgressIndicator } from "./ProgressIndicator";
import type { StructuralUIEvent } from "./types";

// Mock DOM environment
const mockDocument = {
  createElement: jest.fn((tag: string) => ({
    id: "",
    textContent: "",
    innerHTML: "",
    className: "",
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    appendChild: jest.fn(),
    remove: jest.fn(),
    style: {},
    querySelector: jest.fn(),
    parentNode: {
      removeChild: jest.fn()
    }
  })),
  getElementById: jest.fn(),
  head: {
    appendChild: jest.fn()
  },
  body: {
    appendChild: jest.fn()
  }
};

const mockContainer = {
  appendChild: jest.fn()
};

// @ts-ignore
global.document = mockDocument;
// @ts-ignore
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));

describe("ProgressIndicator", () => {
  let indicator: ProgressIndicator;
  let container: any;

  beforeEach(() => {
    jest.clearAllMocks();
    container = mockContainer;
    indicator = new ProgressIndicator(container);
  });

  describe("initialization", () => {
    test("should create with default config", () => {
      const indicatorDefault = new ProgressIndicator();
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
    });

    test("should create with custom config", () => {
      const customConfig = {
        showPercentage: false,
        showCancelButton: false
      };
      
      const customIndicator = new ProgressIndicator(container, customConfig);
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      indicator.handleEvent(event);

      expect(mockDocument.createElement).toHaveBeenCalledWith("div");
      expect(mockElement.innerHTML).toContain("Inserting 100 rows...");
      expect(container.appendChild).toHaveBeenCalledWith(mockElement);
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
      expect(container.appendChild).not.toHaveBeenCalled();
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

      const mockProgressBar = { style: { width: "" } };
      const mockProgressText = { textContent: "" };
      const mockTimeText = { textContent: "" };
      const mockElement = {
        ...mockDocument.createElement("div"),
        querySelector: jest.fn()
          .mockReturnValueOnce(mockProgressBar)
          .mockReturnValueOnce(mockProgressText)
          .mockReturnValueOnce(mockTimeText)
      };

      (indicator as any).progressElement = mockElement;

      const event: StructuralUIEvent = {
        type: "structuralOperationProgress",
        operation,
        progress: 75,
        affectedCells: []
      };

      indicator.handleEvent(event);

      expect(mockProgressBar.style.width).toBe("75%");
      expect(mockProgressText.textContent).toBe("75%");
      expect(mockTimeText.textContent).toContain("second");
    });

    test("should hide on completion", () => {
      const operation = {
        type: "insertColumn" as const,
        index: 3,
        count: 10,
        timestamp: Date.now(),
        id: "test-op"
      };

      // Show first
      indicator.show(operation, 2000);
      const mockElement = mockDocument.createElement("div");
      (indicator as any).progressElement = mockElement;

      const event: StructuralUIEvent = {
        type: "structuralOperationCompleted",
        operation,
        affectedCells: [],
        formulaUpdates: new Map(),
        duration: 1500
      };

      indicator.handleEvent(event);

      expect(mockElement.classList.add).toHaveBeenCalledWith("hiding");
    });

    test("should hide on failure", () => {
      const operation = {
        type: "deleteRow" as const,
        index: 1,
        count: 5,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);
      const mockElement = mockDocument.createElement("div");
      (indicator as any).progressElement = mockElement;

      const event: StructuralUIEvent = {
        type: "structuralOperationFailed",
        operation,
        error: "Test error"
      };

      indicator.handleEvent(event);

      expect(mockElement.classList.add).toHaveBeenCalledWith("hiding");
    });

    test("should hide on cancellation", () => {
      const operation = {
        type: "insertRow" as const,
        index: 0,
        count: 20,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);
      const mockElement = mockDocument.createElement("div");
      (indicator as any).progressElement = mockElement;

      const event: StructuralUIEvent = {
        type: "structuralOperationCancelled",
        operation
      };

      indicator.handleEvent(event);

      expect(mockElement.classList.add).toHaveBeenCalledWith("hiding");
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      indicator.show(operation, 5000);

      expect(mockElement.className).toContain("structural-progress-indicator");
      expect(mockElement.innerHTML).toContain("Inserting 100 rows...");
      expect(container.appendChild).toHaveBeenCalledWith(mockElement);
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

      const mockProgressBar = { style: { width: "" } };
      const mockProgressText = { textContent: "" };
      const mockElement = {
        ...mockDocument.createElement("div"),
        querySelector: jest.fn()
          .mockReturnValueOnce(mockProgressBar)
          .mockReturnValueOnce(mockProgressText)
          .mockReturnValueOnce(null) // timeText not found
      };

      (indicator as any).progressElement = mockElement;

      indicator.updateProgress(60);

      expect(mockProgressBar.style.width).toBe("60%");
      expect(mockProgressText.textContent).toBe("60%");
    });

    test("should hide progress indicator", () => {
      const operation = {
        type: "insertColumn" as const,
        index: 0,
        count: 50,
        timestamp: Date.now(),
        id: "test-op"
      };

      indicator.show(operation, 2000);
      const mockElement = mockDocument.createElement("div");
      (indicator as any).progressElement = mockElement;

      indicator.hide();

      expect(mockElement.classList.add).toHaveBeenCalledWith("hiding");
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
      const mockElement = mockDocument.createElement("div");
      (quickIndicator as any).progressElement = mockElement;

      const startTime = Date.now();
      quickIndicator.hide();

      // Should wait for minimum display time
      setTimeout(() => {
        expect(mockElement.classList.add).toHaveBeenCalledWith("hiding");
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
      const cancelCallback = jest.fn();
      indicator.setCancelCallback(cancelCallback);

      const operation = {
        type: "deleteRow" as const,
        index: 5,
        count: 20,
        timestamp: Date.now(),
        id: "test-op"
      };

      const mockElement = mockDocument.createElement("div");
      const mockCancelButton = {
        addEventListener: jest.fn()
      };
      mockElement.querySelector.mockReturnValue(mockCancelButton);
      mockDocument.createElement.mockReturnValue(mockElement);

      indicator.show(operation, 3000);

      expect(mockCancelButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      noCancelIndicator.show(operation, 5000);

      expect(mockElement.innerHTML).not.toContain("Cancel");
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      noPercentageIndicator.show(operation, 3000);

      expect(mockElement.innerHTML).not.toContain('class="progress-text"');
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      noTimeIndicator.show(operation, 4000);

      expect(mockElement.innerHTML).not.toContain('class="time-text"');
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

      const mockElement = mockDocument.createElement("div");
      mockDocument.createElement.mockReturnValue(mockElement);

      customIndicator.show(operation, 3000);

      expect(mockElement.className).toContain("structural-progress-bottom");
      expect(mockElement.className).toContain("structural-progress-dark");
    });
  });
});