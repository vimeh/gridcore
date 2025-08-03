import { Workbook } from "@gridcore/core";
import { CanvasGrid } from "./components/CanvasGrid";
import { FormulaBar } from "./components/FormulaBar";
import { ModeIndicator } from "./components/ModeIndicator";
import { TabBar } from "./components/TabBar";
import { SpreadsheetStateMachine } from "./state/SpreadsheetStateMachine";
import "./style.css";

// Initialize the app
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App container not found");
}

// Create app structure
app.innerHTML = `
  <div class="spreadsheet-app">
    <!-- <div class="app-header"> -->
    <!--   <h1>GridCore</h1> -->
    <!-- </div> -->
    <div class="formula-bar-container"></div>
    <div class="grid-container"></div>
    <div class="tab-bar-container"></div>
  </div>
`;

// Get containers
const formulaBarContainer = app.querySelector(
  ".formula-bar-container",
) as HTMLElement;
const gridContainer = app.querySelector(".grid-container") as HTMLElement;
const tabBarContainer = app.querySelector(".tab-bar-container") as HTMLElement;

// Grid dimensions configuration
const GRID_ROWS = 2000;
const GRID_COLS = 52; // A-Z, AA-AZ

// Create Workbook instance
const workbook = new Workbook();

// Get the engine for the active sheet
let engine = workbook.getActiveSheet().getEngine();

// Create state machine
const modeStateMachine = new SpreadsheetStateMachine();

// Add some sample data
engine.setCellByReference("A1", "Hello");
engine.setCellByReference("B1", "World");
engine.setCellByReference("A2", 42);
engine.setCellByReference("B2", 123);
engine.setCellByReference("C2", "=A2+B2", "=A2+B2");
engine.setCellByReference("D2", "=SUM(A2:B2)", "=SUM(A2:B2)");
engine.setCellByReference("E2", "=AVERAGE(A2:D2)", "=AVERAGE(A2:D2)");

// Add sample data for pivot table demo
engine.setCellByReference("A5", "Category");
engine.setCellByReference("B5", "Product");
engine.setCellByReference("C5", "Month");
engine.setCellByReference("D5", "Sales");
engine.setCellByReference("E5", "Quantity");

const sampleData = [
  ["Electronics", "Laptop", "January", 1200, 2],
  ["Electronics", "Phone", "January", 800, 3],
  ["Electronics", "Laptop", "February", 1500, 3],
  ["Furniture", "Chair", "January", 200, 5],
  ["Furniture", "Desk", "January", 500, 2],
  ["Furniture", "Chair", "February", 250, 6],
  ["Electronics", "Phone", "February", 900, 4],
];

sampleData.forEach((row, i) => {
  row.forEach((value, j) => {
    engine.setCell({ row: i + 6, col: j }, value);
  });
});

// Create a pivot table
// TODO: Fix pivot table - requires sourceColumn in valueFields
// engine.addPivotTable("demo-pivot", {
//   sourceRange: "A5:E12",
//   rowFields: ["Category"],
//   columnFields: ["Month"],
//   valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
//   showRowTotals: true,
//   showColumnTotals: true,
//   showGrandTotals: true
// }, { row: 14, col: 0 });

