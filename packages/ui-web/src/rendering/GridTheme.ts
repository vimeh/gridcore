export interface GridTheme {
  // Cell dimensions
  defaultCellWidth: number;
  defaultCellHeight: number;
  minCellWidth: number;
  maxCellWidth: number;
  
  // Headers
  rowHeaderWidth: number;
  columnHeaderHeight: number;
  
  // Colors
  backgroundColor: string;
  gridLineColor: string;
  cellBackgroundColor: string;
  selectedCellBackgroundColor: string;
  selectedRangeBackgroundColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  cellTextColor: string;
  
  // Fonts
  cellFontFamily: string;
  cellFontSize: number;
  headerFontFamily: string;
  headerFontSize: number;
  
  // Borders and spacing
  gridLineWidth: number;
  cellPaddingLeft: number;
  cellPaddingTop: number;
}

export const defaultTheme: GridTheme = {
  // Cell dimensions
  defaultCellWidth: 100,
  defaultCellHeight: 24,
  minCellWidth: 40,
  maxCellWidth: 500,
  
  // Headers
  rowHeaderWidth: 50,
  columnHeaderHeight: 24,
  
  // Colors
  backgroundColor: '#ffffff',
  gridLineColor: '#e0e0e0',
  cellBackgroundColor: '#ffffff',
  selectedCellBackgroundColor: '#e3f2fd',
  selectedRangeBackgroundColor: 'rgba(66, 165, 245, 0.1)',
  headerBackgroundColor: '#f5f5f5',
  headerTextColor: '#666666',
  cellTextColor: '#000000',
  
  // Fonts
  cellFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  cellFontSize: 13,
  headerFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headerFontSize: 12,
  
  // Borders and spacing
  gridLineWidth: 1,
  cellPaddingLeft: 4,
  cellPaddingTop: 4,
};