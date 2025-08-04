import { test, expect, describe } from "bun:test"
import { TUIViewportManager } from "./TUIViewportManager"

describe("TUIViewportManager", () => {
  test("should initialize with default values", () => {
    const manager = new TUIViewportManager()
    
    expect(manager.getColumnWidth(0)).toBe(10)
    expect(manager.getRowHeight(0)).toBe(1)
    expect(manager.getTotalRows()).toBe(1000)
    expect(manager.getTotalCols()).toBe(100)
  })

  test("should initialize with custom config", () => {
    const manager = new TUIViewportManager({
      defaultColumnWidth: 15,
      defaultRowHeight: 2,
      minColumnWidth: 5,
      maxColumnWidth: 30,
    })
    
    expect(manager.getColumnWidth(0)).toBe(15)
    expect(manager.getRowHeight(0)).toBe(2)
  })

  test("should set and get column widths", () => {
    const manager = new TUIViewportManager()
    
    manager.setColumnWidth(0, 20)
    manager.setColumnWidth(5, 15)
    
    expect(manager.getColumnWidth(0)).toBe(20)
    expect(manager.getColumnWidth(5)).toBe(15)
    expect(manager.getColumnWidth(1)).toBe(10) // default
  })

  test("should clamp column widths to min/max", () => {
    const manager = new TUIViewportManager({
      minColumnWidth: 5,
      maxColumnWidth: 30,
    })
    
    manager.setColumnWidth(0, 2) // too small
    manager.setColumnWidth(1, 100) // too large
    
    expect(manager.getColumnWidth(0)).toBe(5)
    expect(manager.getColumnWidth(1)).toBe(30)
  })

  test("should delete column width when set to default", () => {
    const manager = new TUIViewportManager({ defaultColumnWidth: 10 })
    
    manager.setColumnWidth(0, 20)
    expect(manager.getCustomColumnWidths().size).toBe(1)
    
    manager.setColumnWidth(0, 10) // back to default
    expect(manager.getCustomColumnWidths().size).toBe(0)
  })

  test("should calculate visible columns", () => {
    const manager = new TUIViewportManager({ defaultColumnWidth: 10 })
    
    manager.setColumnWidth(1, 20)
    
    const visible = manager.calculateVisibleColumns(0, 45)
    expect(visible).toEqual([0, 1, 2]) // 10 + 20 + 10 = 40, next would exceed 45
  })

  test("should calculate visible rows", () => {
    const manager = new TUIViewportManager({ defaultRowHeight: 1 })
    
    manager.setRowHeight(2, 3)
    
    const visible = manager.calculateVisibleRows(0, 6)
    expect(visible).toEqual([0, 1, 2, 3]) // 1 + 1 + 3 + 1 = 6
  })

  test("should calculate column positions", () => {
    const manager = new TUIViewportManager({ defaultColumnWidth: 10 })
    
    manager.setColumnWidth(1, 20)
    
    expect(manager.getColumnPosition(0, 0)).toBe(0)
    expect(manager.getColumnPosition(1, 0)).toBe(10)
    expect(manager.getColumnPosition(2, 0)).toBe(30) // 10 + 20
    expect(manager.getColumnPosition(3, 0)).toBe(40) // 10 + 20 + 10
  })

  test("should handle scrolling", () => {
    const manager = new TUIViewportManager()
    
    manager.scrollTo(50, 10)
    expect(manager.getScrollPosition()).toEqual({ row: 50, col: 10 })
    
    manager.scrollTo(-10, 2000) // should clamp
    expect(manager.getScrollPosition()).toEqual({ row: 0, col: 99 })
  })

  test("should reset sizes", () => {
    const manager = new TUIViewportManager()
    
    manager.setColumnWidth(0, 20)
    manager.setRowHeight(0, 2)
    
    expect(manager.getCustomColumnWidths().size).toBe(1)
    expect(manager.getCustomRowHeights().size).toBe(1)
    
    manager.resetSizes()
    
    expect(manager.getCustomColumnWidths().size).toBe(0)
    expect(manager.getCustomRowHeights().size).toBe(0)
    expect(manager.getColumnWidth(0)).toBe(10) // back to default
    expect(manager.getRowHeight(0)).toBe(1) // back to default
  })

  test("should save and restore custom sizes", () => {
    const manager1 = new TUIViewportManager()
    manager1.setColumnWidth(0, 20)
    manager1.setColumnWidth(5, 15)
    manager1.setRowHeight(2, 3)
    
    const cols = manager1.getCustomColumnWidths()
    const rows = manager1.getCustomRowHeights()
    
    const manager2 = new TUIViewportManager()
    manager2.setCustomSizes(cols, rows)
    
    expect(manager2.getColumnWidth(0)).toBe(20)
    expect(manager2.getColumnWidth(5)).toBe(15)
    expect(manager2.getRowHeight(2)).toBe(3)
  })
})