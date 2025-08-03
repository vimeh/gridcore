import { Renderable, OptimizedBuffer, type RGBA } from '../framework'
import type { SpreadsheetEngine, CellAddress } from '@gridcore/core'
import type { TUIState } from '../SpreadsheetTUI'

export class GridComponent extends Renderable {
  private colWidths: number[] = []
  private defaultColWidth = 10
  private rowHeaderWidth = 5
  private colors = {
    gridLines: { r: 64, g: 64, b: 64, a: 255 },
    headerBg: { r: 32, g: 32, b: 32, a: 255 },
    headerFg: { r: 200, g: 200, b: 200, a: 255 },
    cellFg: { r: 255, g: 255, b: 255, a: 255 },
    cursorBg: { r: 0, g: 128, b: 255, a: 255 },
    cursorFg: { r: 255, g: 255, b: 255, a: 255 },
    selectedBg: { r: 0, g: 64, b: 128, a: 255 },
    selectedFg: { r: 255, g: 255, b: 255, a: 255 }
  }

  constructor(
    private engine: SpreadsheetEngine,
    private getState: () => TUIState
  ) {
    super('grid')
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState()
    const { viewport, cursor, selectedRange, mode } = state
    const pos = this.getAbsolutePosition()

    // Initialize column widths if needed
    if (this.colWidths.length < viewport.cols) {
      this.colWidths = Array(viewport.cols).fill(this.defaultColWidth)
    }

    // Render column headers
    this.renderColumnHeaders(buffer, pos, viewport)

    // Render row headers and cells
    for (let row = 0; row < viewport.rows; row++) {
      const absoluteRow = viewport.startRow + row
      const y = pos.y + row + 2 // +2 for header row

      // Render row header
      this.renderRowHeader(buffer, pos.x, y, absoluteRow)

      // Render cells
      let x = pos.x + this.rowHeaderWidth + 1
      for (let col = 0; col < viewport.cols; col++) {
        const absoluteCol = viewport.startCol + col
        const cellAddr: CellAddress = { row: absoluteRow, col: absoluteCol }
        
        // Determine cell colors based on cursor and selection
        let fg = this.colors.cellFg
        let bg: RGBA | undefined
        
        if (cursor.row === absoluteRow && cursor.col === absoluteCol) {
          bg = this.colors.cursorBg
          fg = this.colors.cursorFg
        } else if (this.isInSelection(cellAddr, selectedRange)) {
          bg = this.colors.selectedBg
          fg = this.colors.selectedFg
        }

        this.renderCell(buffer, x, y, cellAddr, this.colWidths[col], fg, bg)
        
        x += this.colWidths[col] + 1
      }
    }

    // Render grid lines
    this.renderGridLines(buffer, pos, viewport)

    // Render mode-specific overlays
    if (mode === 'edit' && state.editingValue !== undefined) {
      this.renderEditOverlay(buffer, pos, state)
    }
  }

  private renderColumnHeaders(buffer: OptimizedBuffer, pos: { x: number; y: number }, viewport: TUIState['viewport']): void {
    let x = pos.x + this.rowHeaderWidth + 1
    
    for (let col = 0; col < viewport.cols; col++) {
      const absoluteCol = viewport.startCol + col
      const colName = this.getColumnName(absoluteCol)
      const width = this.colWidths[col]
      
      // Draw header background
      buffer.fillRect(x, pos.y, width, 1, ' ', undefined, this.colors.headerBg)
      
      // Center the column name
      const padding = Math.floor((width - colName.length) / 2)
      buffer.setText(
        x + padding,
        pos.y,
        colName.slice(0, width),
        this.colors.headerFg,
        this.colors.headerBg
      )
      
      x += width + 1
    }
  }

  private renderRowHeader(buffer: OptimizedBuffer, x: number, y: number, row: number): void {
    const rowStr = (row + 1).toString()
    const padding = this.rowHeaderWidth - rowStr.length
    
    // Draw header background
    buffer.fillRect(x, y, this.rowHeaderWidth, 1, ' ', undefined, this.colors.headerBg)
    
    // Right-align the row number
    buffer.setText(
      x + padding,
      y,
      rowStr,
      this.colors.headerFg,
      this.colors.headerBg
    )
  }