// Create Formula Bar
const formulaBar = new FormulaBar(formulaBarContainer, {
  onValueChange: (address, value) => {
    const sheetId = workbook.getActiveSheet().getId();
    if (value.startsWith("=")) {
      workbook.setCell(sheetId, address, value, value);
    } else {
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue) && value.trim() !== "") {
        workbook.setCell(sheetId, address, numValue);
      } else {
        workbook.setCell(sheetId, address, value);
      }
    }
  },
  onImport: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();

        if (file.name.endsWith(".json")) {
          // Import JSON format with workbook state
          try {
            const state = JSON.parse(text);

            // If it's a workbook state
            if (state.sheets && state.activeSheetId) {
              const newWorkbook = Workbook.fromState(state);

              // Replace the current workbook (need to update references)
              workbook.getAllSheets().forEach((sheet) => {
                workbook.removeSheet(sheet.getId());
              });

              // Add all sheets from imported workbook
              newWorkbook.getAllSheets().forEach((sheet) => {
                const newSheet = workbook.addSheet(sheet.getName());
                const sourceEngine = sheet.getEngine();
                const targetEngine = newSheet.getEngine();

                // Copy all cells
                const cells = sourceEngine.getAllCells();
                cells.forEach((cell, key) => {
                  const addr = sourceEngine.parseCellKey(key);
                  targetEngine.setCell(addr, cell.rawValue || "", cell.formula);
                });
              });

              // Set active sheet
              if (state.activeSheetId) {
                const sheets = workbook.getAllSheets();
                if (sheets.length > 0) {
                  workbook.setActiveSheet(sheets[0].getId());
                }
              }

              // Refresh UI
              tabBar.refresh();
              engine = workbook.getActiveSheet().getEngine();
              canvasGrid.destroy();
              canvasGrid = new CanvasGrid(gridContainer, engine, {
                totalRows: GRID_ROWS,
                totalCols: GRID_COLS,
                modeStateMachine,
              });
              grid = canvasGrid;
              canvasGrid.onCellClick = (cell) => {
                const cellData = engine.getCell(cell);
                formulaBar.setActiveCell(cell, cellData);
              };
              canvasGrid.render();
            } else {
              // Legacy single sheet format
              const newEngine = SpreadsheetEngine.fromState(state);

              // Clear current sheet and copy data
              engine.clear();
              const cells = newEngine.getAllCells();
              cells.forEach((cell, key) => {
                const addr = newEngine.parseCellKey(key);
                engine.setCell(addr, cell.rawValue || "", cell.formula);
              });

              // Apply view state
              if (state.view) {
                grid.setViewState(state.view);
              }
            }
          } catch (error) {
            console.error("Failed to import JSON:", error);
            alert("Failed to import file. Please check the format.");
          }
        } else {
          // Import CSV format
          const rows = text.split("\n").map((row) => row.split(","));
          engine.clear();
          rows.forEach((row, r) => {
            row.forEach((cellValue, c) => {
              engine.setCell({ row: r, col: c }, cellValue);
            });
          });
        }
      }
    };
    input.click();
  },
  onExport: () => {
    // Ask user for export format
    const format = confirm("Export as JSON (OK) or CSV (Cancel)?")
      ? "json"
      : "csv";

    if (format === "json") {
      // Export as JSON with workbook state
      const state = workbook.toState({
        includeMetadata: true,
        includeView: true,
      });

      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workbook.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Export as CSV
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
        csvContent += `${row.join(",")}\r\n`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const sheetName = workbook.getActiveSheet().getName();
      link.setAttribute("href", url);
      link.setAttribute("download", `${sheetName}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },
  onDebugToggle: (enabled) => {
    canvasGrid.setDebugMode(enabled);
  },
});

// Create Canvas Grid
let canvasGrid = new CanvasGrid(gridContainer, engine, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
  modeStateMachine,
});

// Create alias for grid (used in import/export)
let grid = canvasGrid;

// Create TabBar
const tabBar = new TabBar({
  container: tabBarContainer,
  workbook,
  onTabChange: (sheetId) => {
    // Update the active engine
    engine = workbook.getActiveSheet().getEngine();

    // Create new grid for the sheet
    canvasGrid.destroy();
    canvasGrid = new CanvasGrid(gridContainer, engine, {
      totalRows: GRID_ROWS,
      totalCols: GRID_COLS,
      modeStateMachine,
    });
    grid = canvasGrid;

    // Reconnect event handlers
    canvasGrid.onCellClick = (cell) => {
      const cellData = engine.getCell(cell);
      formulaBar.setActiveCell(cell, cellData);
    };

    // Re-set sheet navigation callbacks
    setupSheetNavigationCallbacks();

    // Re-render
    canvasGrid.render();

    // Update formula bar with current selection
    const selection = canvasGrid.getSelection();
    if (selection) {
      const cellData = engine.getCell(selection.start);
      formulaBar.setActiveCell(selection.start, cellData);
    }
  },
  onTabAdd: () => {
    // Sheet is already added by TabBar, just need to re-render
    tabBar.refresh();
  },
  onTabRemove: (sheetId) => {
    // Sheet is already removed by TabBar
    console.log(`Sheet ${sheetId} removed`);
  },
  onTabRename: (sheetId, newName) => {
    console.log(`Sheet ${sheetId} renamed to ${newName}`);
  },
  onTabReorder: (fromIndex, toIndex) => {
    console.log(`Sheet moved from ${fromIndex} to ${toIndex}`);
  },
});

// Connect grid selection to formula bar
canvasGrid.onCellClick = (cell) => {
  const cellData = engine.getCell(cell);
  formulaBar.setActiveCell(cell, cellData);
};

// Function to set up sheet navigation keyboard shortcuts
const setupSheetNavigationCallbacks = () => {
  canvasGrid.getKeyboardHandler().setSheetNavigationCallbacks({
    onNextSheet: () => {
      const sheets = workbook.getAllSheets();
      const currentIndex = sheets.findIndex(
        (s) => s.getId() === workbook.getActiveSheet().getId(),
      );
      if (currentIndex < sheets.length - 1) {
        const nextSheet = sheets[currentIndex + 1];
        workbook.setActiveSheet(nextSheet.getId());
        tabBar.refresh();
        tabBar.onTabChange?.(nextSheet.getId());
      }
    },
    onPreviousSheet: () => {
      const sheets = workbook.getAllSheets();
      const currentIndex = sheets.findIndex(
        (s) => s.getId() === workbook.getActiveSheet().getId(),
      );
      if (currentIndex > 0) {
        const prevSheet = sheets[currentIndex - 1];
        workbook.setActiveSheet(prevSheet.getId());
        tabBar.refresh();
        tabBar.onTabChange?.(prevSheet.getId());
      }
    },
    onNewSheet: () => {
      const newSheet = workbook.addSheet();
      workbook.setActiveSheet(newSheet.getId());
      tabBar.refresh();
      tabBar.onTabChange?.(newSheet.getId());
    },
  });
};

// Set up sheet navigation keyboard shortcuts
setupSheetNavigationCallbacks();

// Initialize formula bar with A1
const initialCell = { row: 0, col: 0 };
const initialCellData = engine.getCell(initialCell);
formulaBar.setActiveCell(initialCell, initialCellData);

// Listen for changes from the engine
engine.addEventListener((_event) => {
  canvasGrid.render();
});

// Handle window resize
window.addEventListener("resize", () => {
  canvasGrid.resize();
  canvasGrid.render();
});

// Create mode indicator
const _modeIndicator = new ModeIndicator(app, modeStateMachine);

// Initial focus
gridContainer.focus();
