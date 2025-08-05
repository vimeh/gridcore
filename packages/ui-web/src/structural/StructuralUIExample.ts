import { SpreadsheetController } from "@gridcore/ui-core";
import {
  StructuralOperationFeedback,
  ProgressIndicator,
  WarningDialog,
  ConfirmationDialog,
  type StructuralUIEvent
} from "@gridcore/ui-core/behaviors/structural";

/**
 * Example integration of structural UI components with a web-based spreadsheet
 * 
 * This demonstrates how to:
 * 1. Set up all structural UI components
 * 2. Connect them to SpreadsheetController events
 * 3. Handle platform-specific rendering
 */
export class StructuralUIExample {
  private controller: SpreadsheetController;
  private feedback: StructuralOperationFeedback;
  private progressIndicator: ProgressIndicator;
  private warningDialog: WarningDialog;
  private confirmationDialog: ConfirmationDialog;
  private gridContainer: HTMLElement;
  private uiContainer: HTMLElement;

  constructor(
    controller: SpreadsheetController,
    gridContainer: HTMLElement,
    uiContainer: HTMLElement
  ) {
    this.controller = controller;
    this.gridContainer = gridContainer;
    this.uiContainer = uiContainer;

    this.setupUIComponents();
    this.connectToController();
  }

  /**
   * Initialize all structural UI components
   */
  private setupUIComponents(): void {
    // Configure feedback for web-specific cell highlighting
    this.feedback = new StructuralOperationFeedback(this.gridContainer, {
      affected: {
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        borderWidth: 2,
        opacity: 0.8,
        animation: "pulse 1.5s infinite"
      },
      deleted: {
        backgroundColor: "rgba(239, 68, 68, 0.25)",
        borderColor: "rgba(239, 68, 68, 0.6)",
        borderWidth: 2,
        opacity: 0.9,
        animation: "fadeOut 1s ease-in-out"
      },
      warning: {
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        borderColor: "rgba(245, 158, 11, 0.8)",
        borderWidth: 1,
        opacity: 0.85,
        animation: "blink 0.8s infinite"
      }
    });

    // Configure progress indicator for the web UI
    this.progressIndicator = new ProgressIndicator(this.uiContainer, {
      showPercentage: true,
      showEstimatedTime: true,
      showCancelButton: true,
      position: "top",
      theme: "auto",
      autoHide: true,
      minDisplayTime: 800
    });

    // Configure warning dialog
    this.warningDialog = new WarningDialog(this.uiContainer, {
      maxWarnings: 8,
      showSeverityIcons: true,
      allowDismiss: true,
      autoHideMs: 6000,
      position: "top",
      theme: "auto"
    });

    // Configure confirmation dialog
    this.confirmationDialog = new ConfirmationDialog(this.uiContainer, {
      showWarnings: true,
      showCellCount: true,
      showFormulaImpact: true,
      defaultButton: "cancel",
      theme: "auto",
      blurBackground: true,
      allowEscapeToCancel: true
    });

    // Set up cancel callback for progress indicator
    this.progressIndicator.setCancelCallback(() => {
      const manager = this.controller.getStructuralUIManager();
      manager.cancelOperation();
    });
  }

  /**
   * Connect UI components to controller events
   */
  private connectToController(): void {
    this.controller.subscribe((event) => {
      if (event.type === "structuralUIEvent") {
        this.handleStructuralUIEvent(event.event);
      }
    });
  }

  /**
   * Handle structural UI events and route them to appropriate components
   */
  private handleStructuralUIEvent(event: StructuralUIEvent): void {
    // Route events to all relevant components
    this.feedback.handleEvent(event);
    this.progressIndicator.handleEvent(event);
    this.warningDialog.handleEvent(event);
    this.confirmationDialog.handleEvent(event);

    // Handle web-specific additional actions
    switch (event.type) {
      case "structuralOperationStarted":
        this.onOperationStarted(event);
        break;
      case "structuralOperationCompleted":
        this.onOperationCompleted(event);
        break;
      case "structuralOperationFailed":
        this.onOperationFailed(event);
        break;
      case "highlightCells":
        this.onCellsHighlighted(event);
        break;
    }
  }

