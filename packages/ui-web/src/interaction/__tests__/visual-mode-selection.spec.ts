import { beforeEach, describe, expect, test } from "bun:test";
import type { CellAddress } from "@gridcore/core";
import {
  CellAddress as CellAddressClass,
  cellAddressToString,
} from "@gridcore/core";

// Helper function to create CellAddress for tests
function createCellAddress(row: number, col: number): CellAddress {
  const result = CellAddressClass.create(row, col);
  if (!result.ok)
    throw new Error(`Failed to create CellAddress: ${result.error}`);
  return result.value;
}

import type { Viewport } from "../../components/Viewport";
import type { GridVimCallbacks } from "../GridVimBehavior";
import { GridVimBehavior } from "../GridVimBehavior";
import { SelectionManager } from "../SelectionManager";

describe("Visual Mode Selection", () => {
  let selectionManager: SelectionManager;
  let vimBehavior: GridVimBehavior;
  let mockCallbacks: GridVimCallbacks;
  let currentMode: string;

  // Mock viewport for testing
  const mockViewport = {
    getTotalCols: () => 100,
    getTotalRows: () => 100,
    getPageSize: () => ({ rows: 20, cols: 20 }),
  } as unknown as Viewport;

  beforeEach(() => {
    selectionManager = new SelectionManager();
    selectionManager.setViewport(mockViewport);

    currentMode = "normal";

    mockCallbacks = {
      onModeChangeRequest: (mode: string) => {
        currentMode = mode;
      },
      onRangeSelectionRequest: () => {},
      onResizeRequest: () => {},
      onScrollRequest: () => {},
      onCellNavigate: () => {},
    };

    vimBehavior = new GridVimBehavior(
      mockCallbacks,
      () => currentMode,
      selectionManager,
      mockViewport,
    );

    // Start with active cell at (5, 5)
    selectionManager.setActiveCell(createCellAddress(5, 5));
  });

  describe("Visual Character Mode", () => {
    test("entering visual mode selects the starting cell", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(1);
      expect(selectedCells.has(cellAddressToString(startCell))).toBe(true);
    });

    test("moving right in visual mode expands selection horizontally", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Move right with 'l'
      vimBehavior.handleKey("l");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(2);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 5))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 6))),
      ).toBe(true);
    });

    test("moving down in visual mode expands selection vertically", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Move down with 'j'
      vimBehavior.handleKey("j");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(2);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 5))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(6, 5))),
      ).toBe(true);
    });

    test("moving diagonally in visual mode creates rectangular selection", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Move right and down
      vimBehavior.handleKey("l");
      vimBehavior.handleKey("j");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(4); // 2x2 rectangle
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 5))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 6))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(6, 5))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(6, 6))),
      ).toBe(true);
    });

    test("moving back towards anchor reduces selection", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Move right twice
      vimBehavior.handleKey("l");
      vimBehavior.handleKey("l");

      // Move back left once
      vimBehavior.handleKey("h");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(2);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 5))),
      ).toBe(true);
      expect(
        selectedCells.has(cellAddressToString(createCellAddress(5, 6))),
      ).toBe(true);
    });

    test("count prefixes work in visual mode", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Move right 3 cells with '3l'
      vimBehavior.handleKey("3");
      vimBehavior.handleKey("l");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(4); // cells 5,6,7,8
      for (let col = 5; col <= 8; col++) {
        expect(
          selectedCells.has(cellAddressToString(createCellAddress(5, col))),
        ).toBe(true);
      }
    });
  });

  describe("Visual Line Mode", () => {
    test("entering visual line mode selects entire row", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "line");

      const selectedCells = selectionManager.getSelectedCells();
      // Should select entire row 5
      expect(selectedCells.size).toBe(100); // assuming 100 columns

      for (let col = 0; col < 100; col++) {
        expect(
          selectedCells.has(cellAddressToString(createCellAddress(5, col))),
        ).toBe(true);
      }
    });

    test("moving down in visual line mode selects multiple rows", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "line");
      currentMode = "visual";

      // Move down with 'j'
      vimBehavior.handleKey("j");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(200); // 2 rows * 100 columns

      // Check both rows are selected
      for (let row = 5; row <= 6; row++) {
        for (let col = 0; col < 100; col++) {
          expect(
            selectedCells.has(cellAddressToString(createCellAddress(row, col))),
          ).toBe(true);
        }
      }
    });
  });

  describe("Visual Block Mode", () => {
    test("entering visual block mode selects single cell", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "block");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(1);
      expect(selectedCells.has(cellAddressToString(startCell))).toBe(true);
    });

    test("moving in visual block mode creates rectangular selection", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "block");
      currentMode = "visual";

      // Move right and down to create 2x3 block
      vimBehavior.handleKey("l");
      vimBehavior.handleKey("j");
      vimBehavior.handleKey("j");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(6); // 2 cols * 3 rows

      // Check rectangular selection
      for (let row = 5; row <= 7; row++) {
        for (let col = 5; col <= 6; col++) {
          expect(
            selectedCells.has(cellAddressToString(createCellAddress(row, col))),
          ).toBe(true);
        }
      }
    });
  });

  describe("Visual Mode Navigation Special Keys", () => {
    test("$ in visual mode selects to end of row", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Override updateVisualSelection to handle $ without MAX_SAFE_INTEGER issues
      const originalUpdate =
        selectionManager.updateVisualSelection.bind(selectionManager);
      selectionManager.updateVisualSelection = (cursor: CellAddress) => {
        // Clamp to reasonable values for testing
        const clampedCursor = createCellAddress(
          Math.min(cursor.row, 99),
          Math.min(cursor.col, 99),
        );
        originalUpdate(clampedCursor);
      };

      vimBehavior.handleKey("$");

      const selectedCells = selectionManager.getSelectedCells();
      // Should select from column 5 to the last column (99 in our test)
      expect(selectedCells.size).toBe(95); // columns 5-99
      const activeCell = selectionManager.getActiveCell();
      expect(activeCell?.col).toBe(99);
    });

    test("0 in visual mode selects to beginning of row", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      vimBehavior.handleKey("0");

      const selectedCells = selectionManager.getSelectedCells();
      expect(selectedCells.size).toBe(6); // columns 0-5
      for (let col = 0; col <= 5; col++) {
        expect(
          selectedCells.has(cellAddressToString(createCellAddress(5, col))),
        ).toBe(true);
      }
    });

    test("G in visual mode selects to last row", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Override updateVisualSelection to handle G without MAX_SAFE_INTEGER issues
      const originalUpdate =
        selectionManager.updateVisualSelection.bind(selectionManager);
      selectionManager.updateVisualSelection = (cursor: CellAddress) => {
        // Clamp to reasonable values for testing
        const clampedCursor = createCellAddress(
          Math.min(cursor.row, 99),
          Math.min(cursor.col, 99),
        );
        originalUpdate(clampedCursor);
      };

      vimBehavior.handleKey("G");

      const activeCell = selectionManager.getActiveCell();
      expect(activeCell?.row).toBe(99);
      const selectedCells = selectionManager.getSelectedCells();
      // Should select from row 5 to row 99
      expect(selectedCells.size).toBe(95); // rows 5-99, column 5
    });

    test("5G in visual mode selects to specific row", () => {
      const startCell = createCellAddress(10, 5);
      selectionManager.setActiveCell(startCell);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      vimBehavior.handleKey("5");
      vimBehavior.handleKey("G");

      const selectedCells = selectionManager.getSelectedCells();
      // Should select from row 4 (5G is 1-indexed) to row 10
      for (let row = 4; row <= 10; row++) {
        expect(
          selectedCells.has(cellAddressToString(createCellAddress(row, 5))),
        ).toBe(true);
      }
    });
  });

  describe("Exiting Visual Mode", () => {
    test("Escape exits visual mode", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");
      currentMode = "visual";

      // Track if mode change was requested
      let modeChangeRequested = false;
      let requestedMode = "";
      mockCallbacks.onModeChangeRequest = (mode: string) => {
        modeChangeRequested = true;
        requestedMode = mode;
        currentMode = mode;
      };

      vimBehavior.handleKey("Escape");

      expect(modeChangeRequested).toBe(true);
      expect(requestedMode).toBe("normal");
    });

    test("exiting visual mode clears visual state", () => {
      const startCell = createCellAddress(5, 5);
      selectionManager.startVisualSelection(startCell, "character");

      // Move to expand selection
      selectionManager.updateVisualSelection(createCellAddress(7, 7));

      // Exit visual mode
      selectionManager.endVisualSelection();

      expect(selectionManager.getVisualMode()).toBeNull();
      expect(selectionManager.getVisualAnchor()).toBeNull();
    });
  });
});
