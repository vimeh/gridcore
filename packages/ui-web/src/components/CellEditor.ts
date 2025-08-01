import { CellAddress, Cell } from '@gridcore/core';
import { Viewport } from './Viewport';
import { KEY_CODES } from '../constants';

export interface CellEditorCallbacks {
  onCommit: (address: CellAddress, value: string) => void;
  onCancel: () => void;
  onEditEnd?: () => void;
  onEditStart?: () => void;
}

export class CellEditor {
  private input: HTMLInputElement;
  private isEditing: boolean = false;
  private currentCell: CellAddress | null = null;

  constructor(
    private container: HTMLElement,
    private viewport: Viewport,
    private callbacks: CellEditorCallbacks
  ) {
    this.input = this.createInput();
    this.container.appendChild(this.input);
  }

  private createInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.style.position = 'absolute';
    input.style.display = 'none';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.padding = '0 4px';
    input.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    input.style.fontSize = '13px';
    input.style.lineHeight = '1';
    input.style.backgroundColor = 'transparent';
    input.style.boxShadow = 'none';
    input.style.textShadow = 'none';
    input.style.zIndex = '1000';

    // Event listeners
    input.addEventListener('keydown', this.handleKeyDown.bind(this));
    input.addEventListener('blur', this.handleBlur.bind(this));

    return input;
  }

  startEditing(cell: CellAddress, initialValue: string = ''): void {
    if (this.isEditing) {
      this.commitEdit();
    }

    this.currentCell = cell;
    this.isEditing = true;
    
    // Notify that editing has started
    this.callbacks.onEditStart?.();

    const position = this.viewport.getCellPosition(cell);
    
    // Position the input
    this.input.style.left = `${position.x}px`;
    this.input.style.top = `${position.y}px`;
    this.input.style.width = `${position.width}px`;
    this.input.style.height = `${position.height}px`;
    this.input.style.display = 'block';
    
    // Set value and focus
    this.input.value = initialValue;
    this.input.focus();
    this.input.select();
  }

  stopEditing(commit: boolean = true): void {
    if (!this.isEditing) return;

    if (commit) {
      this.commitEdit();
    } else {
      this.cancelEdit();
    }
  }

  private commitEdit(): void {
    if (!this.currentCell) return;

    const value = this.input.value;
    this.callbacks.onCommit(this.currentCell, value);
    this.hideEditor();
  }

  private cancelEdit(): void {
    this.callbacks.onCancel();
    this.hideEditor();
  }

  private hideEditor(): void {
    this.isEditing = false;
    this.currentCell = null;
    this.input.style.display = 'none';
    this.input.value = '';
    
    // Return focus to the main container
    this.callbacks.onEditEnd?.();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case KEY_CODES.ENTER:
        event.preventDefault();
        this.commitEdit();
        break;
      case KEY_CODES.ESCAPE:
        event.preventDefault();
        this.cancelEdit();
        break;
      case KEY_CODES.TAB:
        event.preventDefault();
        this.commitEdit();
        // TODO: Move to next cell
        break;
    }
  }

  private handleBlur(): void {
    // Delay to allow click events to fire first
    setTimeout(() => {
      if (this.isEditing) {
        this.commitEdit();
      }
    }, 100);
  }

  updatePosition(): void {
    if (!this.isEditing || !this.currentCell) return;

    const position = this.viewport.getCellPosition(this.currentCell);
    this.input.style.left = `${position.x}px`;
    this.input.style.top = `${position.y}px`;
  }

  isCurrentlyEditing(): boolean {
    return this.isEditing;
  }

  getCurrentCell(): CellAddress | null {
    return this.currentCell;
  }

  destroy(): void {
    this.input.remove();
  }
}