import {
  CellAddress,
  type ISpreadsheetFacade,
  type Sheet,
  type SpreadsheetFacade,
  Workbook,
} from "@gridcore/core";
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
import { VimBehavior, type VimMode } from "./vim";

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
  vimMode?: VimMode;
  vimCommandBuffer?: string;
  vimNumberBuffer?: string;
  visualType?: "character" | "line" | "block";
}

export class SpreadsheetTUI extends Renderable {
  private terminal: Terminal;
  private buffer: OptimizedBuffer;
  private workbook: Workbook;
  private sheet: Sheet;
  private facade: SpreadsheetFacade;
  private state: TUIState;
  private vimBehavior: VimBehavior;
  private useVim = true;

  // Child components
  private gridComponent: GridComponent;
  private formulaBarComponent: FormulaBarComponent;
  private statusBarComponent: StatusBarComponent;

  constructor() {
    super("SpreadsheetTUI");

    this.terminal = new Terminal();
    const { width, height } = this.terminal.getSize();
    this.buffer = new OptimizedBuffer(width, height);

    // Initialize workbook and sheet
    this.workbook = new Workbook();
    const activeSheet = this.workbook.getActiveSheet();
    if (!activeSheet) {
      throw new Error("No active sheet found");
    }
    this.sheet = activeSheet;
    this.facade = this.sheet.getFacade();

    this.vimBehavior = new VimBehavior();

    // Create initial cursor address
    const initialCursor = CellAddress.create(0, 0);

    this.state = {
      mode: "normal",
      cursor: initialCursor.ok
        ? initialCursor.value
        : ({ row: 0, col: 0 } as CellAddress),
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
      this.facade,
      () => this.state,
    );
    this.formulaBarComponent.setPosition(0, 1);
    this.formulaBarComponent.setSize(width, 2);
    this.addChild(this.formulaBarComponent);

    this.gridComponent = new GridComponent(this.facade, () => this.state);
    this.gridComponent.setPosition(0, 3);
    this.gridComponent.setSize(width, height - 5); // Leave room for formula bar and status bar
    this.addChild(this.gridComponent);

    this.statusBarComponent = new StatusBarComponent(() => this.state);
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

    // Use vim keybindings if enabled
    if (
      this.useVim &&
      (this.state.mode === "normal" || this.state.mode === "visual")
    ) {
      const vimAction = this.vimBehavior.handleKeyPress(key, meta, this.state);
      this.handleVimAction(vimAction);

      // Update mode from vim state
      const vimMode = this.vimBehavior.getMode();
      if (
        vimMode === "normal" ||
        vimMode === "visual" ||
        vimMode === "edit" ||
        vimMode === "command"
      ) {
        this.state.mode = vimMode;
      }

      // Update visual selection if in visual mode
      if (this.state.mode === "visual") {
        const anchor = this.vimBehavior.getAnchor();
        if (anchor) {
          this.state.selectedRange = {
            start: {
              row: Math.min(anchor.row, this.state.cursor.row),
              col: Math.min(anchor.col, this.state.cursor.col),
            },
            end: {
              row: Math.max(anchor.row, this.state.cursor.row),
              col: Math.max(anchor.col, this.state.cursor.col),
            },
          };
        }
      }

      // Update vim state info for status bar
      const vimState = this.vimBehavior.getVimState();
      this.state.vimMode = vimState.mode;
      this.state.vimCommandBuffer = vimState.commandBuffer;
      this.state.vimNumberBuffer = vimState.numberBuffer;
      this.state.visualType = vimState.visualType;
    } else {
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
    }

    // Re-render after handling input
    this.buffer.clear();
    this.render(this.buffer);
    this.terminal.renderBuffer(this.buffer);
  }

