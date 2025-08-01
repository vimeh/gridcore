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

    // Render cells
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      for (let col = bounds.startCol; col <= bounds.endCol; col++) {
        const address: CellAddress = { row, col };
        const position = this.viewport.getCellPosition(address);
        const cell = getCellValue(address);
        
        const cellKey = cellAddressToString(address);
        const isSelected = selectedCells?.has(cellKey) || false;
        const isActive = !!(activeCell && activeCell.row === address.row && activeCell.col === address.col);
        const isBeingEdited = isActive && (isEditing || false);
        
        this.renderCell(position, cell, address, isSelected, isActive, isBeingEdited);
      }
    }

    // Render grid lines
    this.renderGridLines(bounds);
    
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

    if (x + width < 0 || x > this.canvas.width / this.devicePixelRatio ||
        y + height < 0 || y > this.canvas.height / this.devicePixelRatio) {
      return;
    }

    if (isSelected) {
      this.ctx.fillStyle = this.theme.selectedCellBackgroundColor;
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillRect(x, y, width, height);
      this.ctx.globalAlpha = 1;
    }

    if (cell?.style?.backgroundColor) {
      this.ctx.fillStyle = cell.style.backgroundColor;
      this.ctx.fillRect(x, y, width, height);
    }

    if (!isBeingEdited && cell?.computedValue !== null && cell?.computedValue !== undefined) {
      this.ctx.save();
      
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

      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();

      const text = String(cell.computedValue);
      const textX = x + this.theme.cellPaddingLeft;
      const textY = y + height / 2;
      
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
    let x = 0;
    for (let col = 0; col < bounds.startCol; col++) {
      x += this.viewport.getColumnWidth(col);
    }
    for (let col = bounds.startCol; col <= bounds.endCol + 1; col++) {
      const colX = x - this.viewport.getScrollPosition().x;
      if (colX >= 0 && colX <= this.canvas.width / this.devicePixelRatio) {
        this.ctx.moveTo(colX + 0.5, 0);
        this.ctx.lineTo(colX + 0.5, this.canvas.height / this.devicePixelRatio);
      }
      if (col < this.viewport.getTotalCols()) {
        x += this.viewport.getColumnWidth(col);
      }
    }

    // Horizontal lines
    let y = 0;
    for (let row = 0; row < bounds.startRow; row++) {
      y += this.viewport.getRowHeight(row);
    }
    for (let row = bounds.startRow; row <= bounds.endRow + 1; row++) {
      const rowY = y - this.viewport.getScrollPosition().y;
      if (rowY >= 0 && rowY <= this.canvas.height / this.devicePixelRatio) {
        this.ctx.moveTo(0, rowY + 0.5);
        this.ctx.lineTo(this.canvas.width / this.devicePixelRatio, rowY + 0.5);
      }
      if (row < this.viewport.getTotalRows()) {
        y += this.viewport.getRowHeight(row);
      }
    }

    this.ctx.stroke();
  }


  private renderActiveCellBorder(activeCell: CellAddress, isEditing: boolean = false): void {
    const position = this.viewport.getCellPosition(activeCell);
    
    if (position.x + position.width > 0 && position.y + position.height > 0) {
      const x = position.x;
      const y = position.y;
      const width = position.width;
      const height = position.height;
      
      if (isEditing) {
        this.ctx.save();
        
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
      
      this.ctx.strokeStyle = this.theme.activeCellBorderColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
      
      this.ctx.lineWidth = this.theme.gridLineWidth;
    }
  }
}