  private renderCell(
    buffer: OptimizedBuffer,
    x: number,
    y: number,
    addr: CellAddress,
    width: number,
    fg: RGBA,
    bg?: RGBA
  ): void {
    // Clear cell area
    if (bg) {
      buffer.fillRect(x, y, width, 1, ' ', fg, bg)
    }

    // Get cell value
    const value = this.engine.getCellValue(addr)
    let displayValue = ''
    
    if (value !== null && value !== undefined) {
      displayValue = value.toString()
    }

    // Truncate or pad to fit width
    if (displayValue.length > width) {
      displayValue = displayValue.slice(0, width - 1) + '…'
    } else {
      displayValue = displayValue.padEnd(width, ' ')
    }

    buffer.setText(x, y, displayValue, fg, bg)
  }

  private renderGridLines(buffer: OptimizedBuffer, pos: { x: number; y: number }, viewport: TUIState['viewport']): void {
    // Vertical lines
    let x = pos.x + this.rowHeaderWidth
    for (let col = 0; col <= viewport.cols; col++) {
      for (let y = pos.y + 1; y < pos.y + viewport.rows + 2; y++) {
        buffer.setChar(x, y, '│', this.colors.gridLines)
      }
      if (col < viewport.cols) {
        x += this.colWidths[col] + 1
      }
    }

    // Horizontal lines
    const totalWidth = this.rowHeaderWidth + viewport.cols + 
      this.colWidths.slice(0, viewport.cols).reduce((sum, w) => sum + w, 0)
    
    // Header separator
    for (let x = pos.x; x < pos.x + totalWidth; x++) {
      buffer.setChar(x, pos.y + 1, '─', this.colors.gridLines)
    }

    // Intersections
    x = pos.x + this.rowHeaderWidth
    for (let col = 0; col <= viewport.cols; col++) {
      buffer.setChar(x, pos.y + 1, '┼', this.colors.gridLines)
      if (col < viewport.cols) {
        x += this.colWidths[col] + 1
      }
    }
  }

  private renderEditOverlay(buffer: OptimizedBuffer, pos: { x: number; y: number }, state: TUIState): void {
    const { cursor, viewport, editingValue } = state
    if (!editingValue) return

    // Calculate cell position
    const relRow = cursor.row - viewport.startRow
    const relCol = cursor.col - viewport.startCol
    
    if (relRow < 0 || relRow >= viewport.rows || relCol < 0 || relCol >= viewport.cols) {
      return // Cell not visible
    }

    let x = pos.x + this.rowHeaderWidth + 1
    for (let i = 0; i < relCol; i++) {
      x += this.colWidths[i] + 1
    }
    const y = pos.y + relRow + 2

    // Draw edit indicator
    const editBg = { r: 255, g: 128, b: 0, a: 255 }
    const width = this.colWidths[relCol]
    
    buffer.fillRect(x, y, width, 1, ' ', this.colors.cursorFg, editBg)
    
    // Show editing value with cursor
    let displayValue = editingValue + '█'
    if (displayValue.length > width) {
      displayValue = '…' + displayValue.slice(-(width - 1))
    }
    
    buffer.setText(x, y, displayValue, this.colors.cursorFg, editBg)
  }

  private getColumnName(col: number): string {
    let name = ''
    while (col >= 0) {
      name = String.fromCharCode(65 + (col % 26)) + name
      col = Math.floor(col / 26) - 1
    }
    return name
  }

  private isInSelection(cell: CellAddress, range?: { start: CellAddress; end: CellAddress }): boolean {
    if (!range) return false
    
    const minRow = Math.min(range.start.row, range.end.row)
    const maxRow = Math.max(range.start.row, range.end.row)
    const minCol = Math.min(range.start.col, range.end.col)
    const maxCol = Math.max(range.start.col, range.end.col)
    
    return cell.row >= minRow && cell.row <= maxRow &&
           cell.col >= minCol && cell.col <= maxCol
  }
}