import { describe, expect, test, beforeEach } from "bun:test"
import { Viewport } from "./Viewport"
import { GridTheme } from "../rendering/GridTheme"

describe("Viewport", () => {
  let viewport: Viewport
  let theme: GridTheme

  beforeEach(() => {
    theme = new GridTheme()
    viewport = new Viewport(theme, 1000, 100)
  })

  describe("constructor and basic getters", () => {
    test("should initialize with default values", () => {
      const defaultViewport = new Viewport(theme)
      expect(defaultViewport.getTotalRows()).toBe(1000000)
      expect(defaultViewport.getTotalCols()).toBe(26)
    })

    test("should initialize with custom values", () => {
      expect(viewport.getTotalRows()).toBe(1000)
      expect(viewport.getTotalCols()).toBe(100)
    })
  })

  describe("viewport size", () => {
    test("should set viewport size", () => {
      viewport.setViewportSize(800, 600)
      // Verify through scroll behavior
      viewport.scrollBy(1000, 1000)
      const pos = viewport.getScrollPosition()
      expect(pos.x).toBeLessThan(1000)
      expect(pos.y).toBeLessThan(1000)
    })
  })

  describe("scroll position", () => {
    test("should set and get scroll position", () => {
      viewport.setScrollPosition(100, 200)
      const pos = viewport.getScrollPosition()
      expect(pos.x).toBe(100)
      expect(pos.y).toBe(200)
    })

    test("should return a copy of scroll position", () => {
      viewport.setScrollPosition(100, 200)
      const pos1 = viewport.getScrollPosition()
      const pos2 = viewport.getScrollPosition()
      expect(pos1).not.toBe(pos2)
      expect(pos1).toEqual(pos2)
    })
  })

  describe("scrollBy", () => {
    beforeEach(() => {
      viewport.setViewportSize(800, 600)
    })

    test("should scroll by delta", () => {
      viewport.setScrollPosition(100, 100)
      viewport.scrollBy(50, 75)
      const pos = viewport.getScrollPosition()
      expect(pos.x).toBe(150)
      expect(pos.y).toBe(175)
    })

    test("should not scroll below zero", () => {
      viewport.setScrollPosition(10, 10)
      viewport.scrollBy(-50, -50)
      const pos = viewport.getScrollPosition()
      expect(pos.x).toBe(0)
      expect(pos.y).toBe(0)
    })

    test("should not scroll beyond max", () => {
      viewport.scrollBy(100000, 100000)
      const pos = viewport.getScrollPosition()
      const totalWidth = viewport.getTotalGridWidth()
      const totalHeight = viewport.getTotalGridHeight()
      expect(pos.x).toBe(Math.max(0, totalWidth - 800))
      expect(pos.y).toBe(Math.max(0, totalHeight - 600))
    })
  })

  describe("scrollToCell", () => {
    beforeEach(() => {
      viewport.setViewportSize(400, 300)
    })

    test("should scroll to cell - center position", () => {
      viewport.scrollToCell({ row: 20, col: 10 }, "center")
      const pos = viewport.getScrollPosition()
      // Cell should be centered in viewport
      expect(pos.x).toBeGreaterThan(0)
      expect(pos.y).toBeGreaterThan(0)
    })

    test("should scroll to cell - top position", () => {
      viewport.scrollToCell({ row: 20, col: 10 }, "top")
      const cellPos = viewport.getCellPosition({ row: 20, col: 10 })
      const scrollPos = viewport.getScrollPosition()
      // Cell should be at top of viewport
      expect(cellPos.y).toBe(0)
    })

    test("should scroll to cell - bottom position", () => {
      viewport.scrollToCell({ row: 20, col: 10 }, "bottom")
      const cellPos = viewport.getCellPosition({ row: 20, col: 10 })
      // Cell should be at bottom of viewport
      expect(cellPos.y + cellPos.height).toBe(300)
    })

    test("should ensure horizontal visibility when scrolling to cell", () => {
      // Scroll far to the right
      viewport.setScrollPosition(1000, 0)
      viewport.scrollToCell({ row: 0, col: 0 })
      const pos = viewport.getScrollPosition()
      expect(pos.x).toBe(0)
    })

    test("should handle cell at right edge", () => {
      viewport.setScrollPosition(0, 0)
      viewport.scrollToCell({ row: 0, col: 50 })
      const cellPos = viewport.getCellPosition({ row: 0, col: 50 })
      expect(cellPos.x).toBeLessThan(400)
      expect(cellPos.x + cellPos.width).toBeLessThanOrEqual(400)
    })

    test("should respect scroll bounds", () => {
      // Try to scroll to last cell
      viewport.scrollToCell({ row: 999, col: 99 })
      const pos = viewport.getScrollPosition()
      const totalWidth = viewport.getTotalGridWidth()
      const totalHeight = viewport.getTotalGridHeight()
      expect(pos.x).toBeLessThanOrEqual(Math.max(0, totalWidth - 400))
      expect(pos.y).toBeLessThanOrEqual(Math.max(0, totalHeight - 300))
    })
  })

  describe("getPageSize", () => {
    test("should return visible rows and columns count", () => {
      viewport.setViewportSize(400, 300)
      const pageSize = viewport.getPageSize()
      expect(pageSize.rows).toBeGreaterThan(0)
      expect(pageSize.cols).toBeGreaterThan(0)
    })
  })

  describe("column and row dimensions", () => {
    test("should get default column width", () => {
      expect(viewport.getColumnWidth(0)).toBe(theme.defaultCellWidth)
    })

    test("should set and get custom column width", () => {
      viewport.setColumnWidth(5, 150)
      expect(viewport.getColumnWidth(5)).toBe(150)
    })

    test("should clamp column width to min/max", () => {
      viewport.setColumnWidth(0, 5)
      expect(viewport.getColumnWidth(0)).toBe(theme.minCellWidth)
      
      viewport.setColumnWidth(1, 5000)
      expect(viewport.getColumnWidth(1)).toBe(theme.maxCellWidth)
    })

    test("should get default row height", () => {
      expect(viewport.getRowHeight(0)).toBe(theme.defaultCellHeight)
    })

    test("should set and get custom row height", () => {
      viewport.setRowHeight(5, 50)
      expect(viewport.getRowHeight(5)).toBe(50)
    })

    test("should enforce minimum row height", () => {
      viewport.setRowHeight(0, 5)
      expect(viewport.getRowHeight(0)).toBe(16)
    })
  })

  describe("getVisibleBounds", () => {
    beforeEach(() => {
      viewport.setViewportSize(400, 300)
    })

    test("should calculate visible bounds at origin", () => {
      viewport.setScrollPosition(0, 0)
      const bounds = viewport.getVisibleBounds()
      expect(bounds.startRow).toBe(0)
      expect(bounds.startCol).toBe(0)
      expect(bounds.endRow).toBeGreaterThan(0)
      expect(bounds.endCol).toBeGreaterThan(0)
    })

    test("should calculate visible bounds when scrolled", () => {
      viewport.setScrollPosition(200, 200)
      const bounds = viewport.getVisibleBounds()
      expect(bounds.startRow).toBeGreaterThan(0)
      expect(bounds.startCol).toBeGreaterThan(0)
    })

    test("should handle bottom edge correctly", () => {
      // Scroll to bottom
      const totalHeight = viewport.getTotalGridHeight()
      viewport.setScrollPosition(0, totalHeight - 300)
      const bounds = viewport.getVisibleBounds()
      expect(bounds.endRow).toBe(1000)
    })

    test("should handle right edge correctly", () => {
      // Scroll to right
      const totalWidth = viewport.getTotalGridWidth()
      viewport.setScrollPosition(totalWidth - 400, 0)
      const bounds = viewport.getVisibleBounds()
      expect(bounds.endCol).toBe(100)
    })

    test("should handle custom dimensions", () => {
      // Set some custom widths and heights
      viewport.setColumnWidth(0, 200)
      viewport.setRowHeight(0, 100)
      
      const bounds = viewport.getVisibleBounds()
      // With larger first column and row, fewer should be visible
      expect(bounds.endCol).toBeLessThan(10)
      expect(bounds.endRow).toBeLessThan(20)
    })
  })

  describe("getCellPosition", () => {
    test("should get cell position at origin", () => {
      const pos = viewport.getCellPosition({ row: 0, col: 0 })
      expect(pos.x).toBe(0)
      expect(pos.y).toBe(0)
      expect(pos.width).toBe(theme.defaultCellWidth)
      expect(pos.height).toBe(theme.defaultCellHeight)
    })

    test("should get cell position with scroll", () => {
      viewport.setScrollPosition(50, 100)
      const pos = viewport.getCellPosition({ row: 0, col: 0 })
      expect(pos.x).toBe(-50)
      expect(pos.y).toBe(-100)
    })

    test("should account for custom dimensions", () => {
      viewport.setColumnWidth(0, 150)
      viewport.setRowHeight(0, 50)
      const pos = viewport.getCellPosition({ row: 1, col: 1 })
      expect(pos.x).toBe(150)
      expect(pos.y).toBe(50)
    })
  })

  describe("getCellAtPosition", () => {
    test("should get cell at position", () => {
      const cell = viewport.getCellAtPosition(50, 10)
      expect(cell).toEqual({ row: 0, col: 0 })
    })

    test("should return null for out of bounds position", () => {
      const cell = viewport.getCellAtPosition(100000, 100000)
      expect(cell).toBeNull()
    })

    test("should account for scroll position", () => {
      viewport.setScrollPosition(100, 100)
      const cell = viewport.getCellAtPosition(0, 0)
      expect(cell).not.toEqual({ row: 0, col: 0 })
    })

    test("should handle custom dimensions", () => {
      viewport.setColumnWidth(0, 200)
      viewport.setRowHeight(0, 100)
      
      const cell1 = viewport.getCellAtPosition(150, 50)
      expect(cell1).toEqual({ row: 0, col: 0 })
      
      const cell2 = viewport.getCellAtPosition(250, 150)
      expect(cell2).toEqual({ row: 1, col: 1 })
    })
  })

  describe("total grid dimensions", () => {
    test("should calculate total grid width", () => {
      const width = viewport.getTotalGridWidth()
      expect(width).toBe(100 * theme.defaultCellWidth)
    })

    test("should calculate total grid height", () => {
      const height = viewport.getTotalGridHeight()
      expect(height).toBe(1000 * theme.defaultCellHeight)
    })

    test("should account for custom dimensions", () => {
      viewport.setColumnWidth(0, 200)
      viewport.setRowHeight(0, 100)
      
      const width = viewport.getTotalGridWidth()
      const height = viewport.getTotalGridHeight()
      
      expect(width).toBe(200 + 99 * theme.defaultCellWidth)
      expect(height).toBe(100 + 999 * theme.defaultCellHeight)
    })
  })

  describe("bulk dimension operations", () => {
    test("should get all custom column widths", () => {
      viewport.setColumnWidth(5, 150)
      viewport.setColumnWidth(10, 200)
      
      const widths = viewport.getColumnWidths()
      expect(widths).toEqual({ 5: 150, 10: 200 })
    })

    test("should get all custom row heights", () => {
      viewport.setRowHeight(3, 50)
      viewport.setRowHeight(7, 75)
      
      const heights = viewport.getRowHeights()
      expect(heights).toEqual({ 3: 50, 7: 75 })
    })

    test("should set multiple column widths", () => {
      viewport.setColumnWidths({ 1: 100, 2: 150, 3: 200 })
      
      expect(viewport.getColumnWidth(1)).toBe(100)
      expect(viewport.getColumnWidth(2)).toBe(150)
      expect(viewport.getColumnWidth(3)).toBe(200)
    })

    test("should set multiple row heights", () => {
      viewport.setRowHeights({ 1: 30, 2: 40, 3: 50 })
      
      expect(viewport.getRowHeight(1)).toBe(30)
      expect(viewport.getRowHeight(2)).toBe(40)
      expect(viewport.getRowHeight(3)).toBe(50)
    })
  })
})