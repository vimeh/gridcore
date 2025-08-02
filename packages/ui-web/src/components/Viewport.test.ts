import { describe, expect, test, beforeEach } from "bun:test";
import { Viewport } from "./Viewport";
import { defaultTheme } from "../rendering/GridTheme";

describe("Viewport Column/Row Management", () => {
  let viewport: Viewport;
  
  beforeEach(() => {
    viewport = new Viewport(defaultTheme, 100, 26);
  });

  test("getColumnWidth returns default width when not customized", () => {
    expect(viewport.getColumnWidth(0)).toBe(defaultTheme.defaultCellWidth);
    expect(viewport.getColumnWidth(5)).toBe(defaultTheme.defaultCellWidth);
  });

  test("setColumnWidth stores custom width", () => {
    viewport.setColumnWidth(0, 150);
    viewport.setColumnWidth(3, 200);
    
    expect(viewport.getColumnWidth(0)).toBe(150);
    expect(viewport.getColumnWidth(3)).toBe(200);
    expect(viewport.getColumnWidth(1)).toBe(defaultTheme.defaultCellWidth);
  });

  test("setColumnWidth clamps to min/max bounds", () => {
    viewport.setColumnWidth(0, 5); // Too small
    viewport.setColumnWidth(1, 1000); // Too large
    
    expect(viewport.getColumnWidth(0)).toBe(defaultTheme.minCellWidth);
    expect(viewport.getColumnWidth(1)).toBe(defaultTheme.maxCellWidth);
  });

  test("getRowHeight returns default height when not customized", () => {
    expect(viewport.getRowHeight(0)).toBe(defaultTheme.defaultCellHeight);
    expect(viewport.getRowHeight(10)).toBe(defaultTheme.defaultCellHeight);
  });

  test("setRowHeight stores custom height", () => {
    viewport.setRowHeight(0, 30);
    viewport.setRowHeight(5, 50);
    
    expect(viewport.getRowHeight(0)).toBe(30);
    expect(viewport.getRowHeight(5)).toBe(50);
    expect(viewport.getRowHeight(1)).toBe(defaultTheme.defaultCellHeight);
  });

  test("setRowHeight enforces minimum height", () => {
    viewport.setRowHeight(0, 10); // Too small
    expect(viewport.getRowHeight(0)).toBe(16); // Minimum height
  });

  test("getColumnWidths returns all custom widths", () => {
    viewport.setColumnWidth(0, 150);
    viewport.setColumnWidth(2, 200);
    viewport.setColumnWidth(5, 250);
    
    const widths = viewport.getColumnWidths();
    expect(widths).toEqual({
      0: 150,
      2: 200,
      5: 250
    });
  });

  test("getRowHeights returns all custom heights", () => {
    viewport.setRowHeight(1, 30);
    viewport.setRowHeight(3, 40);
    viewport.setRowHeight(10, 50);
    
    const heights = viewport.getRowHeights();
    expect(heights).toEqual({
      1: 30,
      3: 40,
      10: 50
    });
  });

  test("setColumnWidths sets multiple widths at once", () => {
    viewport.setColumnWidths({
      0: 100,
      1: 150,
      3: 200
    });
    
    expect(viewport.getColumnWidth(0)).toBe(100);
    expect(viewport.getColumnWidth(1)).toBe(150);
    expect(viewport.getColumnWidth(2)).toBe(defaultTheme.defaultCellWidth);
    expect(viewport.getColumnWidth(3)).toBe(200);
  });

  test("setRowHeights sets multiple heights at once", () => {
    viewport.setRowHeights({
      0: 25,
      2: 35,
      5: 45
    });
    
    expect(viewport.getRowHeight(0)).toBe(25);
    expect(viewport.getRowHeight(1)).toBe(defaultTheme.defaultCellHeight);
    expect(viewport.getRowHeight(2)).toBe(35);
    expect(viewport.getRowHeight(5)).toBe(45);
  });

  test("getTotalGridWidth accounts for custom column widths", () => {
    const defaultTotal = defaultTheme.defaultCellWidth * 26;
    expect(viewport.getTotalGridWidth()).toBe(defaultTotal);
    
    // Make some columns wider
    viewport.setColumnWidth(0, 150);
    viewport.setColumnWidth(1, 200);
    
    const expectedTotal = defaultTotal + (150 - defaultTheme.defaultCellWidth) + (200 - defaultTheme.defaultCellWidth);
    expect(viewport.getTotalGridWidth()).toBe(expectedTotal);
  });

  test("getTotalGridHeight accounts for custom row heights", () => {
    const defaultTotal = defaultTheme.defaultCellHeight * 100;
    expect(viewport.getTotalGridHeight()).toBe(defaultTotal);
    
    // Make some rows taller
    viewport.setRowHeight(0, 50);
    viewport.setRowHeight(1, 40);
    
    const expectedTotal = defaultTotal + (50 - defaultTheme.defaultCellHeight) + (40 - defaultTheme.defaultCellHeight);
    expect(viewport.getTotalGridHeight()).toBe(expectedTotal);
  });
});