  /**
   * Handle operation started - show loading state
   */
  private onOperationStarted(event: any): void {
    // Add loading class to grid
    this.gridContainer.classList.add("structural-operation-active");
    
    // Disable grid interactions during operation
    this.setGridInteractionEnabled(false);

    console.log(`Started ${event.operation.type}: ${event.operation.count} items at index ${event.operation.index}`);
  }

  /**
   * Handle operation completed - show success feedback
   */
  private onOperationCompleted(event: any): void {
    // Remove loading state
    this.gridContainer.classList.remove("structural-operation-active");
    
    // Re-enable grid interactions
    this.setGridInteractionEnabled(true);

    // Show success notification
    this.showNotification("success", `Operation completed successfully in ${event.duration}ms`);

    console.log(`Completed ${event.operation.type}: affected ${event.affectedCells.length} cells`);
  }

  /**
   * Handle operation failed - show error state
   */
  private onOperationFailed(event: any): void {
    // Remove loading state
    this.gridContainer.classList.remove("structural-operation-active");
    
    // Re-enable grid interactions
    this.setGridInteractionEnabled(true);

    // Show error notification
    this.showNotification("error", `Operation failed: ${event.error}`);

    console.error(`Failed ${event.operation.type}: ${event.error}`);
  }

  /**
   * Handle cell highlighting - ensure cells are visible
   */
  private onCellsHighlighted(event: any): void {
    // Ensure highlighted cells are in viewport
    if (event.cells.length > 0) {
      this.ensureCellsVisible(event.cells);
    }
  }

  /**
   * Enable or disable grid interactions
   */
  private setGridInteractionEnabled(enabled: boolean): void {
    if (enabled) {
      this.gridContainer.classList.remove("interaction-disabled");
      this.gridContainer.style.pointerEvents = "";
    } else {
      this.gridContainer.classList.add("interaction-disabled");
      this.gridContainer.style.pointerEvents = "none";
    }
  }

  /**
   * Ensure specified cells are visible in the viewport
   */
  private ensureCellsVisible(cells: Array<{ row: number; col: number }>): void {
    if (cells.length === 0) return;

    // Find the bounding box of all highlighted cells
    const minRow = Math.min(...cells.map(c => c.row));
    const maxRow = Math.max(...cells.map(c => c.row));
    const minCol = Math.min(...cells.map(c => c.col));
    const maxCol = Math.max(...cells.map(c => c.col));

    // Get current viewport
    const state = this.controller.getState();
    const viewport = state.viewport;

    // Check if cells are outside viewport
    const needsScroll = 
      minRow < viewport.startRow ||
      maxRow >= viewport.startRow + viewport.rows ||
      minCol < viewport.startCol ||
      maxCol >= viewport.startCol + viewport.cols;

    if (needsScroll) {
      // Calculate new viewport to center the highlighted area
      const centerRow = Math.floor((minRow + maxRow) / 2);
      const centerCol = Math.floor((minCol + maxCol) / 2);
      
      // Scroll to center the highlighted cells
      this.scrollToCell(centerRow, centerCol);
    }
  }

  /**
   * Scroll viewport to show a specific cell
   */
  private scrollToCell(row: number, col: number): void {
    const state = this.controller.getState();
    const viewport = state.viewport;
    
    const newStartRow = Math.max(0, row - Math.floor(viewport.rows / 2));
    const newStartCol = Math.max(0, col - Math.floor(viewport.cols / 2));

    // Use controller's viewport management
    // Note: This would typically integrate with the actual viewport manager
    console.log(`Scrolling to show cell ${row},${col} - new viewport start: ${newStartRow},${newStartCol}`);
  }

