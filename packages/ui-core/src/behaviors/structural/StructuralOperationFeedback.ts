import type { CellAddress } from "@gridcore/core";
import type { CellHighlight, HighlightType, StructuralUIEvent } from "./types";

/**
 * Styles for different highlight types
 */
export interface HighlightStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  animation?: string;
}

export const DEFAULT_HIGHLIGHT_STYLES: Record<HighlightType, HighlightStyle> = {
  affected: {
    backgroundColor: "rgba(59, 130, 246, 0.15)", // Blue
    borderColor: "rgba(59, 130, 246, 0.4)",
    borderWidth: 1,
    opacity: 0.7,
    animation: "pulse 2s infinite",
  },
  deleted: {
    backgroundColor: "rgba(239, 68, 68, 0.2)", // Red
    borderColor: "rgba(239, 68, 68, 0.6)",
    borderWidth: 2,
    opacity: 0.8,
    animation: "fadeOut 0.5s ease-in-out",
  },
  inserted: {
    backgroundColor: "rgba(34, 197, 94, 0.15)", // Green
    borderColor: "rgba(34, 197, 94, 0.4)",
    borderWidth: 1,
    opacity: 0.7,
    animation: "slideIn 0.3s ease-out",
  },
  warning: {
    backgroundColor: "rgba(245, 158, 11, 0.2)", // Amber
    borderColor: "rgba(245, 158, 11, 0.6)",
    borderWidth: 1,
    opacity: 0.8,
    animation: "blink 1s infinite",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.25)", // Red
    borderColor: "rgba(239, 68, 68, 0.8)",
    borderWidth: 2,
    opacity: 0.9,
    animation: "shake 0.5s ease-in-out",
  },
};

/**
 * Manages visual feedback for structural operations including cell highlighting,
 * animations, and visual cues.
 */
export class StructuralOperationFeedback {
  private activeHighlights: Map<string, CellHighlight> = new Map();
  private highlightStyles: Record<HighlightType, HighlightStyle>;
  private container?: HTMLElement;

  constructor(
    container?: HTMLElement,
    customStyles?: Partial<Record<HighlightType, Partial<HighlightStyle>>>
  ) {
    this.container = container;
    this.highlightStyles = { ...DEFAULT_HIGHLIGHT_STYLES };
    
    if (customStyles) {
      for (const [type, style] of Object.entries(customStyles)) {
        if (this.highlightStyles[type as HighlightType]) {
          this.highlightStyles[type as HighlightType] = {
            ...this.highlightStyles[type as HighlightType],
            ...style,
          };
        }
      }
    }

    this.setupCSS();
  }

  /**
   * Handle structural UI events and update visual feedback
   */
  handleEvent(event: StructuralUIEvent): void {
    switch (event.type) {
      case "highlightCells":
        this.highlightCells(event.cells, event.highlightType, event.duration);
        break;
      case "clearHighlights":
        this.clearAllHighlights();
        break;
      case "structuralOperationCompleted":
        // Show completion animation
        this.showCompletionFeedback(event.affectedCells);
        break;
      case "structuralOperationFailed":
        // Show error feedback
        this.showErrorFeedback();
        break;
    }
  }

  /**
   * Highlight specific cells with given style
   */
  highlightCells(
    cells: CellAddress[],
    type: HighlightType,
    duration?: number
  ): void {
    cells.forEach((cell) => {
      const key = this.getCellKey(cell);
      const highlight: CellHighlight = {
        address: cell,
        type,
      };

      this.activeHighlights.set(key, highlight);
      this.applyCellHighlight(cell, type);
    });

    // Auto-remove highlights after duration
    if (duration) {
      setTimeout(() => {
        this.clearHighlightsByType(type);
      }, duration);
    }
  }

  /**
   * Clear highlights of a specific type
   */
  clearHighlightsByType(type: HighlightType): void {
    const toRemove: string[] = [];
    
    for (const [key, highlight] of this.activeHighlights.entries()) {
      if (highlight.type === type) {
        this.removeCellHighlight(highlight.address);
        toRemove.push(key);
      }
    }

    toRemove.forEach((key) => this.activeHighlights.delete(key));
  }

  /**
   * Clear all highlights
   */
  clearAllHighlights(): void {
    for (const highlight of this.activeHighlights.values()) {
      this.removeCellHighlight(highlight.address);
    }
    this.activeHighlights.clear();
  }

  /**
   * Get all active highlights
   */
  getActiveHighlights(): CellHighlight[] {
    return Array.from(this.activeHighlights.values());
  }

  /**
   * Update highlight styles
   */
  updateStyles(
    type: HighlightType,
    style: Partial<HighlightStyle>
  ): void {
    this.highlightStyles[type] = {
      ...this.highlightStyles[type],
      ...style,
    };
    this.updateCSS();
  }

