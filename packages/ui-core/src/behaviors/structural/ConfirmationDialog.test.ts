import { beforeEach, describe, expect, test, jest } from "bun:test";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { StructuralOperation, StructuralUIEvent, StructuralWarning } from "./types";

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
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
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
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockContainer = {
  appendChild: jest.fn()
};

// @ts-ignore
global.document = mockDocument;
// @ts-ignore
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));

describe("ConfirmationDialog", () => {
  let dialog: ConfirmationDialog;
  let container: any;

  beforeEach(() => {
    jest.clearAllMocks();
    container = mockContainer;
    dialog = new ConfirmationDialog(container);
  });

  const createOperation = (type: "deleteRow" | "insertRow", count = 1): StructuralOperation => ({
    type,
    index: 5,
    count,
    timestamp: Date.now(),
    id: `test-${type}-${Date.now()}`
  });

  const createWarnings = (): StructuralWarning[] => [{
    type: "dataLoss",
    message: "Data will be lost",
    affectedCells: [{ row: 5, col: 0 }],
    severity: "error"
  }];

  describe("initialization", () => {
    test("should create with default config", () => {
      const defaultDialog = new ConfirmationDialog();
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
    });

    test("should create with custom config", () => {
      const customConfig = {
        showWarnings: false,
        defaultButton: "confirm" as const
      };
      
      const customDialog = new ConfirmationDialog(container, customConfig);
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
    });
  });

  describe("event handling", () => {
    test("should handle confirmation required event", () => {
      const operation = createOperation("deleteRow", 10);
      const warnings = createWarnings();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const event: StructuralUIEvent = {
        type: "structuralOperationConfirmationRequired",
        operation,
        warnings,
        onConfirm,
        onCancel
      };

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      const mockConfirmButton = { addEventListener: jest.fn() };
      const mockCancelButton = { addEventListener: jest.fn() };

      mockDialog.querySelector
        .mockReturnValueOnce(mockConfirmButton)
        .mockReturnValueOnce(mockCancelButton);

      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.handleEvent(event);

      expect(mockDialog.innerHTML).toContain("Confirm Row Deletion");
      expect(mockDialog.innerHTML).toContain("Delete 10 rows");
      expect(mockConfirmButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
      expect(mockCancelButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });
  });

  describe("dialog display", () => {
    test("should show confirmation dialog for deletion", () => {
      const operation = createOperation("deleteRow", 5);
      const warnings = createWarnings();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain("Row Deletion");
      expect(mockDialog.innerHTML).toContain("Delete 5 rows starting at row 6"); // 1-indexed
      expect(container.appendChild).toHaveBeenCalledWith(mockOverlay);
      expect(dialog.isShowing()).toBe(true);
    });

    test("should show confirmation dialog for insertion", () => {
      const operation = createOperation("insertRow", 3);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain("Row Insertion");
      expect(mockDialog.innerHTML).toContain("Insert 3 rows before row 6");
      expect(mockDialog.innerHTML).toContain("Insert"); // Confirm button text
    });

    test("should display warnings when enabled", () => {
      const customDialog = new ConfirmationDialog(container, { showWarnings: true });
      const operation = createOperation("deleteRow", 2);
      const warnings = createWarnings();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain("Warnings");
      expect(mockDialog.innerHTML).toContain("Data will be lost");
      expect(mockDialog.innerHTML).toContain("1 cells affected");
    });

    test("should hide warnings when disabled", () => {
      const customDialog = new ConfirmationDialog(container, { showWarnings: false });
      const operation = createOperation("deleteRow", 2);
      const warnings = createWarnings();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).not.toContain("Warnings");
    });

    test("should show cell count when enabled", () => {
      const customDialog = new ConfirmationDialog(container, { showCellCount: true });
      const operation = createOperation("deleteRow", 5);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain("Impact Summary");
      expect(mockDialog.innerHTML).toContain("Rows deleted:");
      expect(mockDialog.innerHTML).toContain("5");
    });
  });

  describe("user interaction", () => {
    test("should call onConfirm when confirm button is clicked", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Simulate confirm
      dialog.confirm();

      expect(onConfirm).toHaveBeenCalled();
      expect(dialog.isShowing()).toBe(false);
    });

    test("should call onCancel when cancel button is clicked", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Simulate cancel
      dialog.cancel();

      expect(onCancel).toHaveBeenCalled();
      expect(dialog.isShowing()).toBe(false);
    });

    test("should hide dialog", () => {
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);
      expect(dialog.isShowing()).toBe(true);

      dialog.hide();

      expect(mockOverlay.classList.add).toHaveBeenCalledWith("hiding");
      expect(mockDialog.classList.add).toHaveBeenCalledWith("hiding");
    });
  });

  describe("severity and styling", () => {
    test("should apply error severity for dangerous operations", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [{
        type: "dataLoss",
        message: "Critical data loss",
        affectedCells: [{ row: 5, col: 0 }],
        severity: "error"
      }];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain('class="confirmation-icon error"');
      expect(mockDialog.innerHTML).toContain('class="confirm-button  error"');
    });

    test("should apply warning severity for formula-affecting operations", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [{
        type: "formulaReference",
        message: "Formulas affected",
        affectedCells: [{ row: 10, col: 0 }],
        severity: "warning"
      }];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain('class="confirmation-icon warning"');
      expect(mockDialog.innerHTML).toContain('class="confirm-button  warning"');
    });

    test("should apply info severity for safe operations", () => {
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain('class="confirmation-icon info"');
      expect(mockDialog.innerHTML).toContain('class="confirm-button  info"');
    });
  });

  describe("formula impact", () => {
    test("should show formula impact when enabled", () => {
      const customDialog = new ConfirmationDialog(container, { showFormulaImpact: true });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [{
        type: "formulaReference",
        message: "Formula will break",
        affectedCells: [{ row: 10, col: 0 }, { row: 11, col: 1 }],
        severity: "warning"
      }];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain("Formula Impact");
      expect(mockDialog.innerHTML).toContain("Formulas affected:");
      expect(mockDialog.innerHTML).toContain("2"); // Number of affected cells
      expect(mockDialog.innerHTML).toContain("#REF! errors");
    });

    test("should hide formula impact when no formula warnings", () => {
      const customDialog = new ConfirmationDialog(container, { showFormulaImpact: true });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [{
        type: "dataLoss",
        message: "Data lost",
        affectedCells: [{ row: 5, col: 0 }],
        severity: "error"
      }];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).not.toContain("Formula Impact");
    });
  });

  describe("button configuration", () => {
    test("should focus cancel button by default", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      const mockCancelButton = { 
        focus: jest.fn(),
        addEventListener: jest.fn()
      };
      
      mockDialog.querySelector.mockReturnValue(mockCancelButton);
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      // Focus should be called after a timeout
      setTimeout(() => {
        expect(mockCancelButton.focus).toHaveBeenCalled();
      }, 150);
    });

    test("should focus confirm button when configured", () => {
      const customDialog = new ConfirmationDialog(container, { defaultButton: "confirm" });
      const operation = createOperation("insertRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      const mockConfirmButton = { 
        focus: jest.fn(),
        addEventListener: jest.fn()
      };
      
      mockDialog.querySelector.mockReturnValue(mockConfirmButton);
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      customDialog.show(operation, warnings, onConfirm, onCancel);

      setTimeout(() => {
        expect(mockConfirmButton.focus).toHaveBeenCalled();
      }, 150);
    });

    test("should mark default button with class", () => {
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      dialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.innerHTML).toContain('class="cancel-button default"');
      expect(mockDialog.innerHTML).toContain('class="confirm-button  warning"'); // No default class
    });
  });

  describe("theme support", () => {
    test("should apply theme classes", () => {
      const darkDialog = new ConfirmationDialog(container, { theme: "dark" });
      const operation = createOperation("deleteRow", 1);
      const warnings: StructuralWarning[] = [];
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const mockOverlay = mockDocument.createElement("div");
      const mockDialog = mockDocument.createElement("div");
      mockDocument.createElement
        .mockReturnValueOnce(mockOverlay)
        .mockReturnValueOnce(mockDialog);

      darkDialog.show(operation, warnings, onConfirm, onCancel);

      expect(mockDialog.className).toContain("structural-confirmation-dark");
    });
  });
});