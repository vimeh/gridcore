import { CellAddress, type SpreadsheetFacade } from "@gridcore/core";
import {
  SpreadsheetController,
  type ViewportManager,
} from "@gridcore/ui-core";
import { KeyboardHandler } from "../interaction/KeyboardHandler";
import { MouseHandler } from "../interaction/MouseHandler";
import { ResizeHandler } from "../interaction/ResizeHandler";
import { SelectionManager } from "../interaction/SelectionManager";
import { CanvasRenderer } from "../rendering/CanvasRenderer";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { defaultTheme, type GridTheme } from "../rendering/GridTheme";
import { HeaderRenderer } from "../rendering/HeaderRenderer";
import { SelectionRenderer } from "../rendering/SelectionRenderer";
import { WebStateAdapter, type InteractionMode } from "../state/WebStateAdapter";
import { CellEditor } from "./CellEditor";
import { Viewport } from "./Viewport";

export interface CanvasGridOptions {
  theme?: GridTheme;
  totalRows?: number;
  totalCols?: number;
  controller?: SpreadsheetController;
}

export class CanvasGrid {
  private container: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private rowHeaderCanvas!: HTMLCanvasElement;
  private colHeaderCanvas!: HTMLCanvasElement;
  private cornerCanvas!: HTMLCanvasElement;
  private scrollContainer!: HTMLElement;
  private facade: SpreadsheetFacade;
  private theme: GridTheme;

  private viewport: Viewport;
  private renderer: CanvasRenderer;
  private headerRenderer!: HeaderRenderer;
  private selectionRenderer: SelectionRenderer;
  private selectionManager: SelectionManager;
  private mouseHandler: MouseHandler;
  private cellEditor: CellEditor;
  private keyboardHandler: KeyboardHandler;
  private resizeHandler!: ResizeHandler;

  private animationFrameId: number | null = null;
  private debugRenderer!: DebugRenderer;
  private interactionModeToggle!: HTMLInputElement;
  private controller?: SpreadsheetController;
  private adapter?: WebStateAdapter;
  private stateChangeUnsubscribe?: () => void;

  constructor(
    container: HTMLElement,
    facade: SpreadsheetFacade,
    options: CanvasGridOptions = {},
  ) {
    this.container = container;
    this.facade = facade;
    this.theme = options.theme || defaultTheme;
    this.controller = options.controller;
    
    // Create adapter if controller is provided
    if (this.controller) {
      this.adapter = new WebStateAdapter(this.controller);
    }

    this.setupDOM();

    this.viewport = new Viewport(
      this.theme,
      options.totalRows,
      options.totalCols,
    );
    this.renderer = new CanvasRenderer(this.canvas, this.theme, this.viewport);
    this.selectionRenderer = new SelectionRenderer(
      this.canvas,
      this.theme,
      this.viewport,
    );
    this.debugRenderer = new DebugRenderer(this.canvas);
    this.headerRenderer = new HeaderRenderer(
      this.rowHeaderCanvas,
      this.colHeaderCanvas,
      this.cornerCanvas,
      this.theme,
      this.viewport,
    );
    this.selectionManager = new SelectionManager();

    this.cellEditor = new CellEditor(this.scrollContainer, this.viewport, {
      onCommit: this.handleCellCommit.bind(this),
      onCancel: this.handleCellCancel.bind(this),
      onEditEnd: () => this.container.focus(),
      onEditStart: () => this.render(),
      onModeChange: () => this.render(),
      controller: this.controller,
    });

    this.mouseHandler = new MouseHandler(
      this.canvas,
      this.viewport,
      this.selectionManager,
      this.handleCellClick.bind(this),
      this.handleCellDoubleClick.bind(this),
    );

    this.keyboardHandler = new KeyboardHandler(
      this.container,
      this.selectionManager,
      this.cellEditor,
      this.facade,
      this,
      this.controller,
    );

    this.resizeHandler = new ResizeHandler(
      this.colHeaderCanvas,
      this.rowHeaderCanvas,
      this.viewport,
      this.headerRenderer,
      {
        onColumnResize: () => {
          this.resize();
          this.render();
        },
        onRowResize: () => {
          this.resize();
          this.render();
        },
      },
    );

    this.setupEventListeners();
    this.setupModeChangeSubscription();

    const initialCell = CellAddress.create(0, 0);
    if (initialCell.ok) {
      this.selectionManager.setActiveCell(initialCell.value);
    }

    this.selectionManager.onActiveCellChange = (cell) => {
      this.scrollToCell(cell);
      this.render();
      this.onCellClick?.(cell);
    };

    // Do an immediate resize to set initial dimensions correctly
    this.resize();

    // Then do another resize in next frame to handle any layout changes
    requestAnimationFrame(() => {
      this.resize();
      this.render();
    });
  }