  /**
   * Show a notification to the user
   */
  private showNotification(type: "success" | "error" | "info", message: string): void {
    // Create a simple notification element
    const notification = document.createElement("div");
    notification.className = `structural-notification structural-notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 16px",
      borderRadius: "6px",
      color: "white",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "1003",
      transform: "translateX(100%)",
      transition: "transform 0.3s ease-in-out",
      backgroundColor: type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"
    });

    // Add to UI container
    this.uiContainer.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = "translateX(0)";
    });

    // Auto-remove after delay
    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Trigger a test row insertion
   */
  async testInsertRows(): Promise<void> {
    try {
      await this.controller.insertRows(5, 3);
    } catch (error) {
      console.error("Failed to insert rows:", error);
    }
  }

  /**
   * Trigger a test row deletion
   */
  async testDeleteRows(): Promise<void> {
    try {
      await this.controller.deleteRows(8, 2);
    } catch (error) {
      console.error("Failed to delete rows:", error);
    }
  }

  /**
   * Trigger a test large operation that shows progress
   */
  async testLargeOperation(): Promise<void> {
    try {
      // Insert many rows to trigger progress indicator
      await this.controller.insertRows(10, 150);
    } catch (error) {
      console.error("Failed to perform large operation:", error);
    }
  }

  /**
   * Clean up event listeners and components
   */
  destroy(): void {
    // Clear any active highlights
    this.feedback.clearAllHighlights();
    
    // Hide any visible dialogs
    if (this.warningDialog.isShowing()) {
      this.warningDialog.hide();
    }
    
    if (this.confirmationDialog.isShowing()) {
      this.confirmationDialog.hide();
    }

    // Remove any active notifications
    const notifications = this.uiContainer.querySelectorAll(".structural-notification");
    notifications.forEach(n => n.remove());

    // Re-enable grid interactions
    this.setGridInteractionEnabled(true);
    this.gridContainer.classList.remove("structural-operation-active");
  }
}

/**
 * Helper function to create and initialize structural UI for a web spreadsheet
 */
export function createStructuralUI(
  controller: SpreadsheetController,
  gridContainer: HTMLElement,
  uiContainer: HTMLElement = document.body
): StructuralUIExample {
  return new StructuralUIExample(controller, gridContainer, uiContainer);
}

/**
 * Example CSS that should be added to the page for optimal visual feedback
 */
export const STRUCTURAL_UI_CSS = `
  /* Grid interaction states */
  .structural-operation-active {
    position: relative;
    overflow: hidden;
  }
  
  .structural-operation-active::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.02);
    pointer-events: none;
    z-index: 1;
  }
  
  .interaction-disabled {
    opacity: 0.7;
    cursor: wait !important;
  }
  
  .interaction-disabled * {
    pointer-events: none !important;
  }
  
  /* Enhanced cell highlighting for web */
  [data-row][data-col] {
    position: relative;
    transition: all 0.2s ease;
  }
  
  .structural-highlight-affected {
    box-shadow: inset 0 0 0 var(--highlight-border-width) var(--highlight-border);
    z-index: 5;
  }
  
  .structural-highlight-deleted {
    box-shadow: inset 0 0 0 var(--highlight-border-width) var(--highlight-border);
    z-index: 6;
  }
  
  .structural-highlight-inserted {
    box-shadow: inset 0 0 0 var(--highlight-border-width) var(--highlight-border);
    z-index: 5;
  }
  
  .structural-highlight-warning {
    box-shadow: 
      inset 0 0 0 var(--highlight-border-width) var(--highlight-border),
      0 0 8px rgba(245, 158, 11, 0.3);
    z-index: 7;
  }
  
  .structural-highlight-error {
    box-shadow: 
      inset 0 0 0 var(--highlight-border-width) var(--highlight-border),
      0 0 8px rgba(239, 68, 68, 0.4);
    z-index: 8;
  }
  
  /* Notification styles */
  .structural-notification {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(4px);
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .structural-progress-indicator {
      width: 95vw;
      max-width: none;
    }
    
    .structural-confirmation-dialog {
      width: 95vw;
      margin: 10px;
    }
    
    .structural-warning-dialog {
      width: 95vw;
      max-width: none;
    }
  }
`;