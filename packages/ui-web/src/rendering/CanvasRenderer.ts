import { Cell, CellAddress } from "@gridcore/core";
import type { Viewport, ViewportBounds } from "../components/Viewport";
import { PIXEL_PERFECT_OFFSET } from "../constants";
import type { GridTheme } from "./GridTheme";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private devicePixelRatio: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: GridTheme,
    private viewport: Viewport,
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D context from canvas");
    }
    this.ctx = context;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    // Handle high DPI displays
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.devicePixelRatio;
    this.canvas.height = rect.height * this.devicePixelRatio;
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
  }

  resize(width: number, height: number): void {
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * this.devicePixelRatio;
    this.canvas.height = height * this.devicePixelRatio;
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    this.viewport.setViewportSize(width, height);
  }

  clear(): void {
    const width = this.canvas.width / this.devicePixelRatio;
    const height = this.canvas.height / this.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = this.theme.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }

  renderGrid(
    getCellValue: (address: CellAddress) => Cell | undefined,
    activeCell?: CellAddress | null,
    isEditing?: boolean,
    isNavigationMode?: boolean,
  ): number {
    this.clear();

    const bounds = this.viewport.getVisibleBounds();
    let cellsRendered = 0;

    // Render cells
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      for (let col = bounds.startCol; col <= bounds.endCol; col++) {
        cellsRendered++;
        const addressResult = CellAddress.create(row, col);
        if (!addressResult.ok) continue;
        const address = addressResult.value;
        const position = this.viewport.getCellPosition(address);
        const cell = getCellValue(address);

        const isActive = !!(
          activeCell &&
          activeCell.row === address.row &&
          activeCell.col === address.col
        );
        const isBeingEdited = isActive && (isEditing || false);

        this.renderCell(position, cell, address, isActive, isBeingEdited);
      }
    }

    // Render grid lines
    this.renderGridLines(bounds);

    // Render active cell border and glow on top
    if (activeCell) {
      this.renderActiveCellBorder(
        activeCell,
        isEditing || false,
        isNavigationMode || false,
      );
    }

    return cellsRendered;
  }

  private renderCell(
    position: { x: number; y: number; width: number; height: number },
    cell: Cell | undefined,
    _address: CellAddress,
    _isActive: boolean = false,
    isBeingEdited: boolean = false,
  ): void {
    const { x, y, width, height } = position;

    // Skip if cell is outside viewport
    if (
      x + width < 0 ||
      x > this.canvas.width / this.devicePixelRatio ||
      y + height < 0 ||
      y > this.canvas.height / this.devicePixelRatio
    ) {
      return;
    }

    // Fill background if needed
    // TODO: Implement cell styling system
    // if (cell?.style?.backgroundColor) {
    //   this.ctx.fillStyle = cell.style.backgroundColor;
    //   this.ctx.fillRect(x, y, width, height);
    // }

    // Render text (skip if cell is being edited)
    if (
      !isBeingEdited &&
      cell?.computedValue !== null &&
      cell?.computedValue !== undefined
    ) {
      this.ctx.save();

      // Set text styles
      this.ctx.fillStyle = this.theme.cellTextColor; // TODO: Use cell?.style?.color when styling is implemented
      this.ctx.font = `${this.theme.cellFontSize}px ${this.theme.cellFontFamily}`;

      // TODO: Implement cell styling system
      // if (cell?.style?.bold) {
      //   this.ctx.font = `bold ${this.ctx.font}`;
      // }

      // if (cell?.style?.italic) {
      //   this.ctx.font = `italic ${this.ctx.font}`;
      // }

      // Clip to cell bounds
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();

      // Draw text
      const text = cell.error ? cell.error : String(cell.computedValue);
      const textX = x + this.theme.cellPaddingLeft;
      const textY = y + height / 2;

      // Ensure text baseline is middle for vertical centering
      this.ctx.textBaseline = "middle";

      // Style error text differently
      if (cell.error) {
        this.ctx.fillStyle = "#FF0000";
      }

      // TODO: Implement text alignment from cell styles
      this.ctx.textAlign = "left";
      this.ctx.fillText(text, textX, textY);

      this.ctx.restore();
    }
  }

  private renderGridLines(bounds: ViewportBounds): void {
    this.ctx.strokeStyle = this.theme.gridLineColor;
    this.ctx.lineWidth = this.theme.gridLineWidth;
    this.ctx.beginPath();

    const scrollX = this.viewport.getScrollPosition().x;
    const scrollY = this.viewport.getScrollPosition().y;

    // Vertical lines (draw right border of each cell)
    let x = 0;
    for (let col = 0; col < bounds.startCol; col++) {
      x += this.viewport.getColumnWidth(col);
    }
    for (let col = bounds.startCol; col <= bounds.endCol; col++) {
      const colWidth = this.viewport.getColumnWidth(col);
      const colX = x - scrollX;
      if (
        colX + colWidth >= 0 &&
        colX <= this.canvas.width / this.devicePixelRatio
      ) {
        this.ctx.moveTo(colX + colWidth - PIXEL_PERFECT_OFFSET, 0);
        this.ctx.lineTo(
          colX + colWidth - PIXEL_PERFECT_OFFSET,
          this.canvas.height / this.devicePixelRatio,
        );
      }
      x += colWidth;
    }

    // Horizontal lines (draw bottom border of each cell)
    let y = 0;
    for (let row = 0; row < bounds.startRow; row++) {
      y += this.viewport.getRowHeight(row);
    }
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      const rowHeight = this.viewport.getRowHeight(row);
      const rowY = y - scrollY;
      if (
        rowY + rowHeight >= 0 &&
        rowY <= this.canvas.height / this.devicePixelRatio
      ) {
        this.ctx.moveTo(0, rowY + rowHeight - PIXEL_PERFECT_OFFSET);
        this.ctx.lineTo(
          this.canvas.width / this.devicePixelRatio,
          rowY + rowHeight - PIXEL_PERFECT_OFFSET,
        );
      }
      y += rowHeight;
    }

    this.ctx.stroke();
  }

  private renderActiveCellBorder(
    activeCell: CellAddress,
    isEditing: boolean = false,
    isNavigationMode: boolean = false,
  ): void {
    const position = this.viewport.getCellPosition(activeCell);

    if (position.x + position.width > 0 && position.y + position.height > 0) {
      const x = position.x;
      const y = position.y;
      const width = position.width;
      const height = position.height;

      if (isEditing) {
        // Editing mode - show glow effect
        this.ctx.save();

        const glowColor = this.theme.activeCellBorderColor;
        const glowLayers = [
          { width: 6, opacity: 0.1 },
          { width: 4, opacity: 0.2 },
          { width: 3, opacity: 0.3 },
        ];

        glowLayers.forEach((layer) => {
          this.ctx.strokeStyle = glowColor;
          this.ctx.globalAlpha = layer.opacity;
          this.ctx.lineWidth = layer.width;
          this.ctx.strokeRect(
            x + 1 - (layer.width - 2) / 2,
            y + 1 - (layer.width - 2) / 2,
            width - 2 + (layer.width - 2),
            height - 2 + (layer.width - 2),
          );
        });

        this.ctx.restore();
      } else if (isNavigationMode) {
        // Navigation mode - show distinct cursor
        this.ctx.save();

        // Fill with semi-transparent color
        this.ctx.fillStyle = this.theme.activeCellBorderColor;
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillRect(x + 1, y + 1, width - 2, height - 2);

        // Draw thicker border
        this.ctx.globalAlpha = 1;
        this.ctx.strokeStyle = this.theme.activeCellBorderColor;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);

        // Add corner indicators for better visibility
        const cornerSize = 6;
        this.ctx.lineWidth = 2;

        // Top-left corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + 1, y + cornerSize);
        this.ctx.lineTo(x + 1, y + 1);
        this.ctx.lineTo(x + cornerSize, y + 1);
        this.ctx.stroke();

        // Top-right corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - cornerSize, y + 1);
        this.ctx.lineTo(x + width - 1, y + 1);
        this.ctx.lineTo(x + width - 1, y + cornerSize);
        this.ctx.stroke();

        // Bottom-left corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + 1, y + height - cornerSize);
        this.ctx.lineTo(x + 1, y + height - 1);
        this.ctx.lineTo(x + cornerSize, y + height - 1);
        this.ctx.stroke();

        // Bottom-right corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - cornerSize, y + height - 1);
        this.ctx.lineTo(x + width - 1, y + height - 1);
        this.ctx.lineTo(x + width - 1, y + height - cornerSize);
        this.ctx.stroke();

        this.ctx.restore();
      } else {
        // Default active cell border (thin border)
        this.ctx.strokeStyle = this.theme.activeCellBorderColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
      }

      this.ctx.lineWidth = this.theme.gridLineWidth;
    }
  }
}
