import {
  cellAddressToString,
  parseCellAddress,
  Workbook,
} from "@gridcore/core";
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

// Get the facade for the active sheet
let activeSheet = workbook.getActiveSheet();
if (!activeSheet) {
  throw new Error("No active sheet found");
}
let facade = activeSheet.getFacade();

// Create state machine
const modeStateMachine = new SpreadsheetStateMachine();

// Add some sample data
const a1 = parseCellAddress("A1");
const b1 = parseCellAddress("B1");
const a2 = parseCellAddress("A2");
const b2 = parseCellAddress("B2");
const c2 = parseCellAddress("C2");
const d2 = parseCellAddress("D2");
const e2 = parseCellAddress("E2");

if (a1) facade.setCellValue(a1, "Hello");
if (b1) facade.setCellValue(b1, "World");
if (a2) facade.setCellValue(a2, 42);
if (b2) facade.setCellValue(b2, 123);
if (c2) facade.setCellValue(c2, "=A2+B2");
if (d2) facade.setCellValue(d2, "=SUM(A2:B2)");
if (e2) facade.setCellValue(e2, "=AVERAGE(A2:D2)");

// Add sample data for pivot table demo
const a5 = parseCellAddress("A5");
const b5 = parseCellAddress("B5");
const c5 = parseCellAddress("C5");
const d5 = parseCellAddress("D5");
const e5 = parseCellAddress("E5");

if (a5) facade.setCellValue(a5, "Category");
if (b5) facade.setCellValue(b5, "Product");
if (c5) facade.setCellValue(c5, "Month");
if (d5) facade.setCellValue(d5, "Sales");
if (e5) facade.setCellValue(e5, "Quantity");

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
    const addr = parseCellAddress(cellAddressToString({ row: i + 6, col: j }));
    if (addr) {
      facade.setCellValue(addr, value);
    }
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
    const activeSheet = workbook.getActiveSheet();
    if (!activeSheet) return;

    const facade = activeSheet.getFacade();
    const cellAddr = parseCellAddress(cellAddressToString(address));
    if (!cellAddr) return;

    facade.setCellValue(cellAddr, value);
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
            const _state = JSON.parse(text);

            // TODO: Implement workbook JSON import
            alert("JSON import not yet implemented for new architecture");
          } catch (error) {
            console.error("Failed to import JSON:", error);
            alert("Failed to import file. Please check the format.");
          }
        } else {
          // Import CSV format
          const rows = text.split("\n").map((row) => row.split(","));
          // TODO: Add clear functionality to facade
          rows.forEach((row, r) => {
            row.forEach((cellValue, c) => {
              const addr = parseCellAddress(
                cellAddressToString({ row: r, col: c }),
              );
              if (addr) {
                facade.setCellValue(addr, cellValue);
              }
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
      // TODO: Implement JSON export for new architecture
      alert("JSON export not yet implemented for new architecture");
      return;
    } else {
      // Export as CSV
      let csvContent = "";
      let maxRow = 0;
      let maxCol = 0;

      // Find the bounds of the data
      for (let i = 0; i < GRID_ROWS; i++) {
        for (let j = 0; j < GRID_COLS; j++) {
          const addr = parseCellAddress(
            cellAddressToString({ row: i, col: j }),
          );
          if (addr) {
            const cellResult = facade.getCell(addr);
            if (cellResult.ok && cellResult.value.value !== undefined) {
              maxRow = Math.max(maxRow, i);
              maxCol = Math.max(maxCol, j);
            }
          }
        }
      }

      for (let i = 0; i <= maxRow; i++) {
        const row = [];
        for (let j = 0; j <= maxCol; j++) {
          const addr = parseCellAddress(
            cellAddressToString({ row: i, col: j }),
          );
          let value = "";
          if (addr) {
            const cellResult = facade.getCell(addr);
            if (cellResult.ok) {
              value = cellResult.value.value?.toString() ?? "";
            }
          }
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
let canvasGrid = new CanvasGrid(gridContainer, facade, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
  modeStateMachine,
});

// Create alias for grid (used in import/export)
let _grid = canvasGrid;

// Create TabBar
const tabBar = new TabBar({
  container: tabBarContainer,
  workbook,
  onTabChange: (_sheetId) => {
    // Update the active facade
    activeSheet = workbook.getActiveSheet();
    if (!activeSheet) return;
    facade = activeSheet.getFacade();

    // Create new grid for the sheet
    canvasGrid.destroy();
    canvasGrid = new CanvasGrid(gridContainer, facade, {
      totalRows: GRID_ROWS,
      totalCols: GRID_COLS,
      modeStateMachine,
    });
    _grid = canvasGrid;

    // Reconnect event handlers
    canvasGrid.onCellClick = (cell) => {
      const cellAddr = parseCellAddress(cellAddressToString(cell));
      if (cellAddr) {
        const cellResult = facade.getCell(cellAddr);
        if (cellResult.ok) {
          formulaBar.setActiveCell(cell, cellResult.value);
        }
      }
    };

    // Re-set sheet navigation callbacks
    setupSheetNavigationCallbacks();

    // Re-render
    canvasGrid.render();

    // Update formula bar with current selection
    const selection = canvasGrid.getSelection();
    if (selection) {
      const cellAddr = parseCellAddress(cellAddressToString(selection.start));
      if (cellAddr) {
        const cellResult = facade.getCell(cellAddr);
        if (cellResult.ok) {
          formulaBar.setActiveCell(selection.start, cellResult.value);
        }
      }
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
  const cellAddr = parseCellAddress(cellAddressToString(cell));
  if (cellAddr) {
    const cellResult = facade.getCell(cellAddr);
    if (cellResult.ok) {
      formulaBar.setActiveCell(cell, cellResult.value);
    }
  }
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
const initialCellAddr = parseCellAddress(cellAddressToString(initialCell));
if (initialCellAddr) {
  const initialCellResult = facade.getCell(initialCellAddr);
  if (initialCellResult.ok) {
    formulaBar.setActiveCell(initialCell, initialCellResult.value);
  }
}

// Listen for changes from the facade
const eventService = facade.getEventService();
eventService.on("CellValueChanged", () => {
  canvasGrid.render();
});
eventService.on("CellCalculated", () => {
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
