import { SpreadsheetEngine } from "@gridcore/core";
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

// Create SpreadsheetEngine instance
const engine = new SpreadsheetEngine(GRID_ROWS, GRID_COLS);

// Add some sample data
engine.setCellByReference("A1", "Hello");
engine.setCellByReference("B1", "World");
engine.setCellByReference("A2", 42);
engine.setCellByReference("B2", 123);
engine.setCellByReference("C2", "=A2+B2", "=A2+B2");
engine.setCellByReference("D2", "=SUM(A2:B2)", "=SUM(A2:B2)");
engine.setCellByReference("E2", "=AVERAGE(A2:D2)", "=AVERAGE(A2:D2)");

// Create Formula Bar
const formulaBar = new FormulaBar(formulaBarContainer, {
  onValueChange: (address, value) => {
    if (value.startsWith("=")) {
      engine.setCell(address, value, value);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== "") {
        engine.setCell(address, numValue);
      } else {
        engine.setCell(address, value);
      }
    }
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
        engine.clear();
        rows.forEach((row, r) => {
          row.forEach((cellValue, c) => {
            engine.setCell({ row: r, col: c }, cellValue);
          });
        });
      }
    };
    input.click();
  },
  onExport: () => {
    const data = engine.getAllCells();
    let csvContent = "";

    const keys = Array.from(data.keys());
    if (keys.length === 0) {
      return;
    }

    const addresses = keys.map((key) => engine.parseCellKey(key));
    const maxRow = Math.max(...addresses.map((addr) => addr.row));
    const maxCol = Math.max(...addresses.map((addr) => addr.col));

    for (let i = 0; i <= maxRow; i++) {
      const row = [];
      for (let j = 0; j <= maxCol; j++) {
        const cell = engine.getCell({ row: i, col: j });
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
const canvasGrid = new CanvasGrid(gridContainer, engine, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
});

// Connect grid selection to formula bar
canvasGrid.onCellClick = function (cell) {
  const cellData = engine.getCell(cell);
  formulaBar.setActiveCell(cell, cellData);
};

// Initialize formula bar with A1
const initialCell = { row: 0, col: 0 };
const initialCellData = engine.getCell(initialCell);
formulaBar.setActiveCell(initialCell, initialCellData);

// Listen for changes from the engine
engine.addEventListener((event) => {
  canvasGrid.render();
});

// Handle window resize
window.addEventListener("resize", () => {
  canvasGrid.resize();
  canvasGrid.render();
});

// Initial focus
gridContainer.focus();