  private setupDOM(): void {
    this.container.innerHTML = "";
    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";

    // Create toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "grid-toolbar";
    toolbar.style.position = "absolute";
    toolbar.style.top = "0";
    toolbar.style.left = "0";
    toolbar.style.right = "0";
    toolbar.style.height = "40px";
    toolbar.style.backgroundColor = "#f5f5f5";
    toolbar.style.borderBottom = "1px solid #ddd";
    toolbar.style.display = "flex";
    toolbar.style.alignItems = "center";
    toolbar.style.padding = "0 10px";
    toolbar.style.zIndex = "4";

    // Create interaction mode toggle
    const toggleContainer = document.createElement("div");
    toggleContainer.style.display = "flex";
    toggleContainer.style.alignItems = "center";
    toggleContainer.style.gap = "10px";
    toggleContainer.style.marginLeft = "auto"; // Push to right side

    const toggleLabel = document.createElement("label");
    toggleLabel.style.display = "flex";
    toggleLabel.style.alignItems = "center";
    toggleLabel.style.cursor = "pointer";
    toggleLabel.style.userSelect = "none";

    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.style.marginRight = "8px";
    toggleInput.addEventListener("change", () => {
      const newMode = toggleInput.checked ? "keyboard-only" : "normal";
      this.setInteractionMode(newMode);
    });

    const toggleText = document.createElement("span");
    toggleText.textContent = "Keyboard Only Mode";
    toggleText.style.fontSize = "14px";
    toggleText.style.color = "#333";

    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleText);
    toggleContainer.appendChild(toggleLabel);
    toolbar.appendChild(toggleContainer);
    this.container.appendChild(toolbar);

    // Store reference to toggle for updates
    this.interactionModeToggle = toggleInput;

    // Adjust other elements to account for toolbar height
    const toolbarHeight = 40;

    this.cornerCanvas = document.createElement("canvas");
    this.cornerCanvas.className = "grid-corner-canvas";
    this.cornerCanvas.style.position = "absolute";
    this.cornerCanvas.style.top = `${toolbarHeight}px`;
    this.cornerCanvas.style.left = "0";
    this.cornerCanvas.style.width = `${this.theme.rowHeaderWidth}px`;
    this.cornerCanvas.style.height = `${this.theme.columnHeaderHeight}px`;
    this.cornerCanvas.style.zIndex = "3";
    this.cornerCanvas.style.pointerEvents = "auto";
    this.cornerCanvas.style.backgroundColor = this.theme.headerBackgroundColor;

    this.colHeaderCanvas = document.createElement("canvas");
    this.colHeaderCanvas.className = "grid-col-header-canvas";
    this.colHeaderCanvas.style.position = "absolute";
    this.colHeaderCanvas.style.top = `${toolbarHeight}px`;
    this.colHeaderCanvas.style.left = `${this.theme.rowHeaderWidth}px`;
    this.colHeaderCanvas.style.right = "0";
    this.colHeaderCanvas.style.height = `${this.theme.columnHeaderHeight}px`;
    this.colHeaderCanvas.style.zIndex = "2";
    this.colHeaderCanvas.style.pointerEvents = "auto";
    this.colHeaderCanvas.style.backgroundColor =
      this.theme.headerBackgroundColor;

