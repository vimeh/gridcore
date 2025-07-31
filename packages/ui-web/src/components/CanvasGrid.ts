import { Grid, CellAddress, Cell, cellAddressToString } from '@gridcore/core';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { GridTheme, defaultTheme } from '../rendering/GridTheme';
import { Viewport } from './Viewport';
import { SelectionManager } from '../interaction/SelectionManager';
import { MouseHandler } from '../interaction/MouseHandler';
import { CellEditor } from './CellEditor';
import { KeyboardHandler } from '../interaction/KeyboardHandler';

export interface CanvasGridOptions {
  theme?: GridTheme;
  totalRows?: number;
  totalCols?: number;
}

export class CanvasGrid {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scrollContainer: HTMLElement;
  private grid: Grid;
  private theme: GridTheme;
  
  private viewport: Viewport;
  private renderer: CanvasRenderer;
  private selectionManager: SelectionManager;
  private mouseHandler: MouseHandler;
  private cellEditor: CellEditor;
  private keyboardHandler: KeyboardHandler;
  
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement, grid: Grid, options: CanvasGridOptions = {}) {
    this.container = container;
    this.grid = grid;
    this.theme = options.theme || defaultTheme;
    
    // Create DOM structure
    this.setupDOM();
    
    // Initialize components
    this.viewport = new Viewport(this.theme, options.totalRows, options.totalCols);
    this.renderer = new CanvasRenderer(this.canvas, this.theme, this.viewport);
    this.selectionManager = new SelectionManager();
    
    // Initialize interaction handlers
    this.cellEditor = new CellEditor(this.scrollContainer, this.viewport, {
      onCommit: this.handleCellCommit.bind(this),
      onCancel: this.handleCellCancel.bind(this)
    });
    
    this.mouseHandler = new MouseHandler(
      this.canvas,
      this.viewport,
      this.selectionManager,
      this.handleCellClick.bind(this),
      this.handleCellDoubleClick.bind(this)
    );
    
    this.keyboardHandler = new KeyboardHandler(
      this.container,
      this.selectionManager,
      this.cellEditor,
      this.grid
    );
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial render
    this.resize();
    
    // Set initial selection to A1
    this.selectionManager.setActiveCell({ row: 0, col: 0 });
    
    // Connect selection manager to our callback
    this.selectionManager.onActiveCellChange = (cell) => {
      this.onCellClick?.(cell);
    };
    
    this.render();
  }

  private setupDOM(): void {
    // Clear container
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    
    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'grid-scroll-container';
    this.scrollContainer.style.position = 'absolute';
    this.scrollContainer.style.top = '0';
    this.scrollContainer.style.left = '0';
    this.scrollContainer.style.right = '0';
    this.scrollContainer.style.bottom = '0';
    this.scrollContainer.style.overflow = 'auto';
    
    // Create canvas - fixed at origin, won't move with scroll
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'grid-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'auto'; // Ensure it can receive mouse events
    
    // Create spacer for scrolling
    const spacer = document.createElement('div');
    spacer.className = 'grid-spacer';
    spacer.style.position = 'relative';
    
    this.scrollContainer.appendChild(this.canvas);
    this.scrollContainer.appendChild(spacer);
    this.container.appendChild(this.scrollContainer);
  }

  private setupEventListeners(): void {
    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Scroll handling
    this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
    
    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleResize(): void {
    this.resize();
    this.render();
  }

  private handleScroll(): void {
    const scrollX = this.scrollContainer.scrollLeft;
    const scrollY = this.scrollContainer.scrollTop;
    
    // Get viewport dimensions and total grid dimensions
    const viewportWidth = this.scrollContainer.clientWidth;
    const viewportHeight = this.scrollContainer.clientHeight;
    const totalGridWidth = this.viewport.getTotalGridWidth();
    const totalGridHeight = this.viewport.getTotalGridHeight();
    
    // Calculate maximum scroll positions (where last row/col is visible)
    const maxScrollX = Math.max(0, totalGridWidth - viewportWidth);
    const maxScrollY = Math.max(0, totalGridHeight - viewportHeight);
    
    // Log when scrolling past the last row/column (should not happen with the fix)
    if (scrollX > maxScrollX) {
      console.warn(`[SCROLL] Scrolled past last column! scrollX: ${scrollX}, maxScrollX: ${maxScrollX}, excess: ${scrollX - maxScrollX}px`);
    }
    
    if (scrollY > maxScrollY) {
      console.warn(`[SCROLL] Scrolled past last row! scrollY: ${scrollY}, maxScrollY: ${maxScrollY}, excess: ${scrollY - maxScrollY}px`);
    }
    
    // Position the canvas to match the scroll position
    // But clamp it so it doesn't extend beyond the grid boundaries
    const canvasWidth = this.canvas.offsetWidth;
    const canvasHeight = this.canvas.offsetHeight;
    
    // Clamp canvas position so it doesn't extend beyond total grid size
    const clampedX = Math.min(scrollX, Math.max(0, totalGridWidth - canvasWidth));
    const clampedY = Math.min(scrollY, Math.max(0, totalGridHeight - canvasHeight));
    
    this.canvas.style.left = `${clampedX}px`;
    this.canvas.style.top = `${clampedY}px`;
    
    this.viewport.setScrollPosition(scrollX, scrollY);
    this.cellEditor.updatePosition();
    this.render();
  }

  private handleCellClick(cell: CellAddress): void {
    this.selectionManager.setActiveCell(cell);
    this.render();
    
    // Notify external handlers
    this.onCellClick?.(cell);
  }
  
  // Public method for external cell click handling
  public onCellClick?: (cell: CellAddress) => void;

  private handleCellDoubleClick(cell: CellAddress): void {
    const cellData = this.grid.getCell(cell);
    const initialValue = cellData?.formula || String(cellData?.rawValue || '');
    this.cellEditor.startEditing(cell, initialValue);
  }

  private handleCellCommit(address: CellAddress, value: string): void {
    // Check if it's a formula
    const isFormula = value.startsWith('=');
    
    if (isFormula) {
      // For now, just store the formula as-is
      // The calculation engine will be implemented later
      this.grid.setCell(address, value, value);
    } else {
      // Try to parse as number
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        this.grid.setCell(address, numValue);
      } else {
        this.grid.setCell(address, value);
      }
    }
    
    this.render();
  }

  private handleCellCancel(): void {
    this.render();
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Update canvas size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Update renderer
    this.renderer.resize(width, height);
    
    // Update spacer for scrolling
    // The spacer should be sized so that when scrolled to maximum,
    // the last row/column is visible at the bottom/right edge of the viewport
    const spacer = this.scrollContainer.querySelector('.grid-spacer') as HTMLElement;
    if (spacer) {
      const totalWidth = this.viewport.getTotalGridWidth();
      const totalHeight = this.viewport.getTotalGridHeight();
      
      // Maximum scrollable area = total content - viewport size
      // This ensures the last column/row is visible when scrolled to the end
      const maxScrollWidth = Math.max(0, totalWidth - width);
      const maxScrollHeight = Math.max(0, totalHeight - height);
      
      // Spacer should be sized to prevent scrolling beyond the last row/column
      // Since the canvas moves with scroll, we need to account for that
      // The spacer should be sized so that when fully scrolled, the canvas doesn't extend beyond it
      const spacerWidth = Math.max(width, totalWidth);
      const spacerHeight = Math.max(height, totalHeight);
      
      // Uncomment for debugging scroll issues
      // console.log(`[RESIZE] Setting spacer size: ${spacerWidth}x${spacerHeight}`);
      // console.log(`[RESIZE] Total grid: ${totalWidth}x${totalHeight}, Viewport: ${width}x${height}`);
      // console.log(`[RESIZE] Max scroll: ${maxScrollWidth}x${maxScrollHeight}`);
      
      spacer.style.width = `${spacerWidth}px`;
      spacer.style.height = `${spacerHeight}px`;
    }
  }

  render(): void {
    // Cancel any pending render
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Schedule render on next frame
    this.animationFrameId = requestAnimationFrame(() => {
      this.renderer.renderGrid((address) => this.grid.getCell(address));
      this.renderer.renderSelection(this.selectionManager.getSelectedCells());
      this.animationFrameId = null;
    });
  }

  destroy(): void {
    // Cancel any pending renders
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Clean up event listeners
    window.removeEventListener('resize', this.handleResize);
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    
    // Destroy components
    this.mouseHandler.destroy();
    this.cellEditor.destroy();
    this.keyboardHandler.destroy();
    
    // Clear container
    this.container.innerHTML = '';
  }

  // Public API
  getGrid(): Grid {
    return this.grid;
  }

  getSelectedCells(): CellAddress[] {
    const selected: CellAddress[] = [];
    for (const cellKey of this.selectionManager.getSelectedCells()) {
      const match = cellKey.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const col = match[1].charCodeAt(0) - 65;
        const row = parseInt(match[2]) - 1;
        selected.push({ row, col });
      }
    }
    return selected;
  }

  scrollToCell(address: CellAddress): void {
    const position = this.viewport.getCellPosition(address);
    const scrollPos = this.viewport.getScrollPosition();
    
    // Calculate if we need to scroll
    const viewportWidth = this.scrollContainer.clientWidth;
    const viewportHeight = this.scrollContainer.clientHeight;
    
    let newScrollX = scrollPos.x;
    let newScrollY = scrollPos.y;
    
    // Horizontal scroll
    if (position.x < this.theme.rowHeaderWidth) {
      newScrollX = scrollPos.x + position.x - this.theme.rowHeaderWidth;
    } else if (position.x + position.width > viewportWidth) {
      newScrollX = scrollPos.x + (position.x + position.width - viewportWidth);
    }
    
    // Vertical scroll
    if (position.y < this.theme.columnHeaderHeight) {
      newScrollY = scrollPos.y + position.y - this.theme.columnHeaderHeight;
    } else if (position.y + position.height > viewportHeight) {
      newScrollY = scrollPos.y + (position.y + position.height - viewportHeight);
    }
    
    this.scrollContainer.scrollLeft = newScrollX;
    this.scrollContainer.scrollTop = newScrollY;
  }
}