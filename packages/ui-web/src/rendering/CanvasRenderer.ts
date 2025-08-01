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

  renderGrid(
    getCellValue: (address: CellAddress) => Cell | undefined,
    selectedCells?: Set<string>,
    activeCell?: CellAddress | null,
    isEditing?: boolean
  ): void {
    this.clear();
    
    const bounds = this.viewport.getVisibleBounds();
    const scrollPos = this.viewport.getScrollPosition();

    // Render cells
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      for (let col = bounds.startCol; col <= bounds.endCol; col++) {
        const address: CellAddress = { row, col };
        const position = this.viewport.getCellPosition(address);
        const cell = getCellValue(address);
        
        // Check if this cell is selected
        const cellKey = cellAddressToString(address);
        const isSelected = selectedCells?.has(cellKey) || false;
        const isActive = activeCell && activeCell.row === address.row && activeCell.col === address.col;
        const isBeingEdited = isActive && isEditing;
        
        this.renderCell(position, cell, address, isSelected, isActive, isBeingEdited);
      }
    }

    // Render grid lines
    this.renderGridLines(bounds);

    // Render headers
    this.renderHeaders(bounds);
    
    // Render active cell border and glow on top
    if (activeCell) {
      this.renderActiveCellBorder(activeCell, isEditing || false);
    }
  }

  private renderCell(
    position: { x: number; y: number; width: number; height: number },
    cell: Cell | undefined,
    address: CellAddress,
    isSelected: boolean = false,
    isActive: boolean = false,
    isBeingEdited: boolean = false
  ): void {
    const { x, y, width, height } = position;

    // Skip if cell is outside viewport
    if (x + width < 0 || x > this.canvas.width / this.devicePixelRatio ||
        y + height < 0 || y > this.canvas.height / this.devicePixelRatio) {
      return;
    }

    // Render selection background first (if selected)
    if (isSelected && x + width > this.theme.rowHeaderWidth && y + height > this.theme.columnHeaderHeight) {
      this.ctx.fillStyle = this.theme.selectedCellBackgroundColor;
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillRect(
        Math.max(x, this.theme.rowHeaderWidth),
        Math.max(y, this.theme.columnHeaderHeight),
        width,
        height
      );
      this.ctx.globalAlpha = 1;
    }

    // Fill background if needed
    if (cell?.style?.backgroundColor) {
      this.ctx.fillStyle = cell.style.backgroundColor;
      this.ctx.fillRect(x, y, width, height);
    }

    // Render text (skip if cell is being edited)
    if (!isBeingEdited && cell?.computedValue !== null && cell?.computedValue !== undefined) {
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

  private renderActiveCellBorder(activeCell: CellAddress, isEditing: boolean = false): void {
    const position = this.viewport.getCellPosition(activeCell);
    
    if (position.x + position.width > this.theme.rowHeaderWidth &&
        position.y + position.height > this.theme.columnHeaderHeight) {
      
      const x = Math.max(position.x, this.theme.rowHeaderWidth);
      const y = Math.max(position.y, this.theme.columnHeaderHeight);
      const width = position.width;
      const height = position.height;
      
      // If editing, draw a glow effect
      if (isEditing) {
        this.ctx.save();
        
        // Draw multiple layers of border with decreasing opacity for glow effect
        const glowColor = this.theme.activeCellBorderColor;
        const glowLayers = [
          { width: 6, opacity: 0.1 },
          { width: 4, opacity: 0.2 },
          { width: 3, opacity: 0.3 }
        ];
        
        glowLayers.forEach(layer => {
          this.ctx.strokeStyle = glowColor;
          this.ctx.globalAlpha = layer.opacity;
          this.ctx.lineWidth = layer.width;
          this.ctx.strokeRect(
            x + 1 - (layer.width - 2) / 2,
            y + 1 - (layer.width - 2) / 2,
            width - 2 + (layer.width - 2),
            height - 2 + (layer.width - 2)
          );
        });
        
        this.ctx.restore();
      }
      
      // Always draw the main border
      this.ctx.strokeStyle = this.theme.activeCellBorderColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
      
      // Reset line width for other drawing
      this.ctx.lineWidth = this.theme.gridLineWidth;
    }
  }
}
