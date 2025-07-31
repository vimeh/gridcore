import { CellAddress } from '@gridcore/core';
import { GridTheme } from '../rendering/GridTheme';

export interface ViewportBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export class Viewport {
  private scrollPosition: ScrollPosition = { x: 0, y: 0 };
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private columnWidths: Map<number, number> = new Map();
  private rowHeights: Map<number, number> = new Map();
  
  constructor(
    private theme: GridTheme,
    private totalRows: number = 1000,
    private totalCols: number = 26
  ) {}

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setScrollPosition(x: number, y: number): void {
    this.scrollPosition = { x, y };
  }

  getScrollPosition(): ScrollPosition {
    return { ...this.scrollPosition };
  }

  getColumnWidth(col: number): number {
    return this.columnWidths.get(col) ?? this.theme.defaultCellWidth;
  }

  setColumnWidth(col: number, width: number): void {
    const clampedWidth = Math.max(
      this.theme.minCellWidth,
      Math.min(width, this.theme.maxCellWidth)
    );
    this.columnWidths.set(col, clampedWidth);
  }

  getRowHeight(row: number): number {
    return this.rowHeights.get(row) ?? this.theme.defaultCellHeight;
  }

  setRowHeight(row: number, height: number): void {
    this.rowHeights.set(row, Math.max(16, height));
  }

  getVisibleBounds(): ViewportBounds {
    let startRow = 0;
    let endRow = 0;
    let startCol = 0;
    let endCol = 0;

    // Calculate visible rows
    let y = this.theme.columnHeaderHeight;
    const scrollY = this.scrollPosition.y;
    
    for (let row = 0; row < this.totalRows; row++) {
      const height = this.getRowHeight(row);
      if (y + height > scrollY && startRow === 0) {
        startRow = row;
      }
      if (y > scrollY + this.viewportHeight) {
        endRow = row;
        break;
      }
      y += height;
    }
    
    if (endRow === 0) endRow = this.totalRows - 1;

    // Calculate visible columns
    let x = this.theme.rowHeaderWidth;
    const scrollX = this.scrollPosition.x;
    
    for (let col = 0; col < this.totalCols; col++) {
      const width = this.getColumnWidth(col);
      if (x + width > scrollX && startCol === 0) {
        startCol = col;
      }
      if (x > scrollX + this.viewportWidth) {
        endCol = col;
        break;
      }
      x += width;
    }
    
    if (endCol === 0) endCol = this.totalCols - 1;

    return { startRow, endRow, startCol, endCol };
  }

  getCellPosition(address: CellAddress): { x: number; y: number; width: number; height: number } {
    let x = this.theme.rowHeaderWidth;
    let y = this.theme.columnHeaderHeight;

    // Calculate x position
    for (let col = 0; col < address.col; col++) {
      x += this.getColumnWidth(col);
    }

    // Calculate y position
    for (let row = 0; row < address.row; row++) {
      y += this.getRowHeight(row);
    }

    return {
      x: x - this.scrollPosition.x,
      y: y - this.scrollPosition.y,
      width: this.getColumnWidth(address.col),
      height: this.getRowHeight(address.row)
    };
  }

  getCellAtPosition(x: number, y: number): CellAddress | null {
    // Adjust for scroll position
    const absoluteX = x + this.scrollPosition.x;
    const absoluteY = y + this.scrollPosition.y;

    // Check if in headers
    if (absoluteX < this.theme.rowHeaderWidth || absoluteY < this.theme.columnHeaderHeight) {
      return null;
    }

    // Find column
    let currentX = this.theme.rowHeaderWidth;
    let col = -1;
    
    for (let c = 0; c < this.totalCols; c++) {
      const width = this.getColumnWidth(c);
      if (absoluteX >= currentX && absoluteX < currentX + width) {
        col = c;
        break;
      }
      currentX += width;
    }

    // Find row
    let currentY = this.theme.columnHeaderHeight;
    let row = -1;
    
    for (let r = 0; r < this.totalRows; r++) {
      const height = this.getRowHeight(r);
      if (absoluteY >= currentY && absoluteY < currentY + height) {
        row = r;
        break;
      }
      currentY += height;
    }

    if (row >= 0 && col >= 0) {
      return { row, col };
    }

    return null;
  }

  getTotalGridWidth(): number {
    let width = this.theme.rowHeaderWidth;
    for (let col = 0; col < this.totalCols; col++) {
      width += this.getColumnWidth(col);
    }
    return width;
  }

  getTotalGridHeight(): number {
    let height = this.theme.columnHeaderHeight;
    for (let row = 0; row < this.totalRows; row++) {
      height += this.getRowHeight(row);
    }
    return height;
  }
}