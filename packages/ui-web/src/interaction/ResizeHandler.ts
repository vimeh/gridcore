import type { Viewport } from "../components/Viewport";
import type { HeaderRenderer } from "../rendering/HeaderRenderer";

export interface ResizeHandlerCallbacks {
  onColumnResize?: (col: number, width: number) => void;
  onRowResize?: (row: number, height: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export class ResizeHandler {
  private isResizing: boolean = false;
  private resizeType: "column" | "row" | null = null;
  private resizeIndex: number = -1;
  private startPosition: number = 0;
  private startSize: number = 0;
  private minSize: number = 20; // Minimum column/row size
  private enabled: boolean = true;
  private boundHandlers: {
    colHeaderMouseDown: (e: MouseEvent) => void;
    colHeaderMouseMove: (e: MouseEvent) => void;
    rowHeaderMouseDown: (e: MouseEvent) => void;
    rowHeaderMouseMove: (e: MouseEvent) => void;
    documentMouseMove: (e: MouseEvent) => void;
    documentMouseUp: (e: MouseEvent) => void;
  };

  constructor(
    private colHeaderCanvas: HTMLCanvasElement,
    private rowHeaderCanvas: HTMLCanvasElement,
    private viewport: Viewport,
    private headerRenderer: HeaderRenderer,
    private callbacks: ResizeHandlerCallbacks = {},
  ) {
    // Store bound handlers so we can remove them later
    this.boundHandlers = {
      colHeaderMouseDown: this.handleColHeaderMouseDown.bind(this),
      colHeaderMouseMove: this.handleColHeaderMouseMove.bind(this),
      rowHeaderMouseDown: this.handleRowHeaderMouseDown.bind(this),
      rowHeaderMouseMove: this.handleRowHeaderMouseMove.bind(this),
      documentMouseMove: this.handleDocumentMouseMove.bind(this),
      documentMouseUp: this.handleDocumentMouseUp.bind(this),
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.enabled) return;

    // Column header events
    this.colHeaderCanvas.addEventListener(
      "mousedown",
      this.boundHandlers.colHeaderMouseDown,
    );
    this.colHeaderCanvas.addEventListener(
      "mousemove",
      this.boundHandlers.colHeaderMouseMove,
    );

    // Row header events
    this.rowHeaderCanvas.addEventListener(
      "mousedown",
      this.boundHandlers.rowHeaderMouseDown,
    );
    this.rowHeaderCanvas.addEventListener(
      "mousemove",
      this.boundHandlers.rowHeaderMouseMove,
    );

    // Document events for resize dragging
    document.addEventListener(
      "mousemove",
      this.boundHandlers.documentMouseMove,
    );
    document.addEventListener("mouseup", this.boundHandlers.documentMouseUp);
  }

  private removeEventListeners(): void {
    this.colHeaderCanvas.removeEventListener(
      "mousedown",
      this.boundHandlers.colHeaderMouseDown,
    );
    this.colHeaderCanvas.removeEventListener(
      "mousemove",
      this.boundHandlers.colHeaderMouseMove,
    );
    this.rowHeaderCanvas.removeEventListener(
      "mousedown",
      this.boundHandlers.rowHeaderMouseDown,
    );
    this.rowHeaderCanvas.removeEventListener(
      "mousemove",
      this.boundHandlers.rowHeaderMouseMove,
    );
    document.removeEventListener(
      "mousemove",
      this.boundHandlers.documentMouseMove,
    );
    document.removeEventListener("mouseup", this.boundHandlers.documentMouseUp);
  }

  private handleColHeaderMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;

    const rect = this.colHeaderCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const scrollPos = this.viewport.getScrollPosition();

    const result = this.headerRenderer.getColumnAtPosition(x, scrollPos.x);
    if (result && result.isResizeHandle) {
      event.preventDefault();
      this.startResize("column", result.col, event.clientX);
    }
  }

  private handleRowHeaderMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;

    const rect = this.rowHeaderCanvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const scrollPos = this.viewport.getScrollPosition();

    const result = this.headerRenderer.getRowAtPosition(y, scrollPos.y);
    if (result && result.isResizeHandle) {
      event.preventDefault();
      this.startResize("row", result.row, event.clientY);
    }
  }

  private handleColHeaderMouseMove(event: MouseEvent): void {
    if (!this.enabled || this.isResizing) return;

    const rect = this.colHeaderCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const scrollPos = this.viewport.getScrollPosition();

    const result = this.headerRenderer.getColumnAtPosition(x, scrollPos.x);
    if (result && result.isResizeHandle) {
      this.colHeaderCanvas.style.cursor = "col-resize";
    } else {
      this.colHeaderCanvas.style.cursor = "pointer";
    }
  }

  private handleRowHeaderMouseMove(event: MouseEvent): void {
    if (!this.enabled || this.isResizing) return;

    const rect = this.rowHeaderCanvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const scrollPos = this.viewport.getScrollPosition();

    const result = this.headerRenderer.getRowAtPosition(y, scrollPos.y);
    if (result && result.isResizeHandle) {
      this.rowHeaderCanvas.style.cursor = "row-resize";
    } else {
      this.rowHeaderCanvas.style.cursor = "pointer";
    }
  }

  private startResize(
    type: "column" | "row",
    index: number,
    startPos: number,
  ): void {
    this.isResizing = true;
    this.resizeType = type;
    this.resizeIndex = index;
    this.startPosition = startPos;

    if (type === "column") {
      this.startSize = this.viewport.getColumnWidth(index);
    } else {
      this.startSize = this.viewport.getRowHeight(index);
    }

    // Add resize cursor to body during resize
    document.body.style.cursor =
      type === "column" ? "col-resize" : "row-resize";

    this.callbacks.onResizeStart?.();
  }

  private handleDocumentMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    const delta =
      this.resizeType === "column"
        ? event.clientX - this.startPosition
        : event.clientY - this.startPosition;

    const newSize = Math.max(this.minSize, this.startSize + delta);

    if (this.resizeType === "column") {
      this.viewport.setColumnWidth(this.resizeIndex, newSize);
      this.callbacks.onColumnResize?.(this.resizeIndex, newSize);
    } else {
      this.viewport.setRowHeight(this.resizeIndex, newSize);
      this.callbacks.onRowResize?.(this.resizeIndex, newSize);
    }
  }

  private handleDocumentMouseUp(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.resizeType = null;
    this.resizeIndex = -1;

    // Reset cursor
    document.body.style.cursor = "";

    this.callbacks.onResizeEnd?.();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;

    this.enabled = enabled;

    if (enabled) {
      this.setupEventListeners();
    } else {
      this.removeEventListeners();
      // Reset any resize state
      if (this.isResizing) {
        this.handleDocumentMouseUp();
      }
      // Reset cursors
      this.colHeaderCanvas.style.cursor = "";
      this.rowHeaderCanvas.style.cursor = "";
    }
  }

  destroy(): void {
    this.removeEventListeners();
  }
}