    this.rowHeaderCanvas = document.createElement("canvas");
    this.rowHeaderCanvas.className = "grid-row-header-canvas";
    this.rowHeaderCanvas.style.position = "absolute";
    this.rowHeaderCanvas.style.top = `${toolbarHeight + this.theme.columnHeaderHeight}px`;
    this.rowHeaderCanvas.style.left = "0";
    this.rowHeaderCanvas.style.width = `${this.theme.rowHeaderWidth}px`;
    this.rowHeaderCanvas.style.bottom = "0";
    this.rowHeaderCanvas.style.zIndex = "2";
    this.rowHeaderCanvas.style.pointerEvents = "auto";
    this.rowHeaderCanvas.style.backgroundColor =
      this.theme.headerBackgroundColor;

    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "grid-scroll-container";
    this.scrollContainer.style.position = "absolute";
    this.scrollContainer.style.top = `${toolbarHeight + this.theme.columnHeaderHeight}px`;
    this.scrollContainer.style.left = `${this.theme.rowHeaderWidth}px`;
    this.scrollContainer.style.right = "0";
    this.scrollContainer.style.bottom = "0";
    this.scrollContainer.style.overflow = "auto";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "grid-canvas";
    this.canvas.style.position = "sticky";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "auto";
    // Prevent canvas from creating initial scroll space
    this.canvas.style.width = "0px";
    this.canvas.style.height = "0px";

    const spacer = document.createElement("div");
    spacer.className = "grid-spacer";
    spacer.style.position = "absolute";
    spacer.style.top = "0";
    spacer.style.left = "0";
    spacer.style.pointerEvents = "none";
    // Set initial size to prevent over-scrolling on load
    spacer.style.width = "0px";
    spacer.style.height = "0px";
    spacer.style.minWidth = "0px";
    spacer.style.minHeight = "0px";

    this.scrollContainer.appendChild(spacer);
    this.scrollContainer.appendChild(this.canvas);

