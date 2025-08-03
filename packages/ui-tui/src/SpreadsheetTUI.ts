import { Renderable, Terminal, OptimizedBuffer, type KeyMeta } from './framework'
import { SpreadsheetEngine } from '@gridcore/core'
import type { CellAddress } from '@gridcore/core'

export type Mode = 'normal' | 'edit' | 'command' | 'visual'

export interface TUIState {
  mode: Mode
  cursor: CellAddress
  viewport: {
    startRow: number
    startCol: number
    rows: number
    cols: number
  }
  selectedRange?: {
    start: CellAddress
    end: CellAddress
  }
  editingValue?: string
  commandValue?: string
}

export class SpreadsheetTUI extends Renderable {
  private terminal: Terminal
  private buffer: OptimizedBuffer
  private engine: SpreadsheetEngine
  private state: TUIState
  private running = false

  // Child components will be added here
  private gridComponent?: Renderable
  private formulaBarComponent?: Renderable
  private statusBarComponent?: Renderable

  constructor() {
    super('SpreadsheetTUI')
    
    this.terminal = new Terminal()
    const { width, height } = this.terminal.getSize()
    this.buffer = new OptimizedBuffer(width, height)
    
    this.engine = new SpreadsheetEngine()
    
    this.state = {
      mode: 'normal',
      cursor: { row: 0, col: 0 },
      viewport: {
        startRow: 0,
        startCol: 0,
        rows: Math.floor(height * 0.8), // 80% for grid
        cols: Math.floor(width / 10) // Assuming ~10 chars per column
      }
    }

    this.setSize(width, height)
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
      this.updateViewport()
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
    if (meta.ctrl && (meta.key === 'c' || meta.key === 'q')) {
      this.stop()
      return
    }

    switch (this.state.mode) {
      case 'normal':
        this.handleNormalMode(key, meta)
        break
      case 'edit':
        this.handleEditMode(key, meta)
        break
      case 'visual':
        this.handleVisualMode(key, meta)
        break
      case 'command':
        this.handleCommandMode(key, meta)
        break
    }

    // Re-render after handling input
    this.buffer.clear()
    this.render(this.buffer)
    this.terminal.renderBuffer(this.buffer)
  }

  private handleNormalMode(key: string, meta: KeyMeta): void {
    switch (meta.key) {
      case 'up':
      case 'k':
        if (this.state.cursor.row > 0) {
          this.state.cursor.row--
          this.ensureCursorInViewport()
        }
        break
      case 'down':
      case 'j':
        this.state.cursor.row++
        this.ensureCursorInViewport()
        break
      case 'left':
      case 'h':
        if (this.state.cursor.col > 0) {
          this.state.cursor.col--
          this.ensureCursorInViewport()
        }
        break
      case 'right':
      case 'l':
        this.state.cursor.col++
        this.ensureCursorInViewport()
        break
      case 'enter':
      case 'i':
        this.state.mode = 'edit'
        const currentValue = this.engine.getCellValue(this.state.cursor)
        this.state.editingValue = currentValue?.toString() || ''
        break
      case 'v':
        this.state.mode = 'visual'
        this.state.selectedRange = {
          start: { ...this.state.cursor },
          end: { ...this.state.cursor }
        }
        break
      case ':':
        this.state.mode = 'command'
        this.state.commandValue = ''
        break
    }
  }

  private handleEditMode(key: string, meta: KeyMeta): void {
    if (meta.key === 'escape') {
      this.state.mode = 'normal'
      this.state.editingValue = undefined
      return
    }

    if (meta.key === 'enter') {
      if (this.state.editingValue !== undefined) {
        this.engine.setCellValue(this.state.cursor, this.state.editingValue)
      }
      this.state.mode = 'normal'
      this.state.editingValue = undefined
      return
    }

    if (meta.key === 'backspace' && this.state.editingValue) {
      this.state.editingValue = this.state.editingValue.slice(0, -1)
      return
    }

    // Add character to editing value
    if (key.length === 1 && this.state.editingValue !== undefined) {
      this.state.editingValue += key
    }
  }

  private handleVisualMode(key: string, meta: KeyMeta): void {
    if (meta.key === 'escape') {
      this.state.mode = 'normal'
      this.state.selectedRange = undefined
      return
    }

    // Handle visual mode selection expansion
    // TODO: Implement visual mode selection
  }

  private handleCommandMode(key: string, meta: KeyMeta): void {
    if (meta.key === 'escape') {
      this.state.mode = 'normal'
      this.state.commandValue = undefined
      return
    }

    if (meta.key === 'enter' && this.state.commandValue) {
      this.executeCommand(this.state.commandValue)
      this.state.mode = 'normal'
      this.state.commandValue = undefined
      return
    }

    if (meta.key === 'backspace' && this.state.commandValue) {
      this.state.commandValue = this.state.commandValue.slice(0, -1)
      return
    }

    // Add character to command value
    if (key.length === 1 && this.state.commandValue !== undefined) {
      this.state.commandValue += key
    }
  }

  private executeCommand(command: string): void {
    if (command === 'q' || command === 'quit') {
      this.stop()
    }
    // TODO: Add more commands
  }

  private ensureCursorInViewport(): void {
    const { cursor, viewport } = this.state
    
    // Adjust viewport if cursor is outside
    if (cursor.row < viewport.startRow) {
      viewport.startRow = cursor.row
    } else if (cursor.row >= viewport.startRow + viewport.rows) {
      viewport.startRow = cursor.row - viewport.rows + 1
    }
    
    if (cursor.col < viewport.startCol) {
      viewport.startCol = cursor.col
    } else if (cursor.col >= viewport.startCol + viewport.cols) {
      viewport.startCol = cursor.col - viewport.cols + 1
    }
  }

  private updateViewport(): void {
    const { width, height } = this.terminal.getSize()
    this.state.viewport.rows = Math.floor(height * 0.8)
    this.state.viewport.cols = Math.floor(width / 10)
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    // For now, just render a basic layout
    // Child components will handle their own rendering
    
    // Draw a title
    buffer.setText(2, 0, 'GridCore TUI - Spreadsheet', 
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 0, g: 0, b: 128, a: 255 }
    )
  }

  getState(): TUIState {
    return this.state
  }

  getEngine(): SpreadsheetEngine {
    return this.engine
  }
}