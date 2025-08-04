import { CellAddress, Workbook } from "@gridcore/core";
import { SpreadsheetController, type ViewportManager } from "@gridcore/ui-core";
import { CanvasGrid } from "./components/CanvasGrid";
import { FormulaBar } from "./components/FormulaBar";
import { ModeIndicator } from "./components/ModeIndicator";
import { TabBar } from "./components/TabBar";
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

// Create a ViewportManager that will be shared between controller and CanvasGrid
let viewportManager: ViewportManager | null = null;

// Add some sample data
const a1Result = CellAddress.fromString("A1");
const b1Result = CellAddress.fromString("B1");
const a2Result = CellAddress.fromString("A2");
const b2Result = CellAddress.fromString("B2");
const c2Result = CellAddress.fromString("C2");
const d2Result = CellAddress.fromString("D2");
const e2Result = CellAddress.fromString("E2");

const a1 = a1Result.ok ? a1Result.value : null;
const b1 = b1Result.ok ? b1Result.value : null;
const a2 = a2Result.ok ? a2Result.value : null;
const b2 = b2Result.ok ? b2Result.value : null;
const c2 = c2Result.ok ? c2Result.value : null;
const d2 = d2Result.ok ? d2Result.value : null;
const e2 = e2Result.ok ? e2Result.value : null;

if (a1) facade.setCellValue(a1, "Hello");
if (b1) facade.setCellValue(b1, "World");
if (a2) facade.setCellValue(a2, 42);
if (b2) facade.setCellValue(b2, 123);
if (c2) facade.setCellValue(c2, "=A2+B2");
if (d2) facade.setCellValue(d2, "=SUM(A2:B2)");
if (e2) facade.setCellValue(e2, "=AVERAGE(A2:D2)");

// Add sample data for pivot table demo
const a5Result = CellAddress.fromString("A5");
const b5Result = CellAddress.fromString("B5");
const c5Result = CellAddress.fromString("C5");
const d5Result = CellAddress.fromString("D5");
const e5Result = CellAddress.fromString("E5");

