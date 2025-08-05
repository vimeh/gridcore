import type {
  StructuralOperation,
  StructuralUIEvent,
  StructuralWarning,
} from "./types";

export interface WarningDialogConfig {
  maxWarnings: number;
  showSeverityIcons: boolean;
  allowDismiss: boolean;
  autoHideMs: number;
  position: "top" | "bottom" | "center";
  theme: "light" | "dark" | "auto";
}

export const DEFAULT_WARNING_CONFIG: WarningDialogConfig = {
  maxWarnings: 5,
  showSeverityIcons: true,
  allowDismiss: true,
  autoHideMs: 5000,
  position: "top",
  theme: "auto",
};

/**
 * Warning dialog for displaying structural operation warnings
 */
export class WarningDialog {
  private config: WarningDialogConfig;
  private container?: HTMLElement;
  private dialogElement?: HTMLElement;
  private isVisible = false;
  private currentWarnings: StructuralWarning[] = [];
  private autoHideTimeout?: NodeJS.Timeout;

  constructor(
    container?: HTMLElement,
    config: Partial<WarningDialogConfig> = {},
  ) {
    this.container = container;
    this.config = { ...DEFAULT_WARNING_CONFIG, ...config };
    this.setupStyles();
  }

  /**
   * Handle structural UI events
   */
  handleEvent(event: StructuralUIEvent): void {
    switch (event.type) {
      case "structuralOperationWarning":
        this.showWarnings(event.operation, event.warnings);
        break;
      case "structuralOperationCompleted":
      case "structuralOperationFailed":
      case "structuralOperationCancelled":
        if (this.config.autoHideMs > 0) {
          this.scheduleAutoHide();
        }
        break;
    }
  }

  /**
   * Show warnings for an operation
   */
  showWarnings(
    operation: StructuralOperation,
    warnings: StructuralWarning[],
  ): void {
    this.currentWarnings = warnings.slice(0, this.config.maxWarnings);

    if (this.currentWarnings.length === 0) {
      this.hide();
      return;
    }

    this.createDialogElement(operation);
    this.show();
    this.scheduleAutoHide();
  }

  /**
   * Add additional warnings
   */
  addWarnings(warnings: StructuralWarning[]): void {
    const newWarnings = warnings.slice(
      0,
      this.config.maxWarnings - this.currentWarnings.length,
    );
    this.currentWarnings.push(...newWarnings);

    if (this.isVisible && this.dialogElement) {
      this.updateWarningsList();
    }
  }

  /**
   * Show the dialog
   */
  show(): void {
    if (this.isVisible || !this.dialogElement) {
      return;
    }

    this.isVisible = true;
    this.attachToContainer();

    // Trigger animation
    requestAnimationFrame(() => {
      this.dialogElement?.classList.add("showing");
    });
  }

