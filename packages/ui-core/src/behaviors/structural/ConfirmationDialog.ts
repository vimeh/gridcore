import type { StructuralOperation, StructuralUIEvent, StructuralWarning } from "./types";

export interface ConfirmationDialogConfig {
  showWarnings: boolean;
  showCellCount: boolean;
  showFormulaImpact: boolean;
  defaultButton: "confirm" | "cancel";
  theme: "light" | "dark" | "auto";
  blurBackground: boolean;
  allowEscapeToCancel: boolean;
}

export const DEFAULT_CONFIRMATION_CONFIG: ConfirmationDialogConfig = {
  showWarnings: true,
  showCellCount: true,
  showFormulaImpact: true,
  defaultButton: "cancel",
  theme: "auto",
  blurBackground: true,
  allowEscapeToCancel: true,
};

/**
 * Confirmation dialog for destructive structural operations
 */
export class ConfirmationDialog {
  private config: ConfirmationDialogConfig;
  private container?: HTMLElement;
  private dialogElement?: HTMLElement;
  private overlayElement?: HTMLElement;
  private isVisible = false;
  private currentOperation?: StructuralOperation;
  private currentWarnings: StructuralWarning[] = [];
  private onConfirm?: () => void;
  private onCancel?: () => void;

  constructor(
    container?: HTMLElement,
    config: Partial<ConfirmationDialogConfig> = {}
  ) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIRMATION_CONFIG, ...config };
    this.setupStyles();
  }

  /**
   * Handle structural UI events
   */
  handleEvent(event: StructuralUIEvent): void {
    switch (event.type) {
      case "structuralOperationConfirmationRequired":
        this.show(event.operation, event.warnings, event.onConfirm, event.onCancel);
        break;
    }
  }

  /**
   * Show confirmation dialog
   */
  show(
    operation: StructuralOperation,
    warnings: StructuralWarning[],
    onConfirm: () => void,
    onCancel: () => void
  ): void {
    if (this.isVisible) {
      this.hide();
    }

    this.currentOperation = operation;
    this.currentWarnings = warnings;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    this.createDialogElements();
    this.attachToContainer();
    this.isVisible = true;

    // Trigger animation
    requestAnimationFrame(() => {
      this.overlayElement?.classList.add("showing");
      this.dialogElement?.classList.add("showing");
    });

    // Focus default button
    this.focusDefaultButton();
  }

  /**
   * Hide confirmation dialog
   */
  hide(): void {
    if (!this.isVisible) {
      return;
    }

    this.overlayElement?.classList.add("hiding");
    this.dialogElement?.classList.add("hiding");

    setTimeout(() => {
      this.removeDialogElements();
      this.isVisible = false;
      this.currentOperation = undefined;
      this.currentWarnings = [];
      this.onConfirm = undefined;
      this.onCancel = undefined;
    }, 300); // Animation duration
  }

  /**
   * Confirm the operation
   */
  confirm(): void {
    if (this.onConfirm) {
      this.onConfirm();
    }
    this.hide();
  }

  /**
   * Cancel the operation
   */
  cancel(): void {
    if (this.onCancel) {
      this.onCancel();
    }
    this.hide();
  }

  /**
   * Check if dialog is currently visible
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Create dialog elements
   */
  private createDialogElements(): void {
    if (!this.currentOperation) {
      return;
    }

    // Create overlay
    this.overlayElement = document.createElement("div");
    this.overlayElement.className = `structural-confirmation-overlay ${this.config.blurBackground ? "blur" : ""}`;

    // Create dialog
    this.dialogElement = document.createElement("div");
    this.dialogElement.className = `structural-confirmation-dialog structural-confirmation-${this.config.theme}`;

    const operationText = this.getOperationText(this.currentOperation);
    const severity = this.getOperationSeverity(this.currentOperation, this.currentWarnings);
    const icon = this.getSeverityIcon(severity);
    
    this.dialogElement.innerHTML = `
      <div class="confirmation-content">
        <div class="confirmation-header">
          <div class="confirmation-icon ${severity}">
            ${icon}
          </div>
          <div class="confirmation-title">
            <h3>Confirm ${this.getOperationTypeText(this.currentOperation.type)}</h3>
            <p class="operation-description">${operationText}</p>
          </div>
        </div>
        
        ${this.config.showCellCount ? this.renderCellCountInfo() : ''}
        ${this.config.showWarnings && this.currentWarnings.length > 0 ? this.renderWarnings() : ''}
        ${this.config.showFormulaImpact ? this.renderFormulaImpact() : ''}
        
        <div class="confirmation-actions">
          <button class="cancel-button ${this.config.defaultButton === 'cancel' ? 'default' : ''}" type="button">
            Cancel
          </button>
          <button class="confirm-button ${this.config.defaultButton === 'confirm' ? 'default' : ''} ${severity}" type="button">
            ${this.getConfirmButtonText(this.currentOperation.type)}
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    this.addEventListeners();
  }

  /**
   * Render cell count information
   */
  private renderCellCountInfo(): string {
    if (!this.currentOperation) {
      return "";
    }

    const count = this.currentOperation.count;
    const type = this.currentOperation.type.includes("Row") ? "row" : "column";
    const action = this.currentOperation.type.includes("delete") ? "deleted" : "inserted";
    
    return `
      <div class="confirmation-section">
        <h4>Impact Summary</h4>
        <div class="impact-item">
          <span class="impact-label">${type.charAt(0).toUpperCase() + type.slice(1)}s ${action}:</span>
          <span class="impact-value">${count}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render warnings section
   */
  private renderWarnings(): string {
    if (this.currentWarnings.length === 0) {
      return "";
    }

    const warningsList = this.currentWarnings
      .map((warning) => {
        const icon = this.getSeverityIcon(warning.severity);
        return `
          <div class="warning-item warning-${warning.severity}">
            <span class="warning-icon">${icon}</span>
            <div class="warning-content">
              <div class="warning-message">${warning.message}</div>
              <div class="warning-details">${warning.affectedCells.length} cells affected</div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="confirmation-section warnings">
        <h4>Warnings</h4>
        <div class="warnings-list">
          ${warningsList}
        </div>
      </div>
    `;
  }

  /**
   * Render formula impact information
   */
  private renderFormulaImpact(): string {
    const formulaWarnings = this.currentWarnings.filter(w => w.type === "formulaReference");
    if (formulaWarnings.length === 0) {
      return "";
    }

    const totalAffectedCells = formulaWarnings.reduce((sum, w) => sum + w.affectedCells.length, 0);

    return `
      <div class="confirmation-section formula-impact">
        <h4>Formula Impact</h4>
        <div class="impact-item">
          <span class="impact-label">Formulas affected:</span>
          <span class="impact-value">${totalAffectedCells}</span>
        </div>
        <div class="formula-impact-note">
          Some formulas may show #REF! errors after this operation.
        </div>
      </div>
    `;
  }

  /**
   * Get operation description text
   */
  private getOperationText(operation: StructuralOperation): string {
    const count = operation.count > 1 ? `${operation.count} ` : "";
    const position = operation.index + 1; // 1-indexed for user display
    
    switch (operation.type) {
      case "insertRow":
        return `Insert ${count}row${operation.count > 1 ? "s" : ""} before row ${position}`;
      case "insertColumn":
        return `Insert ${count}column${operation.count > 1 ? "s" : ""} before column ${position}`;
      case "deleteRow":
        return `Delete ${count}row${operation.count > 1 ? "s" : ""} starting at row ${position}`;
      case "deleteColumn":
        return `Delete ${count}column${operation.count > 1 ? "s" : ""} starting at column ${position}`;
      default:
        return "Perform structural operation";
    }
  }

  /**
   * Get operation type text for title
   */
  private getOperationTypeText(type: string): string {
    switch (type) {
      case "insertRow":
        return "Row Insertion";
      case "insertColumn":
        return "Column Insertion";
      case "deleteRow":
        return "Row Deletion";
      case "deleteColumn":
        return "Column Deletion";
      default:
        return "Operation";
    }
  }

  /**
   * Get confirm button text
   */
  private getConfirmButtonText(type: string): string {
    switch (type) {
      case "insertRow":
      case "insertColumn":
        return "Insert";
      case "deleteRow":
      case "deleteColumn":
        return "Delete";
      default:
        return "Confirm";
    }
  }

  /**
   * Get operation severity
   */
  private getOperationSeverity(operation: StructuralOperation, warnings: StructuralWarning[]): string {
    // Check for high-severity warnings
    if (warnings.some(w => w.severity === "error")) {
      return "error";
    }
    
    if (warnings.some(w => w.severity === "warning")) {
      return "warning";
    }

    // Deletion operations are inherently more dangerous
    if (operation.type.includes("delete")) {
      return "warning";
    }

    return "info";
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case "info":
        return "ℹ";
      case "warning":
        return "⚠";
      case "error":
        return "⚠";
      default:
        return "•";
    }
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.dialogElement || !this.overlayElement) {
      return;
    }

    // Confirm button
    const confirmButton = this.dialogElement.querySelector(".confirm-button");
    if (confirmButton) {
      confirmButton.addEventListener("click", () => this.confirm());
    }

    // Cancel button
    const cancelButton = this.dialogElement.querySelector(".cancel-button");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => this.cancel());
    }

    // Overlay click to cancel
    this.overlayElement.addEventListener("click", (event) => {
      if (event.target === this.overlayElement) {
        this.cancel();
      }
    });

    // Keyboard events
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!this.isVisible) {
        return;
      }

      switch (event.key) {
        case "Escape":
          if (this.config.allowEscapeToCancel) {
            this.cancel();
          }
          break;
        case "Enter":
          if (this.config.defaultButton === "confirm") {
            this.confirm();
          } else {
            this.cancel();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Store reference to remove listener later
    (this.dialogElement as any)._keydownHandler = handleKeyDown;
  }

  /**
   * Focus default button
   */
  private focusDefaultButton(): void {
    if (!this.dialogElement) {
      return;
    }

    const defaultButton = this.dialogElement.querySelector(`.${this.config.defaultButton}-button`) as HTMLElement;
    if (defaultButton) {
      setTimeout(() => defaultButton.focus(), 100);
    }
  }

  /**
   * Attach dialog to container
   */
  private attachToContainer(): void {
    if (!this.overlayElement || !this.dialogElement) {
      return;
    }

    this.overlayElement.appendChild(this.dialogElement);

    if (this.container) {
      this.container.appendChild(this.overlayElement);
    } else {
      document.body.appendChild(this.overlayElement);
    }
  }

  /**
   * Remove dialog elements
   */
  private removeDialogElements(): void {
    // Remove keydown listener
    if (this.dialogElement && (this.dialogElement as any)._keydownHandler) {
      document.removeEventListener("keydown", (this.dialogElement as any)._keydownHandler);
    }

    if (this.overlayElement) {
      if (this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement);
      }
      this.overlayElement = undefined;
    }

    this.dialogElement = undefined;
  }

  /**
   * Setup CSS styles
   */
  private setupStyles(): void {
    const style = document.createElement("style");
    style.id = "structural-confirmation-dialog-styles";
    
    style.textContent = `
      .structural-confirmation-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1002;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }
      
      .structural-confirmation-overlay.blur {
        backdrop-filter: blur(4px);
      }
      
      .structural-confirmation-overlay.showing {
        opacity: 1;
      }
      
      .structural-confirmation-overlay.hiding {
        opacity: 0;
      }
      
      .structural-confirmation-dialog {
        background: var(--confirmation-bg, white);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        max-width: 500px;
        width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease-in-out;
        position: relative;
      }
      
      .structural-confirmation-dialog.showing {
        transform: scale(1);
      }
      
      .structural-confirmation-dialog.hiding {
        transform: scale(0.9);
      }
      
      .structural-confirmation-dark {
        --confirmation-bg: #1f2937;
        --confirmation-text: #f9fafb;
        --confirmation-border: #374151;
        --confirmation-button-bg: #374151;
        --confirmation-button-text: #f9fafb;
        color: var(--confirmation-text);
      }
      
      .structural-confirmation-light {
        --confirmation-bg: white;
        --confirmation-text: #1f2937;
        --confirmation-border: #e5e7eb;
        --confirmation-button-bg: #f3f4f6;
        --confirmation-button-text: #1f2937;
        color: var(--confirmation-text);
      }
      
      .structural-confirmation-auto {
        --confirmation-bg: white;
        --confirmation-text: #1f2937;
        --confirmation-border: #e5e7eb;
        --confirmation-button-bg: #f3f4f6;
        --confirmation-button-text: #1f2937;
        color: var(--confirmation-text);
      }
      
      @media (prefers-color-scheme: dark) {
        .structural-confirmation-auto {
          --confirmation-bg: #1f2937;
          --confirmation-text: #f9fafb;
          --confirmation-border: #374151;
          --confirmation-button-bg: #374151;
          --confirmation-button-text: #f9fafb;
        }
      }
      
      .confirmation-content {
        padding: 24px;
      }
      
      .confirmation-header {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }
      
      .confirmation-icon {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
      }
      
      .confirmation-icon.info {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
      
      .confirmation-icon.warning {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
      }
      
      .confirmation-icon.error {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      
      .confirmation-title h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
      }
      
      .operation-description {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }
      
      .confirmation-section {
        margin-bottom: 20px;
        padding: 16px;
        background: var(--confirmation-button-bg);
        border-radius: 8px;
      }
      
      .confirmation-section h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .impact-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .impact-item:last-child {
        margin-bottom: 0;
      }
      
      .impact-label {
        font-size: 13px;
      }
      
      .impact-value {
        font-weight: 600;
        font-size: 13px;
      }
      
      .warnings-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .warning-item {
        display: flex;
        gap: 8px;
        padding: 8px;
        border-radius: 4px;
        border-left: 3px solid;
      }
      
      .warning-item.warning-info {
        border-left-color: #3b82f6;
        background: rgba(59, 130, 246, 0.05);
      }
      
      .warning-item.warning-warning {
        border-left-color: #f59e0b;
        background: rgba(245, 158, 11, 0.05);
      }
      
      .warning-item.warning-error {
        border-left-color: #ef4444;
        background: rgba(239, 68, 68, 0.05);
      }
      
      .warning-icon {
        font-size: 14px;
        margin-top: 1px;
      }
      
      .warning-message {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 2px;
      }
      
      .warning-details {
        font-size: 11px;
        opacity: 0.7;
      }
      
      .formula-impact-note {
        font-size: 11px;
        font-style: italic;
        opacity: 0.7;
        margin-top: 8px;
      }
      
      .confirmation-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 24px;
      }
      
      .confirmation-actions button {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid var(--confirmation-border);
      }
      
      .cancel-button {
        background: var(--confirmation-button-bg);
        color: var(--confirmation-button-text);
      }
      
      .cancel-button:hover {
        background: var(--confirmation-border);
      }
      
      .confirm-button {
        color: white;
      }
      
      .confirm-button.info {
        background: #3b82f6;
        border-color: #3b82f6;
      }
      
      .confirm-button.info:hover {
        background: #2563eb;
        border-color: #2563eb;
      }
      
      .confirm-button.warning {
        background: #f59e0b;
        border-color: #f59e0b;
      }
      
      .confirm-button.warning:hover {
        background: #d97706;
        border-color: #d97706;
      }
      
      .confirm-button.error {
        background: #ef4444;
        border-color: #ef4444;
      }
      
      .confirm-button.error:hover {
        background: #dc2626;
        border-color: #dc2626;
      }
      
      .default {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
      }
    `;
    
    // Remove existing styles if any
    const existing = document.getElementById("structural-confirmation-dialog-styles");
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(style);
  }
}