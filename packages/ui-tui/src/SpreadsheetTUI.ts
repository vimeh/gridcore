import type { CellAddress } from "@gridcore/core";
import { SpreadsheetEngine } from "@gridcore/core";
import {
  FormulaBarComponent,
  GridComponent,
  StatusBarComponent,
} from "./components";
import {
  type KeyMeta,
  OptimizedBuffer,
  Renderable,
  Terminal,
} from "./framework";

export type Mode = "normal" | "edit" | "command" | "visual";

export interface TUIState {
  mode: Mode;
  cursor: CellAddress;
  viewport: {
    startRow: number;
    startCol: number;
    rows: number;
    cols: number;
  };
  selectedRange?: {
    start: CellAddress;
    end: CellAddress;
  };
  editingValue?: string;
  commandValue?: string;
}

export class SpreadsheetTUI extends Renderable {
  private terminal: Terminal;
  private buffer: OptimizedBuffer;
  private engine: SpreadsheetEngine;
  private state: TUIState;
  private running = false;

  // Child components
  private gridComponent: GridComponent;
  private formulaBarComponent: FormulaBarComponent;
  private statusBarComponent: StatusBarComponent;

  constructor() {
    super("SpreadsheetTUI");

    this.terminal = new Terminal();
    const { width, height } = this.terminal.getSize();
    this.buffer = new OptimizedBuffer(width, height);

    this.engine = new SpreadsheetEngine();

    this.state = {
      mode: "normal",
      cursor: { row: 0, col: 0 },
      viewport: {
        startRow: 0,
        startCol: 0,
        rows: Math.floor(height * 0.8), // 80% for grid
        cols: Math.floor(width / 10), // Assuming ~10 chars per column
      },
    };

    this.setSize(width, height);

    // Create child components
    this.formulaBarComponent = new FormulaBarComponent(
      this.engine,
      () => this.state,
    );
    this.formulaBarComponent.setPosition(0, 1);
    this.formulaBarComponent.setSize(width, 2);
    this.addChild(this.formulaBarComponent);

    this.gridComponent = new GridComponent(this.engine, () => this.state);
    this.gridComponent.setPosition(0, 3);
    this.gridComponent.setSize(width, height - 5); // Leave room for formula bar and status bar
    this.addChild(this.gridComponent);

    this.statusBarComponent = new StatusBarComponent(
      this.engine,
      () => this.state,
    );
    this.statusBarComponent.setPosition(0, height - 1);
    this.statusBarComponent.setSize(width, 1);
    this.addChild(this.statusBarComponent);
  }

  async start(): Promise<void> {
    this.running = true;

    // Enter raw mode for keyboard input
    this.terminal.enterRawMode();
    this.terminal.clearScreen();

    // Set up keyboard handling
    this.terminal.onKeyPress(this.handleKeyPress.bind(this));

    // Set up resize handling
    this.terminal.onResize((width, height) => {
      this.buffer.resize(width, height);
      this.setSize(width, height);
      this.updateViewport();
      this.updateComponentSizes(width, height);
      this.buffer.clear();
      this.render(this.buffer);
      this.terminal.renderBuffer(this.buffer);
    });

    // Initial render
    this.render(this.buffer);
    this.terminal.renderBuffer(this.buffer);

    // Keep the process running
    await new Promise(() => {});
  }

  stop(): void {
    this.running = false;
    this.terminal.cleanup();
    process.exit(0);
  }

  private handleKeyPress(key: string, meta: KeyMeta): void {
    // Exit on Ctrl+C or Ctrl+Q
    if (meta.ctrl && (meta.key === "c" || meta.key === "q")) {
      this.stop();
      return;
    }

    switch (this.state.mode) {
      case "normal":
        this.handleNormalMode(key, meta);
        break;
      case "edit":
        this.handleEditMode(key, meta);
        break;
      case "visual":
        this.handleVisualMode(key, meta);
        break;
      case "command":
        this.handleCommandMode(key, meta);
        break;
    }

    // Re-render after handling input
    this.buffer.clear();
    this.render(this.buffer);
    this.terminal.renderBuffer(this.buffer);
  }

