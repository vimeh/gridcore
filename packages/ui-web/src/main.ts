import { Grid } from "@gridcore/core";
import { CanvasGrid } from "./components/CanvasGrid";
import { FormulaBar } from "./components/FormulaBar";
import "./style.css";

// Initialize the app
const app = document.querySelector<HTMLDivElement>("#app")!;

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
const formulaBarContainer = app.querySelector(
  ".formula-bar-container",
) as HTMLElement;
const gridContainer = app.querySelector(".grid-container") as HTMLElement;

// Grid dimensions configuration
const GRID_ROWS = 2000;
const GRID_COLS = 52; // A-Z, AA-AZ

// Create Grid instance
const grid = new Grid(GRID_ROWS, GRID_COLS);

// Add some sample data
grid.setCellByReference("A1", "Hello");
grid.setCellByReference("B1", "World");
grid.setCellByReference("A2", 42);
grid.setCellByReference("B2", 123);
grid.setCellByReference("C2", "=A2+B2", "=A2+B2");

// Create Formula Bar
const formulaBar = new FormulaBar(formulaBarContainer, {
  onValueChange: (address, value) => {
    if (value.startsWith("=")) {
      grid.setCell(address, value, value);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== "") {
        grid.setCell(address, numValue);
      } else {
        grid.setCell(address, value);
      }
    }
    canvasGrid.render();
  },
  onImport: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const rows = text.split("\n").map((row) => row.split(","));
        grid.clear();
        rows.forEach((row, r) => {
          row.forEach((cellValue, c) => {
            grid.setCell({ row: r, col: c }, cellValue);
          });
        });
        canvasGrid.render();
      }
    };
    input.click();
  },
  onExport: () => {
    const data = grid.getAllCells();
    let csvContent = "";

    const keys = Array.from(data.keys());
    if (keys.length === 0) {
      return;
    }

    const addresses = keys.map((key) => grid.parseCellKey(key));
    const maxRow = Math.max(...addresses.map((addr) => addr.row));
    const maxCol = Math.max(...addresses.map((addr) => addr.col));

    for (let i = 0; i <= maxRow; i++) {
      const row = [];
      for (let j = 0; j <= maxCol; j++) {
        const cell = grid.getCell({ row: i, col: j });
        const value = cell?.rawValue ?? "";
        // Escape commas and quotes
        const escapedValue =
          String(value).includes(",") || String(value).includes('"')
            ? `"${String(value).replace(/"/g, '""')}"`
            : value;
        row.push(escapedValue);
      }
      csvContent += row.join(",") + "\r\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "spreadsheet.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
});

// Create Canvas Grid
const canvasGrid = new CanvasGrid(gridContainer, grid, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
});

// Connect grid selection to formula bar
canvasGrid.onCellClick = function (cell) {
  const cellData = grid.getCell(cell);
  formulaBar.setActiveCell(cell, cellData);
};

// Initialize formula bar with A1
const initialCell = { row: 0, col: 0 };
const initialCellData = grid.getCell(initialCell);
formulaBar.setActiveCell(initialCell, initialCellData);

// Handle window resize
window.addEventListener("resize", () => {
  canvasGrid.resize();
  canvasGrid.render();
});

// Initial focus
gridContainer.focus();
