import { CellAddress, type ISpreadsheetFacade } from "@gridcore/core";
import { isEditingMode, isResizeMode, type UIState } from "@gridcore/ui-core";
import { type OptimizedBuffer, Renderable, type RGBA } from "../framework";
import type { TUIViewportManager } from "../viewport";

export class GridComponent extends Renderable {
  private rowHeaderWidth = 5;
  private colors = {
    gridLines: { r: 64, g: 64, b: 64, a: 255 },
    headerBg: { r: 32, g: 32, b: 32, a: 255 },
    headerFg: { r: 200, g: 200, b: 200, a: 255 },
    cellFg: { r: 255, g: 255, b: 255, a: 255 },
    cursorBg: { r: 0, g: 128, b: 255, a: 255 },
    cursorFg: { r: 255, g: 255, b: 255, a: 255 },
    selectedBg: { r: 0, g: 64, b: 128, a: 255 },
    selectedFg: { r: 255, g: 255, b: 255, a: 255 },
    editBg: { r: 255, g: 128, b: 0, a: 255 },
    resizeHighlight: { r: 255, g: 255, b: 0, a: 255 },
    resizeInfo: { r: 255, g: 255, b: 200, a: 255 },
  };

  constructor(
    private facade: ISpreadsheetFacade,
    private getState: () => UIState,
    private viewportManager: TUIViewportManager,
  ) {
    super("grid");
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState();
    const { viewport, cursor } = state;
    const pos = this.getAbsolutePosition();

    // Calculate visible columns and rows based on viewport manager
    const visibleCols = this.viewportManager.calculateVisibleColumns(
      viewport.startCol,
      this.width - this.rowHeaderWidth - 1,
    );
    const visibleRows = this.viewportManager.calculateVisibleRows(
      viewport.startRow,
      this.height - 2, // Account for header
    );

    // Render column headers
    this.renderColumnHeaders(buffer, pos, visibleCols, state);

    // Render row headers and cells
    let y = pos.y + 2; // Skip header row
    for (const row of visibleRows) {
      // Render row header
      this.renderRowHeader(buffer, pos.x, y, row, state);

      // Render cells
      let x = pos.x + this.rowHeaderWidth + 1;
      for (const col of visibleCols) {
        const cellAddrResult = CellAddress.create(row, col);
        if (!cellAddrResult.ok) continue;
        const cellAddr = cellAddrResult.value;

        // Determine cell colors based on cursor and selection
        let fg = this.colors.cellFg;
        let bg: RGBA | undefined;

        if (cursor.row === row && cursor.col === col) {
          bg = this.colors.cursorBg;
          fg = this.colors.cursorFg;
        }

        const colWidth = this.viewportManager.getColumnWidth(col);
        this.renderCell(buffer, x, y, cellAddr, colWidth, fg, bg);

        x += colWidth + 1;
      }
      y++;
    }

    // Render grid lines
    this.renderGridLines(buffer, pos, visibleCols, visibleRows);

    // Render mode-specific overlays
    if (isEditingMode(state)) {
      this.renderEditOverlay(buffer, pos, state, visibleCols, visibleRows);
    } else if (isResizeMode(state)) {
      this.renderResizeOverlay(buffer, pos, state, visibleCols, visibleRows);
    }
  }

  private renderColumnHeaders(
    buffer: OptimizedBuffer,
    pos: { x: number; y: number },
    visibleCols: number[],
    state: UIState,
  ): void {
    let x = pos.x + this.rowHeaderWidth + 1;

    for (const col of visibleCols) {
      const colName = this.getColumnName(col);
      const width = this.viewportManager.getColumnWidth(col);

      // Highlight if resizing this column
      const isResizing =
        isResizeMode(state) &&
        state.resizeTarget === "column" &&
        state.resizeIndex === col;

      const bg = isResizing
        ? this.colors.resizeHighlight
        : this.colors.headerBg;
      const fg = isResizing ? this.colors.headerBg : this.colors.headerFg;

      // Draw header background
      buffer.fillRect(x, pos.y, width, 1, " ", undefined, bg);

      // Center the column name
      const padding = Math.floor((width - colName.length) / 2);
      buffer.setText(x + padding, pos.y, colName.slice(0, width), fg, bg);

      // Show size if resizing
      if (isResizing) {
        const sizeInfo = `[${state.currentSize}]`;
        if (sizeInfo.length <= width) {
          buffer.setText(
            x + width - sizeInfo.length,
            pos.y + 1,
            sizeInfo,
            this.colors.resizeInfo,
            this.colors.headerBg,
          );
        }
      }

      x += width + 1;
    }
  }

  private renderRowHeader(
    buffer: OptimizedBuffer,
    x: number,
    y: number,
    row: number,
    state: UIState,
  ): void {
    const rowStr = (row + 1).toString();
    const padding = this.rowHeaderWidth - rowStr.length;

    // Highlight if resizing this row
    const isResizing =
      isResizeMode(state) &&
      state.resizeTarget === "row" &&
      state.resizeIndex === row;

    const bg = isResizing ? this.colors.resizeHighlight : this.colors.headerBg;
    const fg = isResizing ? this.colors.headerBg : this.colors.headerFg;

    // Draw header background
    buffer.fillRect(x, y, this.rowHeaderWidth, 1, " ", undefined, bg);

    // Right-align the row number
    buffer.setText(x + padding, y, rowStr, fg, bg);
  }