  /**
   * Hide the dialog
   */
  hide(): void {
    if (!this.isVisible || !this.dialogElement) {
      return;
    }

    this.dialogElement.classList.add("hiding");

    setTimeout(() => {
      this.removeDialogElement();
      this.isVisible = false;
      this.currentWarnings = [];
    }, 300); // Animation duration

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = undefined;
    }
  }

  /**
   * Dismiss the dialog manually
   */
  dismiss(): void {
    if (this.config.allowDismiss) {
      this.hide();
    }
  }

  /**
   * Check if dialog is currently visible
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Get current warnings
   */
  getWarnings(): StructuralWarning[] {
    return [...this.currentWarnings];
  }

  /**
   * Create dialog element
   */
  private createDialogElement(operation: StructuralOperation): void {
    this.dialogElement = document.createElement("div");
    this.dialogElement.className = `structural-warning-dialog structural-warning-${this.config.position} structural-warning-${this.config.theme}`;

    const operationText = this.getOperationText(operation);

    this.dialogElement.innerHTML = `
      <div class="warning-content">
        <div class="warning-header">
          <div class="warning-title">
            ${this.getSeverityIcon("warning")}
            <span>Operation Warning</span>
          </div>
          ${this.config.allowDismiss ? '<button class="dismiss-button" type="button">&times;</button>' : ""}
        </div>
        <div class="warning-operation">
          ${operationText}
        </div>
        <div class="warnings-list">
          ${this.renderWarningsList()}
        </div>
        ${this.config.allowDismiss ? '<div class="warning-footer"><button class="dismiss-text-button" type="button">Dismiss</button></div>' : ""}
      </div>
    `;

    // Add event listeners
    this.addEventListeners();
  }

  /**
   * Update warnings list in existing dialog
   */
  private updateWarningsList(): void {
    if (!this.dialogElement) {
      return;
    }

    const warningsList = this.dialogElement.querySelector(".warnings-list");
    if (warningsList) {
      warningsList.innerHTML = this.renderWarningsList();
    }
  }

  /**
   * Render warnings list HTML
   */
  private renderWarningsList(): string {
    return this.currentWarnings
      .map((warning) => {
        const icon = this.config.showSeverityIcons
          ? this.getSeverityIcon(warning.severity)
          : "";
        const affectedCount = warning.affectedCells.length;
        const cellsText = affectedCount === 1 ? "cell" : "cells";

        return `
          <div class="warning-item warning-${warning.severity}">
            <div class="warning-item-header">
              ${icon}
              <span class="warning-message">${warning.message}</span>
            </div>
            <div class="warning-details">
              Affects ${affectedCount} ${cellsText}
            </div>
          </div>
        `;
      })
      .join("");
  }

  /**
   * Get operation description text
   */
  private getOperationText(operation: StructuralOperation): string {
    const count = operation.count > 1 ? `${operation.count} ` : "";

    switch (operation.type) {
      case "insertRow":
        return `Inserting ${count}row${operation.count > 1 ? "s" : ""} at position ${operation.index}`;
      case "insertColumn":
        return `Inserting ${count}column${operation.count > 1 ? "s" : ""} at position ${operation.index}`;
      case "deleteRow":
        return `Deleting ${count}row${operation.count > 1 ? "s" : ""} starting at ${operation.index}`;
      case "deleteColumn":
        return `Deleting ${count}column${operation.count > 1 ? "s" : ""} starting at ${operation.index}`;
      default:
        return "Performing structural operation";
    }
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    if (!this.config.showSeverityIcons) {
      return "";
    }

    switch (severity) {
      case "info":
        return '<span class="severity-icon info-icon">ℹ</span>';
      case "warning":
        return '<span class="severity-icon warning-icon">⚠</span>';
      case "error":
        return '<span class="severity-icon error-icon">⚠</span>';
      default:
        return '<span class="severity-icon">•</span>';
    }
  }

  /**
   * Add event listeners to dialog
   */
  private addEventListeners(): void {
    if (!this.dialogElement) {
      return;
    }

    // Dismiss button in header
    const dismissButton = this.dialogElement.querySelector(".dismiss-button");
    if (dismissButton) {
      dismissButton.addEventListener("click", () => this.dismiss());
    }

    // Dismiss button in footer
    const dismissTextButton = this.dialogElement.querySelector(
      ".dismiss-text-button",
    );
    if (dismissTextButton) {
      dismissTextButton.addEventListener("click", () => this.dismiss());
    }

    // ESC key to dismiss
    if (this.config.allowDismiss) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && this.isVisible) {
          this.dismiss();
          document.removeEventListener("keydown", handleKeyDown);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
    }
  }

  /**
   * Schedule auto-hide
   */
  private scheduleAutoHide(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    if (this.config.autoHideMs > 0) {
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, this.config.autoHideMs);
    }
  }

  /**
   * Attach dialog to container
   */
  private attachToContainer(): void {
    if (!this.dialogElement) {
      return;
    }

    if (this.container) {
      this.container.appendChild(this.dialogElement);
    } else {
      document.body.appendChild(this.dialogElement);
    }
  }

  /**
   * Remove dialog element
   */
  private removeDialogElement(): void {
    if (this.dialogElement) {
      if (this.dialogElement.parentNode) {
        this.dialogElement.parentNode.removeChild(this.dialogElement);
      }
      this.dialogElement = undefined;
    }
  }

  /**
   * Setup CSS styles
   */
  private setupStyles(): void {
    const style = document.createElement("style");
    style.id = "structural-warning-dialog-styles";

    style.textContent = `
      .structural-warning-dialog {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        background: var(--warning-bg, white);
        border: 1px solid var(--warning-border, #f59e0b);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
        padding: 0;
        min-width: 350px;
        max-width: 500px;
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }
      
      .structural-warning-dialog.showing {
        opacity: 1;
      }
      
      .structural-warning-dialog.hiding {
        opacity: 0;
      }
      
      .structural-warning-top {
        top: 20px;
      }
      
      .structural-warning-bottom {
        bottom: 20px;
      }
      
      .structural-warning-center {
        top: 50%;
        transform: translate(-50%, -50%);
      }
      
      .structural-warning-dark {
        --warning-bg: #1f2937;
        --warning-border: #f59e0b;
        --warning-text: #f9fafb;
        --warning-header-bg: #374151;
        --warning-item-bg: #374151;
        color: var(--warning-text);
      }
      
      .structural-warning-light {
        --warning-bg: white;
        --warning-border: #f59e0b;
        --warning-text: #1f2937;
        --warning-header-bg: #fef3c7;
        --warning-item-bg: #fef3c7;
        color: var(--warning-text);
      }
      
      .structural-warning-auto {
        --warning-bg: white;
        --warning-border: #f59e0b;
        --warning-text: #1f2937;
        --warning-header-bg: #fef3c7;
        --warning-item-bg: #fef3c7;
        color: var(--warning-text);
      }
      
      @media (prefers-color-scheme: dark) {
        .structural-warning-auto {
          --warning-bg: #1f2937;
          --warning-border: #f59e0b;
          --warning-text: #f9fafb;
          --warning-header-bg: #374151;
          --warning-item-bg: #374151;
        }
      }
      
      .warning-content {
        display: flex;
        flex-direction: column;
      }
      
      .warning-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--warning-header-bg);
        border-bottom: 1px solid var(--warning-border);
        border-radius: 8px 8px 0 0;
      }
      
      .warning-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
      }
      
      .dismiss-button {
        background: none;
        border: none;
        color: var(--warning-text);
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      .dismiss-button:hover {
        background: rgba(0, 0, 0, 0.1);
      }
      
      .warning-operation {
        padding: 12px 16px;
        font-size: 13px;
        color: var(--warning-text);
        opacity: 0.8;
        border-bottom: 1px solid var(--warning-border);
      }
      
      .warnings-list {
        padding: 12px 16px;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .warning-item {
        margin-bottom: 12px;
        padding: 8px;
        border-radius: 4px;
        background: var(--warning-item-bg);
      }
      
      .warning-item:last-child {
        margin-bottom: 0;
      }
      
      .warning-item-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 4px;
      }
      
      .warning-message {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
      }
      
      .warning-details {
        font-size: 11px;
        opacity: 0.7;
        margin-left: 24px;
      }
      
      .severity-icon {
        font-size: 14px;
        font-weight: bold;
        margin-top: 1px;
      }
      
      .info-icon {
        color: #3b82f6;
      }
      
      .warning-icon {
        color: #f59e0b;
      }
      
      .error-icon {
        color: #ef4444;
      }
      
      .warning-item.warning-error {
        border-left: 3px solid #ef4444;
      }
      
      .warning-item.warning-warning {
        border-left: 3px solid #f59e0b;
      }
      
      .warning-item.warning-info {
        border-left: 3px solid #3b82f6;
      }
      
      .warning-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--warning-border);
        text-align: right;
      }
      
      .dismiss-text-button {
        background: transparent;
        border: 1px solid var(--warning-border);
        color: var(--warning-text);
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .dismiss-text-button:hover {
        background: var(--warning-item-bg);
      }
    `;

    // Remove existing styles if any
    const existing = document.getElementById(
      "structural-warning-dialog-styles",
    );
    if (existing) {
      existing.remove();
    }

    document.head.appendChild(style);
  }
}
