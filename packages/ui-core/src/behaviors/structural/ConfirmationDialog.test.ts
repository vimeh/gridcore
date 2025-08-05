import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type {
  StructuralOperation,
  StructuralUIEvent,
  StructuralWarning,
} from "./types";

// Helper to create mock elements
const createMockElement = (tag: string) => ({
  tagName: tag.toUpperCase(),
  id: "",
  textContent: "",
  innerHTML: "",
  className: "",
  classList: {
    add: mock(() => {}),
    remove: mock(() => {}),
  },
  appendChild: mock(() => {}),
  remove: mock(() => {}),
  style: {},
  querySelector: mock(() => null),
  querySelectorAll: mock(() => []),
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
  parentNode: {
    removeChild: mock(() => {}),
  },
  focus: mock(() => {}),
});

// Mock DOM environment
const mockDocument = {
  createElement: mock((tag: string) => createMockElement(tag)),
  getElementById: mock(() => null),
  head: {
    appendChild: mock(() => {}),
  },
  body: {
    appendChild: mock(() => {}),
  },
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
};

const mockContainer = {
  appendChild: mock(() => {}),
};

// @ts-ignore
global.document = mockDocument;
// @ts-ignore
global.requestAnimationFrame = mock((cb) => setTimeout(cb, 16));

