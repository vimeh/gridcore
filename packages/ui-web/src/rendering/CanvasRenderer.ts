import { Cell, CellAddress, cellAddressToString } from '@gridcore/core';
import { GridTheme } from './GridTheme';
import { Viewport, ViewportBounds } from '../components/Viewport';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private devicePixelRatio: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: GridTheme,
    private viewport: Viewport
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
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

  renderGrid(getCellValue: (address: CellAddress) => Cell | undefined): void {
    this.clear();
    
    const bounds = this.viewport.getVisibleBounds();
    const scrollPos = this.viewport.getScrollPosition();

    // Render cells
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      for (let col = bounds.startCol; col <= bounds.endCol; col++) {
        const address: CellAddress = { row, col };
        const position = this.viewport.getCellPosition(address);
        const cell = getCellValue(address);
        
        this.renderCell(position, cell, address);
      }
    }

    // Render grid lines
    this.renderGridLines(bounds);

    // Render headers
    this.renderHeaders(bounds);
  }

  private renderCell(
    position: { x: number; y: number; width: number; height: number },
    cell: Cell | undefined,
    address: CellAddress
  ): void {
    const { x, y, width, height } = position;

    // Skip if cell is outside viewport
    if (x + width < 0 || x > this.canvas.width / this.devicePixelRatio ||
        y + height < 0 || y > this.canvas.height / this.devicePixelRatio) {
      return;
    }

    // Fill background if needed
    if (cell?.style?.backgroundColor) {
      this.ctx.fillStyle = cell.style.backgroundColor;
      this.ctx.fillRect(x, y, width, height);
    }

    // Render text
    if (cell?.computedValue !== null && cell?.computedValue !== undefined) {
      this.ctx.save();
      
      // Set text styles
      this.ctx.fillStyle = cell?.style?.color || this.theme.cellTextColor;
      this.ctx.font = `${cell?.style?.fontSize || this.theme.cellFontSize}px ${
        cell?.style?.fontFamily || this.theme.cellFontFamily
      }`;
      
      if (cell?.style?.bold) {
        this.ctx.font = `bold ${this.ctx.font}`;
      }
      
      if (cell?.style?.italic) {
        this.ctx.font = `italic ${this.ctx.font}`;
      }

      // Clip to cell bounds
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();

      // Draw text
      const text = String(cell.computedValue);
      const textX = x + this.theme.cellPaddingLeft;
      const textY = y + height / 2;
      
      // Ensure text baseline is middle for vertical centering
      this.ctx.textBaseline = 'middle';
      
      if (cell?.style?.textAlign === 'center') {
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x + width / 2, textY);
      } else if (cell?.style?.textAlign === 'right') {
        this.ctx.textAlign = 'right';
        this.ctx.fillText(text, x + width - this.theme.cellPaddingLeft, textY);
      } else {
        this.ctx.textAlign = 'left';
        this.ctx.fillText(text, textX, textY);
      }

      this.ctx.restore();
    }
  }

  private renderGridLines(bounds: ViewportBounds): void {
    this.ctx.strokeStyle = this.theme.gridLineColor;
    this.ctx.lineWidth = this.theme.gridLineWidth;
    this.ctx.beginPath();

    // Vertical lines
    let x = this.theme.rowHeaderWidth;
    for (let col = 0; col <= bounds.endCol; col++) {
      const colX = x - this.viewport.getScrollPosition().x;
      if (colX >= this.theme.rowHeaderWidth) {
        this.ctx.moveTo(colX + 0.5, 0);
        this.ctx.lineTo(colX + 0.5, this.canvas.height / this.devicePixelRatio);
      }
      x += this.viewport.getColumnWidth(col);
    }

    // Horizontal lines
    let y = this.theme.columnHeaderHeight;
    for (let row = 0; row <= bounds.endRow; row++) {
      const rowY = y - this.viewport.getScrollPosition().y;
      if (rowY >= this.theme.columnHeaderHeight) {
        this.ctx.moveTo(0, rowY + 0.5);
        this.ctx.lineTo(this.canvas.width / this.devicePixelRatio, rowY + 0.5);
      }
      y += this.viewport.getRowHeight(row);
    }

    this.ctx.stroke();
  }

  private renderHeaders(bounds: ViewportBounds): void {
    const scrollPos = this.viewport.getScrollPosition();

    // Clear header areas
    this.ctx.fillStyle = this.theme.headerBackgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width / this.devicePixelRatio, this.theme.columnHeaderHeight);
    this.ctx.fillRect(0, 0, this.theme.rowHeaderWidth, this.canvas.height / this.devicePixelRatio);

    // Column headers - scroll horizontally but not vertically
    this.ctx.fillStyle = this.theme.headerTextColor;
    this.ctx.font = `${this.theme.headerFontSize}px ${this.theme.headerFontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Set clipping region for column headers to prevent overlap with row header area
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(
      this.theme.rowHeaderWidth, 
      0, 
      this.canvas.width / this.devicePixelRatio - this.theme.rowHeaderWidth, 
      this.theme.columnHeaderHeight
    );
    this.ctx.clip();

    let x = this.theme.rowHeaderWidth;
    for (let col = 0; col < this.viewport.getTotalCols(); col++) {
      const width = this.viewport.getColumnWidth(col);
      const colX = x - scrollPos.x;  // Apply horizontal scroll
      
      // Only render if the column header is visible in the viewport
      if (colX + width > this.theme.rowHeaderWidth && colX < this.canvas.width / this.devicePixelRatio) {
        const letter = String.fromCharCode(65 + col); // Simple A-Z for now
        // Column headers stay at fixed vertical position (not affected by scrollPos.y)
        this.ctx.fillText(letter, colX + width / 2, this.theme.columnHeaderHeight / 2);
      }
      
      x += width;
      
      // Stop if we're way beyond the viewport
      if (colX > this.canvas.width / this.devicePixelRatio) break;
    }

    this.ctx.restore(); // Restore clipping region

    // Row headers - scroll vertically but not horizontally
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    // Set clipping region for row headers to prevent overlap with column header area
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(
      0, 
      this.theme.columnHeaderHeight, 
      this.theme.rowHeaderWidth, 
      this.canvas.height / this.devicePixelRatio - this.theme.columnHeaderHeight
    );
    this.ctx.clip();

    let y = this.theme.columnHeaderHeight;
    for (let row = 0; row < this.viewport.getTotalRows(); row++) {
      const height = this.viewport.getRowHeight(row);
      const rowY = y - scrollPos.y;  // Apply vertical scroll
      
      // Only render if the row header is visible in the viewport
      if (rowY + height > this.theme.columnHeaderHeight && rowY < this.canvas.height / this.devicePixelRatio) {
        // Row headers stay at fixed horizontal position (not affected by scrollPos.x)
        this.ctx.fillText(String(row + 1), this.theme.rowHeaderWidth / 2, rowY + height / 2);
      }
      
      y += height;
      
      // Stop if we're way beyond the viewport
      if (rowY > this.canvas.height / this.devicePixelRatio) break;
    }

    this.ctx.restore(); // Restore clipping region

    // Header borders
    this.ctx.strokeStyle = this.theme.gridLineColor;
    this.ctx.lineWidth = this.theme.gridLineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.theme.columnHeaderHeight + 0.5);
    this.ctx.lineTo(this.canvas.width / this.devicePixelRatio, this.theme.columnHeaderHeight + 0.5);
    this.ctx.moveTo(this.theme.rowHeaderWidth + 0.5, 0);
    this.ctx.lineTo(this.theme.rowHeaderWidth + 0.5, this.canvas.height / this.devicePixelRatio);
    this.ctx.stroke();
  }

  renderSelection(selectedCells: Set<string>): void {
    if (selectedCells.size === 0) return;

    this.ctx.fillStyle = this.theme.selectedCellBackgroundColor;
    this.ctx.globalAlpha = 0.3;

    for (const cellKey of selectedCells) {
      const match = cellKey.match(/^([A-Z]+)(\d+)$/);
      if (!match) continue;
      
      const col = match[1].charCodeAt(0) - 65; // Simple A-Z for now
      const row = parseInt(match[2]) - 1;
      const address: CellAddress = { row, col };
      const position = this.viewport.getCellPosition(address);
      
      if (position.x + position.width > this.theme.rowHeaderWidth &&
          position.y + position.height > this.theme.columnHeaderHeight) {
        this.ctx.fillRect(
          Math.max(position.x, this.theme.rowHeaderWidth),
          Math.max(position.y, this.theme.columnHeaderHeight),
          position.width,
          position.height
        );
      }
    }

    this.ctx.globalAlpha = 1;
  }
}