  private handleNormalMode(key: string, meta: KeyMeta): void {
    switch (meta.key) {
      case "up":
      case "k":
        if (this.state.cursor.row > 0) {
          this.state.cursor.row--;
          this.ensureCursorInViewport();
        }
        break;
      case "down":
      case "j":
        this.state.cursor.row++;
        this.ensureCursorInViewport();
        break;
      case "left":
      case "h":
        if (this.state.cursor.col > 0) {
          this.state.cursor.col--;
          this.ensureCursorInViewport();
        }
        break;
      case "right":
      case "l":
        this.state.cursor.col++;
        this.ensureCursorInViewport();
        break;
      case "enter":
      case "i": {
        this.state.mode = "edit";
        const currentValue = this.engine.getCellValue(this.state.cursor);
        this.state.editingValue = currentValue?.toString() || "";
        break;
      }
      case "v":
        this.state.mode = "visual";
        this.state.selectedRange = {
          start: { ...this.state.cursor },
          end: { ...this.state.cursor },
        };
        break;
      case ":":
        this.state.mode = "command";
        this.state.commandValue = "";
        break;
    }
  }

  private handleEditMode(key: string, meta: KeyMeta): void {
    if (meta.key === "escape") {
      this.state.mode = "normal";
      this.state.editingValue = undefined;
      return;
    }

    if (meta.key === "enter") {
      if (this.state.editingValue !== undefined) {
        this.engine.setCellValue(this.state.cursor, this.state.editingValue);
      }
      this.state.mode = "normal";
      this.state.editingValue = undefined;
      return;
    }

    if (meta.key === "backspace" && this.state.editingValue) {
      this.state.editingValue = this.state.editingValue.slice(0, -1);
      return;
    }

    // Add character to editing value
    if (key.length === 1 && this.state.editingValue !== undefined) {
      this.state.editingValue += key;
    }
  }

  private handleVisualMode(key: string, meta: KeyMeta): void {
    if (meta.key === "escape") {
      this.state.mode = "normal";
      this.state.selectedRange = undefined;
      return;
    }

    // Handle visual mode selection expansion
    // TODO: Implement visual mode selection
  }

  private handleCommandMode(key: string, meta: KeyMeta): void {
    if (meta.key === "escape") {
      this.state.mode = "normal";
      this.state.commandValue = undefined;
      return;
    }

    if (meta.key === "enter" && this.state.commandValue) {
      this.executeCommand(this.state.commandValue);
      this.state.mode = "normal";
      this.state.commandValue = undefined;
      return;
    }

    if (meta.key === "backspace" && this.state.commandValue) {
      this.state.commandValue = this.state.commandValue.slice(0, -1);
      return;
    }

    // Add character to command value
    if (key.length === 1 && this.state.commandValue !== undefined) {
      this.state.commandValue += key;
    }
  }

  private executeCommand(command: string): void {
    if (command === "q" || command === "quit") {
      this.stop();
    }
    // TODO: Add more commands
  }

  private ensureCursorInViewport(): void {
    const { cursor, viewport } = this.state;

    // Adjust viewport if cursor is outside
    if (cursor.row < viewport.startRow) {
      viewport.startRow = cursor.row;
    } else if (cursor.row >= viewport.startRow + viewport.rows) {
      viewport.startRow = cursor.row - viewport.rows + 1;
    }

    if (cursor.col < viewport.startCol) {
      viewport.startCol = cursor.col;
    } else if (cursor.col >= viewport.startCol + viewport.cols) {
      viewport.startCol = cursor.col - viewport.cols + 1;
    }
  }

  private updateViewport(): void {
    const { width, height } = this.terminal.getSize();
    this.state.viewport.rows = Math.floor((height - 5) * 0.9); // Account for UI elements
    this.state.viewport.cols = Math.floor(width / 10);
  }

  private updateComponentSizes(width: number, height: number): void {
    this.formulaBarComponent.setSize(width, 2);
    this.gridComponent.setPosition(0, 3);
    this.gridComponent.setSize(width, height - 5);
    this.statusBarComponent.setPosition(0, height - 1);
    this.statusBarComponent.setSize(width, 1);
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    // Draw title bar
    const titleBg = { r: 0, g: 48, b: 96, a: 255 };
    const titleFg = { r: 255, g: 255, b: 255, a: 255 };

    buffer.fillRect(0, 0, this.width, 1, " ", titleFg, titleBg);

    const title = "GridCore TUI - Spreadsheet";
    const titleX = Math.floor((this.width - title.length) / 2);
    buffer.setText(titleX, 0, title, titleFg, titleBg);
  }

  getState(): TUIState {
    return this.state;
  }

  getEngine(): SpreadsheetEngine {
    return this.engine;
  }
}
