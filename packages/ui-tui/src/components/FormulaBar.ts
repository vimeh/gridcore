import { Renderable, OptimizedBuffer, type RGBA } from '../framework'
import type { SpreadsheetEngine } from '@gridcore/core'
import type { TUIState } from '../SpreadsheetTUI'

export class FormulaBarComponent extends Renderable {
  private colors = {
    bg: { r: 24, g: 24, b: 24, a: 255 },
    fg: { r: 255, g: 255, b: 255, a: 255 },
    cellRef: { r: 100, g: 200, b: 255, a: 255 },
    separator: { r: 64, g: 64, b: 64, a: 255 },
    formula: { r: 200, g: 255, b: 200, a: 255 },
    editing: { r: 255, g: 200, b: 100, a: 255 }
  }

  constructor(
    private engine: SpreadsheetEngine,
    private getState: () => TUIState
  ) {
    super('formulaBar')
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState()
    const { cursor, mode, editingValue } = state
    const pos = this.getAbsolutePosition()

    // Clear the formula bar area
    buffer.fillRect(pos.x, pos.y, this.width, this.height, ' ', this.colors.fg, this.colors.bg)

    // Draw the cell reference
    const cellRef = this.getCellReference(cursor.col, cursor.row)
    buffer.setText(pos.x + 2, pos.y, cellRef, this.colors.cellRef, this.colors.bg)

    // Draw separator
    buffer.setText(pos.x + 8, pos.y, '│', this.colors.separator, this.colors.bg)

    // Get the current cell value or formula
    let displayValue = ''
    let valueColor = this.colors.fg

    if (mode === 'edit' && editingValue !== undefined) {
      displayValue = editingValue
      valueColor = this.colors.editing
      // Add cursor for editing mode
      displayValue += '█'
    } else {
      const cellValue = this.engine.getCellValue(cursor)
      const cellFormula = this.engine.getCellFormula(cursor)
      
      if (cellFormula) {
        displayValue = cellFormula
        valueColor = this.colors.formula
      } else if (cellValue !== null && cellValue !== undefined) {
        displayValue = cellValue.toString()
      }
    }

    // Truncate if too long
    const maxWidth = this.width - 12
    if (displayValue.length > maxWidth) {
      displayValue = displayValue.slice(0, maxWidth - 1) + '…'
    }

    // Draw the value/formula
    buffer.setText(pos.x + 10, pos.y, displayValue, valueColor, this.colors.bg)

    // Draw bottom border
    if (this.height > 1) {
      for (let x = pos.x; x < pos.x + this.width; x++) {
        buffer.setChar(x, pos.y + 1, '─', this.colors.separator)
      }
    }
  }

  private getCellReference(col: number, row: number): string {
    let colName = ''
    let tempCol = col
    
    while (tempCol >= 0) {
      colName = String.fromCharCode(65 + (tempCol % 26)) + colName
      tempCol = Math.floor(tempCol / 26) - 1
    }
    
    return colName + (row + 1)
  }
}