import type { ViewportManager } from "@gridcore/ui-core"

export interface TUIViewportConfig {
  defaultColumnWidth?: number
  defaultRowHeight?: number
  minColumnWidth?: number
  minRowHeight?: number
  maxColumnWidth?: number
  maxRowHeight?: number
}

export class TUIViewportManager implements ViewportManager {
  private columnWidths: Map<number, number> = new Map()
  private rowHeights: Map<number, number> = new Map()
  private defaultColumnWidth: number
  private defaultRowHeight: number
  private minColumnWidth: number
  private minRowHeight: number
  private maxColumnWidth: number
  private maxRowHeight: number
  private totalRows: number
  private totalCols: number
  private currentScrollRow = 0
  private currentScrollCol = 0

  constructor(config: TUIViewportConfig = {}) {
    this.defaultColumnWidth = config.defaultColumnWidth ?? 10
    this.defaultRowHeight = config.defaultRowHeight ?? 1
    this.minColumnWidth = config.minColumnWidth ?? 3
    this.minRowHeight = config.minRowHeight ?? 1
    this.maxColumnWidth = config.maxColumnWidth ?? 50
    this.maxRowHeight = config.maxRowHeight ?? 5
    this.totalRows = 1000 // Default spreadsheet size
    this.totalCols = 100
  }

  getColumnWidth(index: number): number {
    return this.columnWidths.get(index) ?? this.defaultColumnWidth
  }

  setColumnWidth(index: number, width: number): void {
    const clampedWidth = Math.max(
      this.minColumnWidth,
      Math.min(this.maxColumnWidth, width)
    )
    if (clampedWidth === this.defaultColumnWidth) {
      this.columnWidths.delete(index)
    } else {
      this.columnWidths.set(index, clampedWidth)
    }
  }

  getRowHeight(index: number): number {
    return this.rowHeights.get(index) ?? this.defaultRowHeight
  }

  setRowHeight(index: number, height: number): void {
    const clampedHeight = Math.max(
      this.minRowHeight,
      Math.min(this.maxRowHeight, height)
    )
    if (clampedHeight === this.defaultRowHeight) {
      this.rowHeights.delete(index)
    } else {
      this.rowHeights.set(index, clampedHeight)
    }
  }

  getTotalRows(): number {
    return this.totalRows
  }

  getTotalCols(): number {
    return this.totalCols
  }

  scrollTo(row: number, col: number): void {
    this.currentScrollRow = Math.max(0, Math.min(row, this.totalRows - 1))
    this.currentScrollCol = Math.max(0, Math.min(col, this.totalCols - 1))
  }

  getScrollPosition(): { row: number; col: number } {
    return { row: this.currentScrollRow, col: this.currentScrollCol }
  }

  // Calculate how many columns fit in the given width
  calculateVisibleColumns(startCol: number, availableWidth: number): number[] {
    const visibleCols: number[] = []
    let currentWidth = 0
    let col = startCol

    while (currentWidth < availableWidth && col < this.totalCols) {
      const colWidth = this.getColumnWidth(col)
      if (currentWidth + colWidth <= availableWidth) {
        visibleCols.push(col)
        currentWidth += colWidth
      } else {
        break
      }
      col++
    }

    return visibleCols
  }

  // Calculate how many rows fit in the given height
  calculateVisibleRows(startRow: number, availableHeight: number): number[] {
    const visibleRows: number[] = []
    let currentHeight = 0
    let row = startRow

    while (currentHeight < availableHeight && row < this.totalRows) {
      const rowHeight = this.getRowHeight(row)
      if (currentHeight + rowHeight <= availableHeight) {
        visibleRows.push(row)
        currentHeight += rowHeight
      } else {
        break
      }
      row++
    }

    return visibleRows
  }

  // Get column position (x coordinate) for rendering
  getColumnPosition(index: number, startCol: number): number {
    let position = 0
    for (let col = startCol; col < index; col++) {
      position += this.getColumnWidth(col)
    }
    return position
  }

  // Get row position (y coordinate) for rendering
  getRowPosition(index: number, startRow: number): number {
    let position = 0
    for (let row = startRow; row < index; row++) {
      position += this.getRowHeight(row)
    }
    return position
  }

  // Reset all custom sizes
  resetSizes(): void {
    this.columnWidths.clear()
    this.rowHeights.clear()
  }

  // Get all custom column widths (for persistence)
  getCustomColumnWidths(): Map<number, number> {
    return new Map(this.columnWidths)
  }

  // Get all custom row heights (for persistence)
  getCustomRowHeights(): Map<number, number> {
    return new Map(this.rowHeights)
  }

  // Set custom sizes from saved data
  setCustomSizes(
    columnWidths: Map<number, number>,
    rowHeights: Map<number, number>
  ): void {
    this.columnWidths = new Map(columnWidths)
    this.rowHeights = new Map(rowHeights)
  }
}