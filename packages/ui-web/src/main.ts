import { Grid } from '@gridcore/core';
import { CanvasGrid } from './components/CanvasGrid';
import { FormulaBar } from './components/FormulaBar';
import './style.css';

// Initialize the app
const app = document.querySelector<HTMLDivElement>('#app')!;

// Create app structure
app.innerHTML = `
  <div class="spreadsheet-app">
    <!-- <div class="app-header"> -->
    <!--   <h1>GridCore</h1> -->
    <!-- </div> -->
    <div class="formula-bar-container"></div>
    <div class="grid-container"></div>
  </div>
`;

// Get containers
const formulaBarContainer = app.querySelector('.formula-bar-container') as HTMLElement;
const gridContainer = app.querySelector('.grid-container') as HTMLElement;

// Grid dimensions configuration
const GRID_ROWS = 2000;
const GRID_COLS = 52; // A-Z, AA-AZ

// Create Grid instance
const grid = new Grid(GRID_ROWS, GRID_COLS);

// Add some sample data
grid.setCellByReference('A1', 'Hello');
grid.setCellByReference('B1', 'World');
grid.setCellByReference('A2', 42);
grid.setCellByReference('B2', 123);
grid.setCellByReference('C2', '=A2+B2', '=A2+B2');

// Create Formula Bar
const formulaBar = new FormulaBar(formulaBarContainer, {
  onValueChange: (address, value) => {
    if (value.startsWith('=')) {
      grid.setCell(address, value, value);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        grid.setCell(address, numValue);
      } else {
        grid.setCell(address, value);
      }
    }
    canvasGrid.render();
  }
});

// Create Canvas Grid
const canvasGrid = new CanvasGrid(gridContainer, grid, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS
});

// Connect grid selection to formula bar
canvasGrid.onCellClick = function(cell) {
  const cellData = grid.getCell(cell);
  formulaBar.setActiveCell(cell, cellData);
};

// Initialize formula bar with A1
const initialCell = { row: 0, col: 0 };
const initialCellData = grid.getCell(initialCell);
formulaBar.setActiveCell(initialCell, initialCellData);

// Handle window resize
window.addEventListener('resize', () => {
  canvasGrid.resize();
  canvasGrid.render();
});

// Initial focus
gridContainer.focus();
