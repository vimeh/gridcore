import { CellAddress } from "@gridcore/core";
import { Viewport } from "../components/Viewport";
import { SelectionManager } from "./SelectionManager";

export type MouseEventHandler = (cell: CellAddress) => void;

export class MouseHandler {
  private isDragging: boolean = false;
  private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private selectionManager: SelectionManager,
    private onCellClick?: MouseEventHandler,
    private onCellDoubleClick?: MouseEventHandler,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Prevent text selection while dragging
    this.canvas.addEventListener("selectstart", (e) => {
      if (this.isDragging) e.preventDefault();
    });
  }

  private handleMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.viewport.getCellAtPosition(x, y);
    if (!cell) return;

    this.isDragging = true;
    this.lastMousePosition = { x, y };

    if (event.shiftKey && this.selectionManager.getActiveCell()) {
      // Extend selection
      this.selectionManager.updateRangeSelection(cell);
    } else {
      // Start new selection
      this.selectionManager.startRangeSelection(cell);
      this.onCellClick?.(cell);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Auto-scroll if near edges
    this.handleAutoScroll(x, y, rect);

    const cell = this.viewport.getCellAtPosition(x, y);
    if (cell) {
      this.selectionManager.updateRangeSelection(cell);
    }

    this.lastMousePosition = { x, y };
  }

  private handleMouseUp(event: MouseEvent): void {
    this.isDragging = false;
    this.selectionManager.endRangeSelection();
  }

  private handleDoubleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.viewport.getCellAtPosition(x, y);
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

  destroy(): void {
    // Remove all event listeners
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("dblclick", this.handleDoubleClick);
  }
}