  private renderCell(
    buffer: OptimizedBuffer,
    x: number,
    y: number,
    addr: CellAddress,
    width: number,
    fg: RGBA,
    bg?: RGBA,
  ): void {
    // Clear cell area
    if (bg) {
      buffer.fillRect(x, y, width, 1, " ", fg, bg);
    }

    // Get cell value
    const cellResult = this.facade.getCell(addr);
    const value =
      cellResult.ok && cellResult.value ? cellResult.value.value : null;
    let displayValue = "";

    if (value !== null && value !== undefined) {
      displayValue = value.toString();
    }

    // Truncate or pad to fit width
    if (displayValue.length > width) {
      displayValue = `${displayValue.slice(0, width - 1)}…`;
    } else {
      displayValue = displayValue.padEnd(width, " ");
    }

    buffer.setText(x, y, displayValue, fg, bg);
  }

  private renderGridLines(
    buffer: OptimizedBuffer,
    pos: { x: number; y: number },
    visibleCols: number[],
    visibleRows: number[],
  ): void {
    // Vertical lines
    let x = pos.x + this.rowHeaderWidth;
    for (let i = 0; i <= visibleCols.length; i++) {
      for (let y = pos.y + 1; y < pos.y + visibleRows.length + 2; y++) {
        buffer.setChar(x, y, "│", this.colors.gridLines);
      }
      if (i < visibleCols.length) {
        x += this.viewportManager.getColumnWidth(visibleCols[i]) + 1;
      }
    }

    // Horizontal lines
    let totalWidth = this.rowHeaderWidth + visibleCols.length;
    for (const col of visibleCols) {
      totalWidth += this.viewportManager.getColumnWidth(col);
    }

    // Header separator
    for (let x = pos.x; x < pos.x + totalWidth; x++) {
      buffer.setChar(x, pos.y + 1, "─", this.colors.gridLines);
    }

    // Intersections
    x = pos.x + this.rowHeaderWidth;
    for (let i = 0; i <= visibleCols.length; i++) {
      buffer.setChar(x, pos.y + 1, "┼", this.colors.gridLines);
      if (i < visibleCols.length) {
        x += this.viewportManager.getColumnWidth(visibleCols[i]) + 1;
      }
    }
  }

  private renderEditOverlay(
    buffer: OptimizedBuffer,
    pos: { x: number; y: number },
    state: UIState,
    visibleCols: number[],
    visibleRows: number[],
  ): void {
    if (!isEditingMode(state)) return;

    const { cursor } = state;

    // Check if cursor is visible
    const colIndex = visibleCols.indexOf(cursor.col);
    const rowIndex = visibleRows.indexOf(cursor.row);

    if (colIndex === -1 || rowIndex === -1) return; // Cell not visible

    // Calculate cell position
    let x = pos.x + this.rowHeaderWidth + 1;
    for (let i = 0; i < colIndex; i++) {
      x += this.viewportManager.getColumnWidth(visibleCols[i]) + 1;
    }
    const y = pos.y + rowIndex + 2;

    // Draw edit indicator
    const width = this.viewportManager.getColumnWidth(cursor.col);

    buffer.fillRect(
      x,
      y,
      width,
      1,
      " ",
      this.colors.cursorFg,
      this.colors.editBg,
    );

    // For now, editing is handled in the formula bar
    // Just show an indicator that we're editing
    const editIndicator = "[EDITING]";
    if (editIndicator.length <= width) {
      const padding = Math.floor((width - editIndicator.length) / 2);
      buffer.setText(
        x + padding,
        y,
        editIndicator,
        this.colors.cursorFg,
        this.colors.editBg,
      );
    }
  }

  private renderResizeOverlay(
    buffer: OptimizedBuffer,
    pos: { x: number; y: number },
    state: UIState,
    visibleCols: number[],
    visibleRows: number[],
  ): void {
    if (!isResizeMode(state)) return;

    // Show resize instructions in top-left corner
    const instructions =
      state.resizeTarget === "column"
        ? "< > to resize | = auto-fit | ESC exit"
        : "- + to resize | = auto-fit | ESC exit";

    const instructionBg = { r: 0, g: 0, b: 0, a: 200 };
    const instructionFg = { r: 255, g: 255, b: 100, a: 255 };

    buffer.fillRect(
      pos.x + 2,
      pos.y + 3,
      instructions.length + 2,
      1,
      " ",
      instructionFg,
      instructionBg,
    );

    buffer.setText(
      pos.x + 3,
      pos.y + 3,
      instructions,
      instructionFg,
      instructionBg,
    );

    // Show current size info
    const sizeInfo = `${state.resizeTarget.toUpperCase()} ${state.resizeIndex}: ${state.currentSize}`;
    const sizeDiff = state.currentSize - state.originalSize;
    const diffStr = sizeDiff >= 0 ? `+${sizeDiff}` : `${sizeDiff}`;
    const fullInfo = `${sizeInfo} (${diffStr})`;

    buffer.fillRect(
      pos.x + 2,
      pos.y + 4,
      fullInfo.length + 2,
      1,
      " ",
      this.colors.resizeInfo,
      instructionBg,
    );

    buffer.setText(
      pos.x + 3,
      pos.y + 4,
      fullInfo,
      this.colors.resizeInfo,
      instructionBg,
    );
  }

  private getColumnName(col: number): string {
    let name = "";
    while (col >= 0) {
      name = String.fromCharCode(65 + (col % 26)) + name;
      col = Math.floor(col / 26) - 1;
    }
    return name;
  }
}