  private handleVimAction(
    action: ReturnType<VimBehavior["handleKeyPress"]>,
  ): void {
    switch (action.type) {
      case "move": {
        const count = action.count || 1;
        for (let i = 0; i < count; i++) {
          switch (action.direction) {
            case "up":
              if (this.state.cursor.row > 0) {
                this.state.cursor.row--;
              }
              break;
            case "down":
              this.state.cursor.row++;
              break;
            case "left":
              if (this.state.cursor.col > 0) {
                this.state.cursor.col--;
              }
              break;
            case "right":
              this.state.cursor.col++;
              break;
          }
        }
        this.ensureCursorInViewport();
        break;
      }

      case "moveTo": {
        switch (action.target) {
          case "firstColumn":
            this.state.cursor.col = 0;
            break;
          case "lastColumn":
            this.state.cursor.col = Math.max(0, this.state.viewport.cols - 1);
            break;
          case "firstRow":
            this.state.cursor.row = 0;
            break;
          case "lastRow":
            this.state.cursor.row = action.count ? action.count - 1 : 999999;
            break;
        }
        this.ensureCursorInViewport();
        break;
      }

      case "moveWord": {
        // Simple word movement - move to next/prev non-empty cell
        const count = action.count || 1;
        for (let i = 0; i < count; i++) {
          if (action.direction === "forward" || action.direction === "end") {
            this.state.cursor.col++;
          } else {
            if (this.state.cursor.col > 0) {
              this.state.cursor.col--;
            }
          }
        }
        this.ensureCursorInViewport();
        break;
      }

      case "changeMode": {
        this.state.mode = action.mode as Mode;
        if (action.editVariant) {
          const cellResult = this.facade.getCell(this.state.cursor);
          const currentValue = cellResult.ok
            ? cellResult.value.value
            : undefined;
          this.state.editingValue = currentValue?.toString() || "";

          switch (action.editVariant) {
            case "a":
              // Append - cursor at end
              break;
            case "A":
              // Append at end of line - move to last column first
              this.state.cursor.col = Math.max(0, this.state.viewport.cols - 1);
              break;
            case "I":
              // Insert at beginning of line
              this.state.cursor.col = 0;
              break;
            case "o":
              // Open line below
              this.state.cursor.row++;
              this.state.editingValue = "";
              break;
            case "O":
              // Open line above
              if (this.state.cursor.row > 0) {
                this.state.cursor.row--;
              }
              this.state.editingValue = "";
              break;
          }
          this.ensureCursorInViewport();
        }
        break;
      }

      case "delete": {
        if (this.state.selectedRange) {
          // Delete visual selection
          const start = this.state.selectedRange.start;
          const end = this.state.selectedRange.end;
          for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
              const addr = CellAddress.create(row, col);
              if (addr.ok) {
                this.facade.setCellValue(addr.value, "");
              }
            }
          }
          this.state.selectedRange = undefined;
        } else if (action.motion === "line") {
          // Delete entire row
          for (let col = 0; col < this.state.viewport.cols; col++) {
            const addr = CellAddress.create(this.state.cursor.row, col);
            if (addr.ok) {
              this.facade.setCellValue(addr.value, "");
            }
          }
        } else {
          // Delete current cell
          this.facade.setCellValue(this.state.cursor, "");
        }
        break;
      }

      case "change": {
        this.handleVimAction({ type: "delete", motion: action.motion });
        this.state.mode = "edit";
        this.state.editingValue = "";
        break;
      }

      case "yank": {
        // TODO: Implement yank
        break;
      }

      case "paste": {
        // TODO: Implement paste
        break;
      }

      case "scroll": {
        const viewportRows = this.state.viewport.rows;
        switch (action.direction) {
          case "halfDown":
            this.state.viewport.startRow += Math.floor(viewportRows / 2);
            break;
          case "halfUp":
            this.state.viewport.startRow = Math.max(
              0,
              this.state.viewport.startRow - Math.floor(viewportRows / 2),
            );
            break;
          case "pageDown":
            this.state.viewport.startRow += viewportRows;
            break;
          case "pageUp":
            this.state.viewport.startRow = Math.max(
              0,
              this.state.viewport.startRow - viewportRows,
            );
            break;
          case "down":
            this.state.viewport.startRow++;
            break;
          case "up":
            this.state.viewport.startRow = Math.max(
              0,
              this.state.viewport.startRow - 1,
            );
            break;
        }
        break;
      }

      case "center": {
        const viewportRows = this.state.viewport.rows;
        switch (action.position) {
          case "center":
            this.state.viewport.startRow = Math.max(
              0,
              this.state.cursor.row - Math.floor(viewportRows / 2),
            );
            break;
          case "top":
            this.state.viewport.startRow = this.state.cursor.row;
            break;
          case "bottom":
            this.state.viewport.startRow = Math.max(
              0,
              this.state.cursor.row - viewportRows + 1,
            );
            break;
        }
        break;
      }

      case "setAnchor": {
        this.vimBehavior.setAnchor(this.state.cursor);
        this.state.selectedRange = {
          start: { ...this.state.cursor },
          end: { ...this.state.cursor },
        };
        break;
      }
    }
  }

  private handleNormalMode(_key: string, meta: KeyMeta): void {
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
        const cellResult = this.facade.getCell(this.state.cursor);
        const currentValue = cellResult.ok ? cellResult.value.value : undefined;
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
        this.facade.setCellValue(this.state.cursor, this.state.editingValue);
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

  private handleVisualMode(_key: string, meta: KeyMeta): void {
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

  getFacade(): ISpreadsheetFacade {
    return this.facade;
  }
}
