import type { CellAddress, CellRange } from "@gridcore/core";
import { parseCellAddress } from "@gridcore/core";
import type { Viewport as GridViewport } from "../components/Viewport";
import type { GridTheme } from "./GridTheme";

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SelectionRenderer {
  private ctx: CanvasRenderingContext2D;
  private theme: GridTheme;
  private viewport: GridViewport;
  private devicePixelRatio: number;

  constructor(
    canvas: HTMLCanvasElement,
    theme: GridTheme,
    viewport: GridViewport,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;
    this.theme = theme;
    this.viewport = viewport;
    this.devicePixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  renderSelection(
    selectedCells: Set<string>,
    selectionRange: CellRange | null,
    visualMode: "character" | "line" | "block" | null,
  ): void {
    if (selectedCells.size === 0 && !selectionRange) return;

    // Render cell highlights
    if (selectedCells.size > 0) {
      this.renderSelectionHighlight(selectedCells);
    }

    // Render selection border
    if (selectionRange || selectedCells.size > 1) {
      const bounds = this.calculateSelectionBounds(
        selectedCells,
        selectionRange,
      );
      if (bounds) {
        this.renderSelectionBorder(bounds, visualMode);
      }
    }
  }

  private renderSelectionHighlight(selectedCells: Set<string>): void {
    this.ctx.save();
    this.ctx.fillStyle = this.theme.selectedCellBackgroundColor;
    this.ctx.globalAlpha = 0.3;

    for (const cellKey of selectedCells) {
      const cellAddress = parseCellAddress(cellKey);
      if (!cellAddress) continue;

      const position = this.viewport.getCellPosition(cellAddress);

      if (position && this.isCellVisible(position)) {
        this.ctx.fillRect(
          position.x,
          position.y,
          position.width,
          position.height,
        );
      }
    }

    this.ctx.restore();
  }

  private renderSelectionBorder(
    bounds: SelectionBounds,
    visualMode: "character" | "line" | "block" | null,
  ): void {
    this.ctx.save();

    // Set border style based on visual mode
    this.ctx.strokeStyle =
      this.theme.selectionBorderColor || this.theme.activeCellBorderColor;
    this.ctx.lineWidth = 2;

    if (visualMode === "line") {
      // Dashed border for line mode
      this.ctx.setLineDash([5, 3]);
    } else if (visualMode === "block") {
      // Thicker border for block mode
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([]);
    } else {
      // Solid border for character mode or normal selection
      this.ctx.setLineDash([]);
    }

    // Draw the border
    this.ctx.strokeRect(
      bounds.x + 0.5,
      bounds.y + 0.5,
      bounds.width - 1,
      bounds.height - 1,
    );

    // Add corner indicators for better visibility
    if (visualMode) {
      this.drawCornerIndicators(bounds);
    }

    this.ctx.restore();
  }

  private drawCornerIndicators(bounds: SelectionBounds): void {
    const cornerSize = 8;
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle =
      this.theme.selectionBorderColor || this.theme.activeCellBorderColor;

    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(bounds.x, bounds.y + cornerSize);
    this.ctx.lineTo(bounds.x, bounds.y);
    this.ctx.lineTo(bounds.x + cornerSize, bounds.y);
    this.ctx.stroke();

    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(bounds.x + bounds.width - cornerSize, bounds.y);
    this.ctx.lineTo(bounds.x + bounds.width, bounds.y);
    this.ctx.lineTo(bounds.x + bounds.width, bounds.y + cornerSize);
    this.ctx.stroke();

    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(bounds.x, bounds.y + bounds.height - cornerSize);
    this.ctx.lineTo(bounds.x, bounds.y + bounds.height);
    this.ctx.lineTo(bounds.x + cornerSize, bounds.y + bounds.height);
    this.ctx.stroke();

    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(
      bounds.x + bounds.width - cornerSize,
      bounds.y + bounds.height,
    );
    this.ctx.lineTo(bounds.x + bounds.width, bounds.y + bounds.height);
    this.ctx.lineTo(
      bounds.x + bounds.width,
      bounds.y + bounds.height - cornerSize,
    );
    this.ctx.stroke();
  }

  private calculateSelectionBounds(
    selectedCells: Set<string>,
    selectionRange: CellRange | null,
  ): SelectionBounds | null {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    if (selectionRange) {
      // Use selection range if available
      minRow = selectionRange.start.row;
      maxRow = selectionRange.end.row;
      minCol = selectionRange.start.col;
      maxCol = selectionRange.end.col;
    } else {
      // Calculate bounds from selected cells
      for (const cellKey of selectedCells) {
        const cellAddress = parseCellAddress(cellKey);
        if (!cellAddress) continue;

        minRow = Math.min(minRow, cellAddress.row);
        maxRow = Math.max(maxRow, cellAddress.row);
        minCol = Math.min(minCol, cellAddress.col);
        maxCol = Math.max(maxCol, cellAddress.col);
      }
    }

    if (minRow === Infinity || minCol === Infinity) {
      return null;
    }

    // Get positions for corner cells
    const topLeft = this.viewport.getCellPosition({ row: minRow, col: minCol });
    const bottomRight = this.viewport.getCellPosition({
      row: maxRow,
      col: maxCol,
    });

    if (!topLeft || !bottomRight) {
      return null;
    }

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x + bottomRight.width - topLeft.x,
      height: bottomRight.y + bottomRight.height - topLeft.y,
    };
  }

  private isCellVisible(position: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): boolean {
    const canvasWidth = this.ctx.canvas.width / this.devicePixelRatio;
    const canvasHeight = this.ctx.canvas.height / this.devicePixelRatio;

    return !(
      position.x + position.width < 0 ||
      position.x > canvasWidth ||
      position.y + position.height < 0 ||
      position.y > canvasHeight
    );
  }

  updateTheme(theme: GridTheme): void {
    this.theme = theme;
  }
}
