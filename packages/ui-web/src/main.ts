// Main entry point using direct WASM imports
import { 
  WasmCell,
  WasmCellAddress,
  WasmWorkbook,
  WasmSpreadsheetController,
  WasmSpreadsheetFacade,
  WasmViewportManager
} from "gridcore-controller"
import { initializeWasm } from "./init-wasm"
import { CanvasGrid } from "./components/CanvasGrid"
import { FormulaBar } from "./components/FormulaBar"
import { StatusBar } from "./components/StatusBar"
import { TabBar } from "./components/TabBar"
import "./style.css"

// Initialize WASM and create the spreadsheet app
async function initApp() {
  console.log("Initializing Rust WASM...")
  try {
    await initializeWasm()
    console.log("Rust WASM modules initialized successfully")
  } catch (error) {
    console.error("Failed to initialize Rust WASM:", error)
    throw error
  }
  
  // Initialize the app
  const app = document.querySelector<HTMLDivElement>("#app")
  if (!app) {
    console.error("No app element found")
    return
  }

  // Create the main components
  const workbook = new WasmWorkbook()
  const controller = new WasmSpreadsheetController()
  const facade = new WasmSpreadsheetFacade()
  
  // Create UI components
  const tabBar = new TabBar(app, {
    onSheetSelect: (sheetName: string) => {
      console.log("Selected sheet:", sheetName)
      workbook.setActiveSheet(sheetName)
    },
    onSheetAdd: () => {
      const sheetCount = workbook.getSheetCount()
      const newSheetName = `Sheet${sheetCount + 1}`
      workbook.createSheet(newSheetName)
      console.log("Added sheet:", newSheetName)
    },
    workbook
  })

  const formulaBar = new FormulaBar(app, {
    onValueChange: (value: string) => {
      const state = controller.getState()
      if (state && state.cursor) {
        const address = new WasmCellAddress(state.cursor.col, state.cursor.row)
        facade.setCellValue(address, value)
        address.free()
      }
    },
    controller
  })

  const canvasGrid = new CanvasGrid(app, {
    facade,
    controller,
    onCellEdit: (address: WasmCellAddress, value: string) => {
      facade.setCellValue(address, value)
    },
    onSelectionChange: (selection: any) => {
      console.log("Selection changed:", selection)
    }
  })

  const statusBar = new StatusBar(app, {
    controller
  })

  // Subscribe to controller events
  controller.subscribe((event: any) => {
    console.log("Controller event:", event)
    
    // Update UI components based on events
    if (event.type === "MODE_CHANGED") {
      statusBar.update()
    }
    
    if (event.type === "CURSOR_MOVED") {
      formulaBar.update()
      statusBar.update()
    }
    
    if (event.type === "CELL_EDIT_COMPLETED") {
      canvasGrid.render()
    }
  })

  // Initial render
  canvasGrid.render()
  formulaBar.update()
  statusBar.update()
  tabBar.update()

  console.log("Spreadsheet app initialized")
}

// Start the app
initApp().catch(error => {
  console.error("Failed to initialize app:", error)
  const app = document.querySelector<HTMLDivElement>("#app")
  if (app) {
    app.innerHTML = `
      <div style="color: red; padding: 20px;">
        <h2>Failed to initialize spreadsheet</h2>
        <pre>${error}</pre>
      </div>
    `
  }
})