  /**
   * Show completion feedback animation
   */
  private showCompletionFeedback(affectedCells: CellAddress[]): void {
    // Briefly highlight completed operation
    this.highlightCells(affectedCells, "affected", 1000);
    
    // Add completion pulse animation
    affectedCells.forEach((cell) => {
      const element = this.getCellElement(cell);
      if (element) {
        element.classList.add("structural-operation-complete");
        setTimeout(() => {
          element.classList.remove("structural-operation-complete");
        }, 1000);
      }
    });
  }

  /**
   * Show error feedback
   */
  private showErrorFeedback(): void {
    // Add error shake animation to container
    if (this.container) {
      this.container.classList.add("structural-operation-error");
      setTimeout(() => {
        this.container?.classList.remove("structural-operation-error");
      }, 500);
    }
  }

  /**
   * Apply highlight styling to a cell
   */
  private applyCellHighlight(cell: CellAddress, type: HighlightType): void {
    const element = this.getCellElement(cell);
    if (!element) {
      return;
    }

    const style = this.highlightStyles[type];
    element.classList.add(`structural-highlight-${type}`);
    
    // Apply inline styles for dynamic highlighting
    element.style.setProperty("--highlight-bg", style.backgroundColor);
    element.style.setProperty("--highlight-border", style.borderColor);
    element.style.setProperty("--highlight-border-width", `${style.borderWidth}px`);
    element.style.setProperty("--highlight-opacity", style.opacity.toString());
    
    if (style.animation) {
      element.style.animation = style.animation;
    }
  }

  /**
   * Remove highlight styling from a cell
   */
  private removeCellHighlight(cell: CellAddress): void {
    const element = this.getCellElement(cell);
    if (!element) {
      return;
    }

    // Remove all highlight classes
    element.className = element.className.replace(/structural-highlight-\w+/g, "");
    
    // Clear inline styles
    element.style.removeProperty("--highlight-bg");
    element.style.removeProperty("--highlight-border");
    element.style.removeProperty("--highlight-border-width");
    element.style.removeProperty("--highlight-opacity");
    element.style.animation = "";
  }

  /**
   * Get DOM element for a cell (platform-specific implementation)
   */
  private getCellElement(cell: CellAddress): HTMLElement | null {
    if (!this.container) {
      return null;
    }

    // This is a generic implementation - real implementations would be platform-specific
    return this.container.querySelector(
      `[data-row="${cell.row}"][data-col="${cell.col}"]`
    ) as HTMLElement;
  }

  /**
   * Generate unique key for a cell
   */
  private getCellKey(cell: CellAddress): string {
    return `${cell.row}-${cell.col}`;
  }

  /**
   * Setup CSS styles for highlights
   */
  private setupCSS(): void {
    const style = document.createElement("style");
    style.id = "structural-operation-feedback-styles";
    
    style.textContent = this.generateCSS();
    
    // Remove existing styles if any
    const existing = document.getElementById("structural-operation-feedback-styles");
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(style);
  }

  /**
   * Update existing CSS styles
   */
  private updateCSS(): void {
    const existing = document.getElementById("structural-operation-feedback-styles");
    if (existing) {
      existing.textContent = this.generateCSS();
    } else {
      this.setupCSS();
    }
  }

  /**
   * Generate CSS for highlight styles
   */
  private generateCSS(): string {
    const css = Object.entries(this.highlightStyles)
      .map(([type, style]) => {
        return `
          .structural-highlight-${type} {
            background-color: var(--highlight-bg, ${style.backgroundColor}) !important;
            border: var(--highlight-border-width, ${style.borderWidth}px) solid var(--highlight-border, ${style.borderColor}) !important;
            opacity: var(--highlight-opacity, ${style.opacity}) !important;
            position: relative;
            z-index: 10;
          }
        `;
      })
      .join("\n");

    return css + `
      /* Animation keyframes */
      @keyframes pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      
      @keyframes fadeOut {
        0% { opacity: 0.8; }
        100% { opacity: 0.2; }
      }
      
      @keyframes slideIn {
        0% { 
          transform: translateY(-10px);
          opacity: 0;
        }
        100% { 
          transform: translateY(0);
          opacity: 0.7;
        }
      }
      
      @keyframes blink {
        0%, 50% { opacity: 0.8; }
        25%, 75% { opacity: 0.4; }
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
      }
      
      /* Completion feedback */
      .structural-operation-complete {
        animation: completePulse 1s ease-in-out !important;
      }
      
      @keyframes completePulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); background-color: rgba(34, 197, 94, 0.3); }
        100% { transform: scale(1); }
      }
      
      /* Error feedback */
      .structural-operation-error {
        animation: errorShake 0.5s ease-in-out !important;
      }
      
      @keyframes errorShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;
  }
}