    this.container.appendChild(this.scrollContainer);
    this.container.appendChild(this.cornerCanvas);
    this.container.appendChild(this.colHeaderCanvas);
    this.container.appendChild(this.rowHeaderCanvas);
  }

  private setupEventListeners(): void {
    window.addEventListener("resize", this.handleResize.bind(this));
    this.scrollContainer.addEventListener(
      "scroll",
      this.handleScroll.bind(this),
    );
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.scrollContainer.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
    });

    [this.cornerCanvas, this.colHeaderCanvas, this.rowHeaderCanvas].forEach(
      (canvas) => {
        canvas.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          { passive: false },
        );
      },
    );
  }

  private setupModeChangeSubscription(): void {
    if (this.adapter) {
      this.stateChangeUnsubscribe = this.adapter.subscribe(
        (newState) => {
          // Update mouse handler based on interaction mode
          this.mouseHandler.setEnabled(newState.interactionMode === "normal");

          // Update resize handler based on interaction mode
          this.resizeHandler.setEnabled(newState.interactionMode === "normal");

          // Update toggle checkbox state
          if (this.interactionModeToggle) {
            this.interactionModeToggle.checked =
              newState.interactionMode === "keyboard-only";
          }

          // Re-render to update any visual indicators
          this.render();
        },
      );
    }
  }

  private handleResize(): void {
    this.resize();
    this.render();
  }

  private handleScroll(): void {
    const scrollX = this.scrollContainer.scrollLeft;
    const scrollY = this.scrollContainer.scrollTop;

    this.viewport.setScrollPosition(scrollX, scrollY);
    this.cellEditor.updatePosition();

    this.headerRenderer.renderColumnHeaders(scrollX);
    this.headerRenderer.renderRowHeaders(scrollY);

    this.render();
  }

  private handleCellClick(cell: CellAddress): void {
    this.selectionManager.setActiveCell(cell);
    this.render();
    this.onCellClick?.(cell);
  }

  public onCellClick?: (cell: CellAddress) => void;

  private handleCellDoubleClick(cell: CellAddress): void {
    const cellResult = this.facade.getCell(cell);
    let initialValue = "";
    if (cellResult.ok) {
      const cellData = cellResult.value;
      initialValue =
        cellData.formula?.toString() || String(cellData.value || "");
    }
    this.cellEditor.startEditing(cell, initialValue);
  }

  private handleCellCommit(address: CellAddress, value: string): void {
    this.facade.setCellValue(address, value);

    this.render();
    this.container.focus();

    // Update formula bar with the new cell value
    if (this.onCellClick) {
      this.onCellClick(address);
    }
  }

  private handleCellCancel(): void {
    this.render();
    this.container.focus();
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Early return if container has no dimensions yet
    if (width === 0 || height === 0) {
      return;
    }

    // Calculate scrollbar dimensions
    const hasVerticalScrollbar =
      this.scrollContainer.scrollHeight > this.scrollContainer.clientHeight;
    const hasHorizontalScrollbar =
      this.scrollContainer.scrollWidth > this.scrollContainer.clientWidth;
    const scrollbarWidth = hasVerticalScrollbar
      ? this.scrollContainer.offsetWidth - this.scrollContainer.clientWidth
      : 0;
    const scrollbarHeight = hasHorizontalScrollbar
      ? this.scrollContainer.offsetHeight - this.scrollContainer.clientHeight
      : 0;

    // Add/remove CSS class based on scrollbar presence
    if (hasVerticalScrollbar || hasHorizontalScrollbar) {
      this.container.classList.add("has-scrollbars");
    } else {
      this.container.classList.remove("has-scrollbars");
    }

    // Adjust header sizes to account for scrollbars
    this.colHeaderCanvas.style.width = `${width - this.theme.rowHeaderWidth - scrollbarWidth}px`;
    this.rowHeaderCanvas.style.height = `${height - this.theme.columnHeaderHeight - scrollbarHeight}px`;

    const _scrollWidth = width - this.theme.rowHeaderWidth;
    const _scrollHeight = height - this.theme.columnHeaderHeight;

    // Get the actual client dimensions (excluding scrollbars)
    const clientWidth = this.scrollContainer.clientWidth;
    const clientHeight = this.scrollContainer.clientHeight;

    // Size canvas to client area (excluding scrollbars)
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;

    this.renderer.resize(clientWidth, clientHeight);
    this.headerRenderer.resize();

    this.viewport.setViewportSize(clientWidth, clientHeight);

    const spacer = this.scrollContainer.querySelector(
      ".grid-spacer",
    ) as HTMLElement;
    if (spacer) {
      const totalWidth = this.viewport.getTotalGridWidth();
      const totalHeight = this.viewport.getTotalGridHeight();

      // Set spacer to exact grid size to prevent over-scrolling
      spacer.style.width = `${totalWidth}px`;
      spacer.style.height = `${totalHeight}px`;
    }

    this.headerRenderer.renderCorner();
    const scrollPos = this.viewport.getScrollPosition();
    this.headerRenderer.renderColumnHeaders(scrollPos.x);
    this.headerRenderer.renderRowHeaders(scrollPos.y);
  }

  render(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(() => {
      // Start debug frame tracking
      this.debugRenderer.beginFrame();

      // Get visible bounds for debug visualization
      const bounds = this.viewport.getVisibleBounds();
      const scrollPos = this.viewport.getScrollPosition();

      // Calculate pixel bounds for visible area
      let x = 0,
        y = 0;
      for (let col = 0; col < bounds.startCol; col++) {
        x += this.viewport.getColumnWidth(col);
      }
      for (let row = 0; row < bounds.startRow; row++) {
        y += this.viewport.getRowHeight(row);
      }

      const visibleBounds = {
        x: x - scrollPos.x,
        y: y - scrollPos.y,
        width: this.canvas.width,
        height: this.canvas.height,
      };

      // Track dirty regions more granularly
      // For now, we'll track the visible cell area as dirty
      // In a production implementation, you'd track individual cell changes
      if (this.debugRenderer.isEnabled()) {
        // Calculate the bounds of the visible cell area
        let minX = Infinity,
          minY = Infinity,
          maxX = 0,
          maxY = 0;

        for (let row = bounds.startRow; row <= bounds.endRow; row++) {
          for (let col = bounds.startCol; col <= bounds.endCol; col++) {
            const addrResult = CellAddress.create(row, col);
            if (!addrResult.ok) continue;
            const pos = this.viewport.getCellPosition(addrResult.value);
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + pos.width);
            maxY = Math.max(maxY, pos.y + pos.height);
          }
        }

        if (minX !== Infinity) {
          this.debugRenderer.addDirtyRegion(
            minX,
            minY,
            maxX - minX,
            maxY - minY,
          );
        }
      }

      // Render the grid
      const isNavigationMode = this.adapter ? this.adapter.getCoreState().spreadsheetMode === "navigation" : true;
      const cellsRendered = this.renderer.renderGrid(
        (address) => {
          const result = this.facade.getCell(address);
          if (!result.ok) return undefined;
          return result.value;
        },
        this.selectionManager.getActiveCell(),
        this.cellEditor.isCurrentlyEditing(),
        isNavigationMode,
      );

      // Render selection after grid
      this.selectionRenderer.renderSelection(
        this.selectionManager.getSelectedCells(),
        this.selectionManager.getSelectionRange(),
        this.selectionManager.getVisualMode(),
      );

      // End debug frame tracking
      this.debugRenderer.endFrame(cellsRendered);

      // Render debug overlay if enabled
      const ctx = this.canvas.getContext("2d");
      if (ctx) {
        this.debugRenderer.render(ctx, visibleBounds);
      }

      this.animationFrameId = null;
    });
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Clean up state change subscription
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
    }

    window.removeEventListener("resize", this.handleResize);
    this.scrollContainer.removeEventListener("scroll", this.handleScroll);

    this.mouseHandler.destroy();
    this.cellEditor.destroy();
    this.keyboardHandler.destroy();
    this.resizeHandler.destroy();

    this.container.innerHTML = "";
  }

  getFacade(): SpreadsheetFacade {
    return this.facade;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  getKeyboardHandler(): KeyboardHandler {
    return this.keyboardHandler;
  }

  setDebugMode(enabled: boolean): void {
    this.debugRenderer.setEnabled(enabled);
    this.render(); // Re-render to show/hide debug overlay
  }

  getSelectedCells(): CellAddress[] {
    const selected: CellAddress[] = [];
    for (const cellKey of this.selectionManager.getSelectedCells()) {
      const addressResult = CellAddress.fromString(cellKey);
      if (addressResult.ok) {
        selected.push(addressResult.value);
      }
    }
    return selected;
  }

  getSelection(): { start: CellAddress } | null {
    const activeCell = this.selectionManager.getActiveCell();
    return activeCell ? { start: activeCell } : null;
  }

  scrollToCell(address: CellAddress): void {
    const position = this.viewport.getCellPosition(address);
    const scrollPos = this.viewport.getScrollPosition();

    const viewportWidth = this.scrollContainer.clientWidth;
    const viewportHeight = this.scrollContainer.clientHeight;

    let newScrollX = scrollPos.x;
    let newScrollY = scrollPos.y;

    if (position.x < 0) {
      newScrollX = scrollPos.x + position.x;
    } else if (position.x + position.width > viewportWidth) {
      newScrollX = scrollPos.x + (position.x + position.width - viewportWidth);
    }

    if (position.y < 0) {
      newScrollY = scrollPos.y + position.y;
    } else if (position.y + position.height > viewportHeight) {
      newScrollY =
        scrollPos.y + (position.y + position.height - viewportHeight);
    }

    this.scrollContainer.scrollLeft = newScrollX;
    this.scrollContainer.scrollTop = newScrollY;
  }

  // Get view state including column widths and row heights
  getViewState(): {
    columnWidths: Record<number, number>;
    rowHeights: Record<number, number>;
  } {
    return {
      columnWidths: this.viewport.getColumnWidths(),
      rowHeights: this.viewport.getRowHeights(),
    };
  }

  // Set view state including column widths and row heights
  setViewState(state: {
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
  }): void {
    if (state.columnWidths) {
      this.viewport.setColumnWidths(state.columnWidths);
    }
    if (state.rowHeights) {
      this.viewport.setRowHeights(state.rowHeights);
    }
    this.resize();
    this.render();
  }

  // Get current interaction mode
  getInteractionMode(): InteractionMode {
    return this.adapter?.getState().interactionMode || "normal";
  }

  // Set interaction mode
  setInteractionMode(mode: InteractionMode): void {
    if (this.getInteractionMode() === mode) return;

    this.adapter?.setInteractionMode(mode);

    // Update mouse handler
    this.mouseHandler.setEnabled(mode === "normal");

    // Update resize handler
    this.resizeHandler.setEnabled(mode === "normal");

    // Update toggle checkbox state
    if (this.interactionModeToggle) {
      this.interactionModeToggle.checked = mode === "keyboard-only";
    }

    // Re-render to update any visual indicators
    this.render();
  }
}
