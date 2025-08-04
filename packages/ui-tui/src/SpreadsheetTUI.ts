import {
  CellAddress,
  type ISpreadsheetFacade,
  type Sheet,
  type SpreadsheetFacade,
  Workbook,
} from "@gridcore/core"
import {
  type ControllerEvent,
  createNavigationState,
  isCommandMode,
  SpreadsheetController,
  type UIState,
} from "@gridcore/ui-core"
import { StateAdapter } from "./adapters"
import {
  FormulaBarComponent,
  GridComponent,
  StatusBarComponent,
} from "./components"
import {
  type KeyMeta,
  OptimizedBuffer,
  Renderable,
  Terminal,
} from "./framework"
import { TUIViewportManager } from "./viewport"

export class SpreadsheetTUI extends Renderable {
  private terminal: Terminal
  private buffer: OptimizedBuffer
  private workbook: Workbook
  private sheet: Sheet
  private facade: SpreadsheetFacade
  private controller: SpreadsheetController
  private viewportManager: TUIViewportManager
  private running = false

  // Child components
  private gridComponent: GridComponent
  private formulaBarComponent: FormulaBarComponent
  private statusBarComponent: StatusBarComponent

  constructor() {
    super("SpreadsheetTUI")

    this.terminal = new Terminal()
    const { width, height } = this.terminal.getSize()
    this.buffer = new OptimizedBuffer(width, height)

    // Initialize workbook and sheet
    this.workbook = new Workbook()
    const activeSheet = this.workbook.getActiveSheet()
    if (!activeSheet) {
      throw new Error("No active sheet found")
    }
    this.sheet = activeSheet
    this.facade = this.sheet.getFacade()

    // Initialize viewport manager
    this.viewportManager = new TUIViewportManager({
      defaultColumnWidth: 10,
      defaultRowHeight: 1,
    })

    // Create initial state
    const initialCursor = CellAddress.create(0, 0)
    if (!initialCursor.ok) {
      throw new Error("Failed to create initial cursor")
    }
    
    const initialState = createNavigationState(initialCursor.value, {
      startRow: 0,
      startCol: 0,
      rows: Math.floor(height * 0.8), // 80% for grid
      cols: Math.floor(width / 10), // Assuming ~10 chars per column
    })

    // Initialize controller
    this.controller = new SpreadsheetController({
      facade: this.facade,
      viewportManager: this.viewportManager,
      initialState,
    })

    // Subscribe to controller events
    this.controller.subscribe(this.handleControllerEvent.bind(this))

    this.setSize(width, height)

    // Create child components - they'll now get UIState instead of TUIState
    this.formulaBarComponent = new FormulaBarComponent(
      this.facade,
      () => this.controller.getState(),
    )
    this.formulaBarComponent.setPosition(0, 1)
    this.formulaBarComponent.setSize(width, 2)
    this.addChild(this.formulaBarComponent)

    this.gridComponent = new GridComponent(
      this.facade, 
      () => this.controller.getState(),
      this.viewportManager,
    )
    this.gridComponent.setPosition(0, 3)
    this.gridComponent.setSize(width, height - 5) // Leave room for formula bar and status bar
    this.addChild(this.gridComponent)

    this.statusBarComponent = new StatusBarComponent(
      () => this.controller.getState(),
    )
    this.statusBarComponent.setPosition(0, height - 1)
    this.statusBarComponent.setSize(width, 1)
    this.addChild(this.statusBarComponent)
  }

  async start(): Promise<void> {
    this.running = true

    // Enter raw mode for keyboard input
    this.terminal.enterRawMode()
    this.terminal.clearScreen()

    // Set up keyboard handling
    this.terminal.onKeyPress(this.handleKeyPress.bind(this))

    // Set up resize handling
    this.terminal.onResize((width, height) => {
      this.buffer.resize(width, height)
      this.setSize(width, height)
      this.updateViewport(width, height)
      this.updateComponentSizes(width, height)
      this.buffer.clear()
      this.render(this.buffer)
      this.terminal.renderBuffer(this.buffer)
    })

    // Initial render
    this.render(this.buffer)
    this.terminal.renderBuffer(this.buffer)

    // Keep the process running
    await new Promise(() => {})
  }

