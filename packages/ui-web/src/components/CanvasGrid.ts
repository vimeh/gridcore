import { Grid, CellAddress, parseCellAddress } from '@gridcore/core';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { HeaderRenderer } from '../rendering/HeaderRenderer';
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
  private canvas!: HTMLCanvasElement;
  private rowHeaderCanvas!: HTMLCanvasElement;
  private colHeaderCanvas!: HTMLCanvasElement;
  private cornerCanvas!: HTMLCanvasElement;
  private scrollContainer!: HTMLElement;
  private grid: Grid;
  private theme: GridTheme;
  
  private viewport: Viewport;
  private renderer: CanvasRenderer;
  private headerRenderer!: HeaderRenderer;
  private selectionManager: SelectionManager;
  private mouseHandler: MouseHandler;
  private cellEditor: CellEditor;
  private keyboardHandler: KeyboardHandler;
  
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement, grid: Grid, options: CanvasGridOptions = {}) {
    this.container = container;
    this.grid = grid;
    this.theme = options.theme || defaultTheme;
    
    this.setupDOM();
    
    this.viewport = new Viewport(this.theme, options.totalRows, options.totalCols);
    this.renderer = new CanvasRenderer(this.canvas, this.theme, this.viewport);
    this.headerRenderer = new HeaderRenderer(
      this.rowHeaderCanvas,
      this.colHeaderCanvas,
      this.cornerCanvas,
      this.theme,
      this.viewport
    );
    this.selectionManager = new SelectionManager();
    
    this.cellEditor = new CellEditor(this.scrollContainer, this.viewport, {
      onCommit: this.handleCellCommit.bind(this),
      onCancel: this.handleCellCancel.bind(this),
      onEditEnd: () => this.container.focus(),
      onEditStart: () => this.render()
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
    
    this.setupEventListeners();
    
    this.selectionManager.setActiveCell({ row: 0, col: 0 });
    
    this.selectionManager.onActiveCellChange = (cell) => {
      this.scrollToCell(cell);
      this.render();
      this.onCellClick?.(cell);
    };
    
    requestAnimationFrame(() => {
      this.resize();
      this.render();
    });
  }

  private setupDOM(): void {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    
    this.cornerCanvas = document.createElement('canvas');
    this.cornerCanvas.className = 'grid-corner-canvas';
    this.cornerCanvas.style.position = 'absolute';
    this.cornerCanvas.style.top = '0';
    this.cornerCanvas.style.left = '0';
    this.cornerCanvas.style.width = `${this.theme.rowHeaderWidth}px`;
    this.cornerCanvas.style.height = `${this.theme.columnHeaderHeight}px`;
    this.cornerCanvas.style.zIndex = '3';
    this.cornerCanvas.style.pointerEvents = 'auto';
    this.cornerCanvas.style.backgroundColor = this.theme.headerBackgroundColor;
    
    this.colHeaderCanvas = document.createElement('canvas');
    this.colHeaderCanvas.className = 'grid-col-header-canvas';
    this.colHeaderCanvas.style.position = 'absolute';
    this.colHeaderCanvas.style.top = '0';
    this.colHeaderCanvas.style.left = `${this.theme.rowHeaderWidth}px`;
    this.colHeaderCanvas.style.right = '0';
    this.colHeaderCanvas.style.height = `${this.theme.columnHeaderHeight}px`;
    this.colHeaderCanvas.style.zIndex = '2';
    this.colHeaderCanvas.style.pointerEvents = 'auto';
    this.colHeaderCanvas.style.backgroundColor = this.theme.headerBackgroundColor;
    
    this.rowHeaderCanvas = document.createElement('canvas');
    this.rowHeaderCanvas.className = 'grid-row-header-canvas';
    this.rowHeaderCanvas.style.position = 'absolute';
    this.rowHeaderCanvas.style.top = `${this.theme.columnHeaderHeight}px`;
    this.rowHeaderCanvas.style.left = '0';
    this.rowHeaderCanvas.style.width = `${this.theme.rowHeaderWidth}px`;
    this.rowHeaderCanvas.style.bottom = '0';
    this.rowHeaderCanvas.style.zIndex = '2';
    this.rowHeaderCanvas.style.pointerEvents = 'auto';
    this.rowHeaderCanvas.style.backgroundColor = this.theme.headerBackgroundColor;
    
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'grid-scroll-container';
    this.scrollContainer.style.position = 'absolute';
    this.scrollContainer.style.top = `${this.theme.columnHeaderHeight}px`;
    this.scrollContainer.style.left = `${this.theme.rowHeaderWidth}px`;
    this.scrollContainer.style.right = '0';
    this.scrollContainer.style.bottom = '0';
    this.scrollContainer.style.overflow = 'auto';
    
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'grid-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.pointerEvents = 'auto';
    
    const spacer = document.createElement('div');
    spacer.className = 'grid-spacer';
    spacer.style.position = 'relative';
    
    this.scrollContainer.appendChild(this.canvas);
    this.scrollContainer.appendChild(spacer);
    
    this.container.appendChild(this.scrollContainer);
    this.container.appendChild(this.cornerCanvas);
    this.container.appendChild(this.colHeaderCanvas);
    this.container.appendChild(this.rowHeaderCanvas);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.handleResize.bind(this));
    this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    this.scrollContainer.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
    
    [this.cornerCanvas, this.colHeaderCanvas, this.rowHeaderCanvas].forEach(canvas => {
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
    });
  }

  private handleResize(): void {
    this.resize();
    this.render();
  }

  private handleScroll(): void {
    const scrollX = this.scrollContainer.scrollLeft;
    const scrollY = this.scrollContainer.scrollTop;

    const totalGridWidth = this.viewport.getTotalGridWidth();
    const totalGridHeight = this.viewport.getTotalGridHeight();

    const canvasWidth = this.canvas.offsetWidth;
    const canvasHeight = this.canvas.offsetHeight;

    const clampedX = Math.min(scrollX, Math.max(0, totalGridWidth - canvasWidth));
    const clampedY = Math.min(scrollY, Math.max(0, totalGridHeight - canvasHeight));

    this.canvas.style.left = `${clampedX}px`;
    this.canvas.style.top = `${clampedY}px`;
    
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
    const cellData = this.grid.getCell(cell);
    const initialValue = cellData?.formula || String(cellData?.rawValue || '');
    this.cellEditor.startEditing(cell, initialValue);
  }

  private handleCellCommit(address: CellAddress, value: string): void {
    const isFormula = value.startsWith('=');
    
    if (isFormula) {
      this.grid.setCell(address, value, value);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        this.grid.setCell(address, numValue);
      } else {
        this.grid.setCell(address, value);
      }
    }
    
    this.render();
    this.container.focus();
  }

  private handleCellCancel(): void {
    this.render();
    this.container.focus();
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    this.colHeaderCanvas.style.width = `${width - this.theme.rowHeaderWidth}px`;
    this.rowHeaderCanvas.style.height = `${height - this.theme.columnHeaderHeight}px`;
    
    const scrollWidth = width - this.theme.rowHeaderWidth;
    const scrollHeight = height - this.theme.columnHeaderHeight;
    
    this.canvas.style.width = `${scrollWidth}px`;
    this.canvas.style.height = `${scrollHeight}px`;
    
    this.renderer.resize(scrollWidth, scrollHeight);
    this.headerRenderer.resize();
    
    const spacer = this.scrollContainer.querySelector('.grid-spacer') as HTMLElement;
    if (spacer) {
      const totalWidth = this.viewport.getTotalGridWidth();
      const totalHeight = this.viewport.getTotalGridHeight();
      
      const spacerWidth = Math.max(scrollWidth, totalWidth);
      const spacerHeight = Math.max(scrollHeight, totalHeight);
      
      spacer.style.width = `${spacerWidth}px`;
      spacer.style.height = `${spacerHeight}px`;
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
      this.renderer.renderGrid(
        (address) => this.grid.getCell(address),
        this.selectionManager.getSelectedCells(),
        this.selectionManager.getActiveCell(),
        this.cellEditor.isCurrentlyEditing()
      );
      this.animationFrameId = null;
    });
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('resize', this.handleResize);
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    
    this.mouseHandler.destroy();
    this.cellEditor.destroy();
    this.keyboardHandler.destroy();
    
    this.container.innerHTML = '';
  }

  getGrid(): Grid {
    return this.grid;
  }

  getSelectedCells(): CellAddress[] {
    const selected: CellAddress[] = [];
    for (const cellKey of this.selectionManager.getSelectedCells()) {
      const address = parseCellAddress(cellKey);
      if (address) {
        selected.push(address);
      }
    }
    return selected;
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
      newScrollY = scrollPos.y + (position.y + position.height - viewportHeight);
    }
    
    this.scrollContainer.scrollLeft = newScrollX;
    this.scrollContainer.scrollTop = newScrollY;
  }
}