const a5 = a5Result.ok ? a5Result.value : null;
const b5 = b5Result.ok ? b5Result.value : null;
const c5 = c5Result.ok ? c5Result.value : null;
const d5 = d5Result.ok ? d5Result.value : null;
const e5 = e5Result.ok ? e5Result.value : null;

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
    const addrResult = CellAddress.create(i + 6, j);
    if (addrResult.ok) {
      facade.setCellValue(addrResult.value, value);
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
    facade.setCellValue(address, value);
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
              const addrResult = CellAddress.create(r, c);
              if (addrResult.ok) {
                facade.setCellValue(addrResult.value, cellValue);
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
          const addrResult = CellAddress.create(i, j);
          if (addrResult.ok) {
            const cellResult = facade.getCell(addrResult.value);
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
          const addrResult = CellAddress.create(i, j);
          let value = "";
          if (addrResult.ok) {
            const cellResult = facade.getCell(addrResult.value);
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
      const sheetName = workbook.getActiveSheet()?.getName() || "sheet";
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

// Create Canvas Grid (will create its own controller)
let canvasGrid = new CanvasGrid(gridContainer, facade, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
});

// Get the viewport from the grid to use as ViewportManager
viewportManager = canvasGrid.getViewport();

// Create the controller with the viewport manager
const controller = new SpreadsheetController({
  facade,
  viewportManager,
});

// Subscribe to controller state changes to update formula bar during editing
controller.subscribe((event) => {
  if (event.type === "stateChanged") {
    const state = event.state;
    if (state.spreadsheetMode === "editing") {
      // Update formula bar with editing value
      formulaBar.setActiveCell(state.cursor, {
        rawValue: state.editingValue,
      } as any);
      formulaBar.setEditingState(true);
    } else {
      // Re-enable formula bar when not editing
      formulaBar.setEditingState(false);
    }
  } else if (event.type === "cellValueChanged") {
    // Update formula bar when cell value changes (e.g., Delete key)
    const cellResult = facade.getCell(event.address);
    if (cellResult.ok) {
      formulaBar.setActiveCell(event.address, cellResult.value);
    } else {
      // Cell was deleted/cleared
      formulaBar.setActiveCell(event.address, undefined);
    }
  }
});

// Recreate the grid with the controller
canvasGrid.destroy();
canvasGrid = new CanvasGrid(gridContainer, facade, {
  totalRows: GRID_ROWS,
  totalCols: GRID_COLS,
  controller,
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
    // Create new controller for the new sheet
    const newController = new SpreadsheetController({
      facade,
      viewportManager: viewportManager!,
    });
    
    // Subscribe to controller state changes to update formula bar during editing
    newController.subscribe((event) => {
      if (event.type === "stateChanged") {
        const state = event.state;
        if (state.spreadsheetMode === "editing") {
          // Update formula bar with editing value
          formulaBar.setActiveCell(state.cursor, {
            rawValue: state.editingValue,
          } as any);
          formulaBar.setEditingState(true);
        } else {
          // Re-enable formula bar when not editing
          formulaBar.setEditingState(false);
        }
      } else if (event.type === "cellValueChanged") {
        // Update formula bar when cell value changes (e.g., Delete key)
        const cellResult = facade.getCell(event.address);
        if (cellResult.ok) {
          formulaBar.setActiveCell(event.address, cellResult.value);
        } else {
          // Cell was deleted/cleared
          formulaBar.setActiveCell(event.address, undefined);
        }
      }
    });
    
    canvasGrid = new CanvasGrid(gridContainer, facade, {
      totalRows: GRID_ROWS,
      totalCols: GRID_COLS,
      controller: newController,
    });
    _grid = canvasGrid;

    // Reconnect event handlers
    canvasGrid.onCellClick = (cell) => {
      const cellResult = facade.getCell(cell);
      if (cellResult.ok) {
        formulaBar.setActiveCell(cell, cellResult.value);
      } else {
        // Even if the cell is empty or doesn't exist, we should still update the formula bar
        formulaBar.setActiveCell(cell, undefined);
      }
    };

    // Re-set sheet navigation callbacks
    setupSheetNavigationCallbacks();

    // Re-render
    canvasGrid.render();

    // Update formula bar with current selection
    const selection = canvasGrid.getSelection();
    if (selection) {
      const cellResult = facade.getCell(selection.start);
      if (cellResult.ok) {
        formulaBar.setActiveCell(selection.start, cellResult.value);
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
  const cellResult = facade.getCell(cell);
  if (cellResult.ok) {
    formulaBar.setActiveCell(cell, cellResult.value);
  } else {
    // Even if the cell is empty or doesn't exist, we should still update the formula bar
    formulaBar.setActiveCell(cell, undefined);
  }
};

// Function to set up sheet navigation keyboard shortcuts
const setupSheetNavigationCallbacks = () => {
  canvasGrid.getKeyboardHandler().setSheetNavigationCallbacks({
    onNextSheet: () => {
      const sheets = workbook.getAllSheets();
      const activeSheet = workbook.getActiveSheet();
      if (!activeSheet) return;
      const currentIndex = sheets.findIndex(
        (s) => s.getId() === activeSheet.getId(),
      );
      if (currentIndex < sheets.length - 1) {
        const nextSheet = sheets[currentIndex + 1];
        workbook.setActiveSheet(nextSheet.getId());
        tabBar.refresh();
        // TabBar will handle the change internally
      }
    },
    onPreviousSheet: () => {
      const sheets = workbook.getAllSheets();
      const activeSheet = workbook.getActiveSheet();
      if (!activeSheet) return;
      const currentIndex = sheets.findIndex(
        (s) => s.getId() === activeSheet.getId(),
      );
      if (currentIndex > 0) {
        const prevSheet = sheets[currentIndex - 1];
        workbook.setActiveSheet(prevSheet.getId());
        tabBar.refresh();
        // TabBar will handle the change internally
      }
    },
    onNewSheet: () => {
      const newSheet = workbook.createSheet();
      workbook.setActiveSheet(newSheet.getId());
      tabBar.refresh();
      // TabBar will handle the change internally
    },
  });
};

// Set up sheet navigation keyboard shortcuts
setupSheetNavigationCallbacks();

// Initialize formula bar with A1
const initialCellResult = CellAddress.create(0, 0);
if (initialCellResult.ok) {
  const cellResult = facade.getCell(initialCellResult.value);
  if (cellResult.ok) {
    formulaBar.setActiveCell(initialCellResult.value, cellResult.value);
  }
}

// Listen for changes from the facade
// TODO: Re-enable event handling when facade.getEventService() is available
// const eventService = facade.getEventService();
// eventService.on("CellValueChanged", () => {
//   canvasGrid.render();
// });
// eventService.on("CellCalculated", () => {
//   canvasGrid.render();
// });

// Handle window resize
window.addEventListener("resize", () => {
  canvasGrid.resize();
  canvasGrid.render();
});

// Create mode indicator
const modeIndicator = new ModeIndicator(app, controller);

// Initial focus
gridContainer.focus();