  stop(): void {
    this.running = false
    this.terminal.cleanup()
    process.exit(0)
  }

  private handleKeyPress(key: string, meta: KeyMeta): void {
    // Exit on Ctrl+C or Ctrl+Q
    if (meta.ctrl && (meta.key === "c" || meta.key === "q")) {
      this.stop()
      return
    }

    // Handle through controller
    const result = this.controller.handleKeyPress(key, meta)
    
    if (!result.ok) {
      // Could show error in status bar
      console.error("Key handling error:", result.error)
    }

    // Ensure cursor is in viewport
    this.ensureCursorInViewport()

    // Re-render after handling input
    this.buffer.clear()
    this.render(this.buffer)
    this.terminal.renderBuffer(this.buffer)
  }

  private handleControllerEvent(event: ControllerEvent): void {
    switch (event.type) {
      case "stateChanged":
        // State changes are automatically reflected through getState()
        break
      case "cellValueChanged":
        // Cell value changes are handled by the facade
        break
      case "commandExecuted":
        this.handleCommand(event.command)
        break
      case "viewportChanged":
        // Update viewport if controller changes it
        this.updateViewport()
        break
      case "error":
        console.error("Controller error:", event.error)
        break
    }
  }

  private handleCommand(command: string): void {
    const trimmed = command.trim()
    if (trimmed === "q" || trimmed === "quit") {
      this.stop()
    } else if (trimmed === "w" || trimmed === "write") {
      // TODO: Implement save functionality
      console.log("Save not implemented yet")
    }
    // Add more commands as needed
  }

  private ensureCursorInViewport(): void {
    const state = this.controller.getState()
    const { cursor, viewport } = state

    let needsUpdate = false
    let newViewport = { ...viewport }

    // Adjust viewport if cursor is outside
    if (cursor.row < viewport.startRow) {
      newViewport.startRow = cursor.row
      needsUpdate = true
    } else if (cursor.row >= viewport.startRow + viewport.rows) {
      newViewport.startRow = cursor.row - viewport.rows + 1
      needsUpdate = true
    }

    if (cursor.col < viewport.startCol) {
      newViewport.startCol = cursor.col
      needsUpdate = true
    } else if (cursor.col >= viewport.startCol + viewport.cols) {
      newViewport.startCol = cursor.col - viewport.cols + 1
      needsUpdate = true
    }

    if (needsUpdate) {
      // Update viewport through controller
      this.controller.getEngine() // TODO: Add viewport update method to controller
      // For now, we'll update the viewport manager directly
      this.viewportManager.scrollTo(newViewport.startRow, newViewport.startCol)
    }
  }

  private updateViewport(width?: number, height?: number): void {
    if (width && height) {
      const rows = Math.floor((height - 5) * 0.9) // Account for UI elements
      const cols = Math.floor(width / 10)
      
      // TODO: Update viewport through controller
      // For now, we'll just ensure the viewport manager knows the size
    }
  }

  private updateComponentSizes(width: number, height: number): void {
    this.formulaBarComponent.setSize(width, 2)
    this.gridComponent.setPosition(0, 3)
    this.gridComponent.setSize(width, height - 5)
    this.statusBarComponent.setPosition(0, height - 1)
    this.statusBarComponent.setSize(width, 1)
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    // Draw title bar
    const titleBg = { r: 0, g: 48, b: 96, a: 255 }
    const titleFg = { r: 255, g: 255, b: 255, a: 255 }

    buffer.fillRect(0, 0, this.width, 1, " ", titleFg, titleBg)

    const title = "GridCore TUI - Spreadsheet"
    const titleX = Math.floor((this.width - title.length) / 2)
    buffer.setText(titleX, 0, title, titleFg, titleBg)
  }

  getState(): UIState {
    return this.controller.getState()
  }

  getFacade(): ISpreadsheetFacade {
    return this.controller.getEngine()
  }
}