import type { CellAddress } from "@gridcore/core";
import type { Viewport } from "../components/Viewport";
import type { WebStateAdapter } from "../state/WebStateAdapter";
import type { SelectionManager } from "./SelectionManager";

export type MouseEventHandler = (cell: CellAddress) => void;

export class MouseHandler {
  private isDragging: boolean = false;
  private enabled: boolean = true;
  private adapter?: WebStateAdapter;
  private boundHandlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    dblclick: (e: MouseEvent) => void;
    contextmenu: (e: MouseEvent) => void;
    selectstart: (e: Event) => void;
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private selectionManager: SelectionManager,
    private onCellClick?: MouseEventHandler,
    private onCellDoubleClick?: MouseEventHandler,
  ) {
    // Store bound handlers so we can remove them later
    this.boundHandlers = {
      mousedown: this.handleMouseDown.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      mouseup: this.handleMouseUp.bind(this),
      dblclick: this.handleDoubleClick.bind(this),
      contextmenu: (e) => e.preventDefault(),
      selectstart: (e) => {
        if (this.isDragging) e.preventDefault();
      },
    };

    this.setupEventListeners();
  }

  private getCellAddressAtPosition(x: number, y: number): CellAddress | null {
    return this.viewport.getCellAtPosition(x, y);
  }

  private setupEventListeners(): void {
    if (!this.enabled) return;

    this.canvas.addEventListener("mousedown", this.boundHandlers.mousedown);
    this.canvas.addEventListener("mousemove", this.boundHandlers.mousemove);
    this.canvas.addEventListener("mouseup", this.boundHandlers.mouseup);
    this.canvas.addEventListener("dblclick", this.boundHandlers.dblclick);
    this.canvas.addEventListener("contextmenu", this.boundHandlers.contextmenu);

    // Prevent text selection while dragging
    this.canvas.addEventListener("selectstart", this.boundHandlers.selectstart);
  }

  private removeEventListeners(): void {
    this.canvas.removeEventListener("mousedown", this.boundHandlers.mousedown);
    this.canvas.removeEventListener("mousemove", this.boundHandlers.mousemove);
    this.canvas.removeEventListener("mouseup", this.boundHandlers.mouseup);
    this.canvas.removeEventListener("dblclick", this.boundHandlers.dblclick);
    this.canvas.removeEventListener(
      "contextmenu",
      this.boundHandlers.contextmenu,
    );
    this.canvas.removeEventListener(
      "selectstart",
      this.boundHandlers.selectstart,
    );
  }

  setAdapter(adapter: WebStateAdapter): void {
    this.adapter = adapter;
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.getCellAddressAtPosition(x, y);
    if (!cell) return;

    this.isDragging = true;

    // If we have an adapter, use it for selection
    if (this.adapter) {
      if (event.shiftKey) {
        // For shift-click, first click to move cursor, then enter visual mode
        this.adapter.handleMouseAction({ type: "click", address: cell });
        this.adapter.handleMouseAction({ type: "dragStart", address: cell });
      } else {
        // Start new selection with drag
        this.adapter.handleMouseAction({ type: "dragStart", address: cell });
      }
      this.onCellClick?.(cell);
    } else {
      // Fallback to local selection manager
      if (event.shiftKey && this.selectionManager.getActiveCell()) {
        // Extend selection
        this.selectionManager.updateRangeSelection(cell);
      } else {
        // Start new selection
        this.selectionManager.startRangeSelection(cell);
        this.onCellClick?.(cell);
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled || !this.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Auto-scroll if near edges
    this.handleAutoScroll(x, y, rect);

    const cell = this.getCellAddressAtPosition(x, y);
    if (cell) {
      if (this.adapter) {
        // Use adapter to handle drag move
        this.adapter.handleMouseAction({ type: "dragMove", address: cell });
      } else {
        // Fallback to local selection manager
        this.selectionManager.updateRangeSelection(cell);
      }
    }
  }

  private handleMouseUp(_event: MouseEvent): void {
    this.isDragging = false;
    
    if (this.adapter) {
      // Let adapter know drag ended
      const rect = this.canvas.getBoundingClientRect();
      const x = _event.clientX - rect.left;
      const y = _event.clientY - rect.top;
      const cell = this.getCellAddressAtPosition(x, y);
      if (cell) {
        this.adapter.handleMouseAction({ type: "dragEnd", address: cell });
      }
    } else {
      // Fallback to local selection manager
      this.selectionManager.endRangeSelection();
    }
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (!this.enabled) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.getCellAddressAtPosition(x, y);
    if (cell) {
      this.onCellDoubleClick?.(cell);
    }
  }

  private handleAutoScroll(x: number, y: number, rect: DOMRect): void {
    const scrollSpeed = 10;
    const edgeThreshold = 30;
    const scrollPos = this.viewport.getScrollPosition();
    let newScrollX = scrollPos.x;
    let newScrollY = scrollPos.y;

    // Horizontal scrolling
    if (x < edgeThreshold) {
      newScrollX = Math.max(0, scrollPos.x - scrollSpeed);
    } else if (x > rect.width - edgeThreshold) {
      newScrollX = scrollPos.x + scrollSpeed;
    }

    // Vertical scrolling
    if (y < edgeThreshold) {
      newScrollY = Math.max(0, scrollPos.y - scrollSpeed);
    } else if (y > rect.height - edgeThreshold) {
      newScrollY = scrollPos.y + scrollSpeed;
    }

    if (newScrollX !== scrollPos.x || newScrollY !== scrollPos.y) {
      this.viewport.setScrollPosition(newScrollX, newScrollY);
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;

    this.enabled = enabled;

    if (enabled) {
      this.setupEventListeners();
    } else {
      this.removeEventListeners();
      // Reset any dragging state
      this.isDragging = false;
    }
  }

  destroy(): void {
    this.removeEventListeners();
  }
}
