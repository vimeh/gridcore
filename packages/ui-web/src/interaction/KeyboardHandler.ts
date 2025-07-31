import { Grid, CellAddress } from '@gridcore/core';
import { SelectionManager } from './SelectionManager';
import { CellEditor } from '../components/CellEditor';

export class KeyboardHandler {
  constructor(
    private container: HTMLElement,
    private selectionManager: SelectionManager,
    private cellEditor: CellEditor,
    private grid: Grid
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Make container focusable
    this.container.tabIndex = 0;
    this.container.style.outline = 'none';
    
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't handle if editing
    if (this.cellEditor.isCurrentlyEditing()) {
      return;
    }

    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.selectionManager.moveActiveCell('up');
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        this.selectionManager.moveActiveCell('down');
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        this.selectionManager.moveActiveCell('left');
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        this.selectionManager.moveActiveCell('right');
        break;
        
      case 'Enter':
        event.preventDefault();
        if (event.shiftKey) {
          this.selectionManager.moveActiveCell('up');
        } else {
          this.startEditingActiveCell();
        }
        break;
        
      case 'F2':
        event.preventDefault();
        this.startEditingActiveCell();
        break;
        
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.deleteSelectedCells();
        break;
        
      case 'Tab':
        event.preventDefault();
        if (event.shiftKey) {
          this.selectionManager.moveActiveCell('left');
        } else {
          this.selectionManager.moveActiveCell('right');
        }
        break;
        
      default:
        // Start editing if it's a printable character
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          this.startEditingActiveCell(event.key);
        }
        break;
    }

    // Handle Ctrl/Cmd shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'a':
        case 'A':
          event.preventDefault();
          this.selectAll();
          break;
          
        case 'c':
        case 'C':
          event.preventDefault();
          this.copySelection();
          break;
          
        case 'v':
        case 'V':
          event.preventDefault();
          this.pasteToSelection();
          break;
          
        case 'x':
        case 'X':
          event.preventDefault();
          this.cutSelection();
          break;
          
        case 'z':
        case 'Z':
          event.preventDefault();
          if (event.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          break;
      }
    }
  }

  private startEditingActiveCell(initialChar?: string): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    const cellData = this.grid.getCell(activeCell);
    let initialValue = '';
    
    if (initialChar) {
      initialValue = initialChar;
    } else {
      initialValue = cellData?.formula || String(cellData?.rawValue || '');
    }
    
    this.cellEditor.startEditing(activeCell, initialValue);
  }

  private deleteSelectedCells(): void {
    for (const cellKey of this.selectionManager.getSelectedCells()) {
      const match = cellKey.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const col = match[1].charCodeAt(0) - 65;
        const row = parseInt(match[2]) - 1;
        this.grid.clearCell({ row, col });
      }
    }
  }

  private selectAll(): void {
    // TODO: Implement select all
    console.log('Select all not yet implemented');
  }

  private copySelection(): void {
    // TODO: Implement copy
    console.log('Copy not yet implemented');
  }

  private pasteToSelection(): void {
    // TODO: Implement paste
    console.log('Paste not yet implemented');
  }

  private cutSelection(): void {
    // TODO: Implement cut
    console.log('Cut not yet implemented');
  }

  private undo(): void {
    // TODO: Implement undo
    console.log('Undo not yet implemented');
  }

  private redo(): void {
    // TODO: Implement redo
    console.log('Redo not yet implemented');
  }

  destroy(): void {
    this.container.removeEventListener('keydown', this.handleKeyDown);
  }
}