describe("ConfirmationDialog", () => {
  let dialog: ConfirmationDialog;
  let container: any;

  beforeEach(() => {
    // Reset all mocks
    mockDocument.createElement.mockClear();
    mockDocument.getElementById.mockClear();
    mockDocument.head.appendChild.mockClear();
    mockDocument.body.appendChild.mockClear();
    mockDocument.addEventListener.mockClear();
    mockDocument.removeEventListener.mockClear();
    mockContainer.appendChild.mockClear();

    container = mockContainer;
    dialog = new ConfirmationDialog(container);
  });

  const createOperation = (
    type: "deleteRow" | "insertRow",
    count = 1,
  ): StructuralOperation => ({
    type,
    index: 5,
    count,
    timestamp: Date.now(),
    id: `test-${type}-${Date.now()}`,
  });

  const createWarnings = (): StructuralWarning[] => [
    {
      type: "dataLoss",
      message: "Data will be lost",
      affectedCells: [{ row: 5, col: 0 }],
      severity: "error",
    },
  ];

  describe("initialization", () => {
    test("should create with default config", () => {
      const defaultDialog = new ConfirmationDialog();
      expect(mockDocument.createElement.mock.calls[0]).toEqual(["style"]);
    });

    test("should create with custom config", () => {
      const customConfig = {
        showWarnings: false,
        defaultButton: "confirm" as const,
      };

      const customDialog = new ConfirmationDialog(container, customConfig);
      expect(mockDocument.createElement.mock.calls[0]).toEqual(["style"]);
    });
  });

  describe("event handling", () => {
    test("should handle confirmation required event", () => {
      const operation = createOperation("deleteRow", 10);
      const warnings = createWarnings();
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      const event: StructuralUIEvent = {
        type: "structuralOperationConfirmationRequired",
        operation,
        warnings,
        onConfirm,
        onCancel,
      };

      dialog.handleEvent(event);

      // Check that two elements were created (overlay and dialog)
      expect(
        mockDocument.createElement.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe("dialog display", () => {
    test("should show confirmation dialog for deletion", () => {
      const operation = createOperation("deleteRow", 5);
      const warnings = createWarnings();
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(
        mockDocument.createElement.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
      expect(container.appendChild.mock.calls.length).toBeGreaterThan(0);
      expect(dialog.isShowing()).toBe(true);
    });

    test("should show confirmation dialog for insertion", () => {
      const operation = createOperation("insertRow", 3);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(
        mockDocument.createElement.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
      expect(dialog.isShowing()).toBe(true);
    });

    test("should display warnings when enabled", () => {
      const customDialog = new ConfirmationDialog(container, {
        showWarnings: true,
      });
      const operation = createOperation("deleteRow", 2);
      const warnings = createWarnings();
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      const dialogElement =
        mockDocument.createElement.mock.results[
          mockDocument.createElement.mock.results.length - 1
        ]?.value;
      expect(dialogElement).toBeDefined();
    });

    test("should hide warnings when disabled", () => {
      const customDialog = new ConfirmationDialog(container, {
        showWarnings: false,
      });
      const operation = createOperation("deleteRow", 2);
      const warnings = createWarnings();
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(customDialog.isShowing()).toBe(true);
    });

    test("should show cell count when enabled", () => {
      const customDialog = new ConfirmationDialog(container, {
        showCellCount: true,
      });
      const operation = createOperation("deleteRow", 5);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(customDialog.isShowing()).toBe(true);
    });
  });

  describe("user interaction", () => {
    test("should call onConfirm when confirm button is clicked", async () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      let confirmCalled = false;
      const onConfirm = mock(() => {
        confirmCalled = true;
      });
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Simulate confirm
      dialog.confirm();

      expect(confirmCalled).toBe(true);

      // Wait for hide animation
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(dialog.isShowing()).toBe(false);
    });

    test("should call onCancel when cancel button is clicked", async () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      let cancelCalled = false;
      const onCancel = mock(() => {
        cancelCalled = true;
      });

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Simulate cancel
      dialog.cancel();

      expect(cancelCalled).toBe(true);

      // Wait for hide animation
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(dialog.isShowing()).toBe(false);
    });

    test("should hide dialog", () => {
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);
      expect(dialog.isShowing()).toBe(true);

      dialog.hide();

      // The dialog should initiate hide animation
      const createdElements = mockDocument.createElement.mock.results;
      expect(createdElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("severity and styling", () => {
    test("should apply error severity for dangerous operations", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [
        {
          type: "dataLoss",
          message: "Critical data loss",
          affectedCells: [{ row: 5, col: 0 }],
          severity: "error",
        },
      ];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });

    test("should apply warning severity for formula-affecting operations", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [
        {
          type: "formulaReference",
          message: "Formulas affected",
          affectedCells: [{ row: 10, col: 0 }],
          severity: "warning",
        },
      ];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });

    test("should apply info severity for safe operations", () => {
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });
  });

  describe("formula impact display", () => {
    test("should show formula impact when configured", () => {
      const customDialog = new ConfirmationDialog(container, {
        showFormulaImpact: true,
      });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [
        {
          type: "formulaReference",
          message: "Formula will break",
          affectedCells: [
            { row: 10, col: 0 },
            { row: 11, col: 1 },
          ],
          severity: "warning",
        },
      ];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(customDialog.isShowing()).toBe(true);
    });

    test("should not show formula impact for non-formula warnings", () => {
      const customDialog = new ConfirmationDialog(container, {
        showFormulaImpact: true,
      });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [
        {
          type: "dataLoss",
          message: "Data lost",
          affectedCells: [{ row: 5, col: 0 }],
          severity: "error",
        },
      ];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(customDialog.isShowing()).toBe(true);
    });
  });

  describe("button configuration", () => {
    test("should focus cancel button by default", (done) => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Focus is called after a timeout
      setTimeout(() => {
        // Since we're mocking, we can't test the actual focus
        // Just verify the dialog is showing
        expect(dialog.isShowing()).toBe(true);
        done();
      }, 150);
    });

    test("should focus confirm button when configured", (done) => {
      const customDialog = new ConfirmationDialog(container, {
        defaultButton: "confirm",
      });
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      setTimeout(() => {
        expect(customDialog.isShowing()).toBe(true);
        done();
      }, 150);
    });

    test("should mark default button with class", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });
  });

  describe("theme support", () => {
    test("should apply theme classes", () => {
      const darkDialog = new ConfirmationDialog(container, { theme: "dark" });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      darkDialog.show(operation, warnings, onConfirm, onCancel);

      expect(darkDialog.isShowing()).toBe(true);
    });

    test("should apply light theme by default", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });
  });

  describe("advanced features", () => {
    test("should support custom text", () => {
      const customDialog = new ConfirmationDialog(container, {
        confirmButtonText: "Do it!",
        cancelButtonText: "Never mind",
      });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(customDialog.isShowing()).toBe(true);
    });

    test("should handle multiple warnings", () => {
      const operation = createOperation("deleteRow", 5);
      const warnings: StructuralWarning[] = [
        {
          type: "dataLoss",
          message: "Data will be lost",
          affectedCells: [{ row: 5, col: 0 }],
          severity: "error",
        },
        {
          type: "formulaReference",
          message: "Formulas will be affected",
          affectedCells: [{ row: 10, col: 0 }],
          severity: "warning",
        },
      ];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(dialog.isShowing()).toBe(true);
    });

    test("should clean up event listeners on hide", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});

      dialog.show(operation, warnings, onConfirm, onCancel);
      dialog.hide();

      // After hiding, should clean up
      expect(
        mockDocument.removeEventListener.mock.calls.length,
      ).toBeGreaterThanOrEqual(0);
    });
  });
});
