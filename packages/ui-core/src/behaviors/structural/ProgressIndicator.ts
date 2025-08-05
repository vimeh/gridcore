import type { StructuralOperation, StructuralUIEvent } from "./types";

export interface ProgressIndicatorConfig {
  showPercentage: boolean;
  showEstimatedTime: boolean;
  showCancelButton: boolean;
  position: "top" | "bottom" | "center";
  theme: "light" | "dark" | "auto";
  autoHide: boolean;
  minDisplayTime: number; // Minimum time to show progress (ms)
}

export const DEFAULT_PROGRESS_CONFIG: ProgressIndicatorConfig = {
  showPercentage: true,
  showEstimatedTime: true,
  showCancelButton: true,
  position: "top",
  theme: "auto",
  autoHide: true,
  minDisplayTime: 500,
};

/**
 * Progress indicator for long-running structural operations
 */
export class ProgressIndicator {
  private config: ProgressIndicatorConfig;
  private container?: HTMLElement;
  private progressElement?: HTMLElement;
  private isVisible = false;
  private startTime = 0;
  private onCancel?: () => void;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used in line 72 and 133
  private currentOperation?: StructuralOperation;

  constructor(
    container?: HTMLElement,
    config: Partial<ProgressIndicatorConfig> = {},
  ) {
    this.container = container;
    this.config = { ...DEFAULT_PROGRESS_CONFIG, ...config };
    this.setupStyles();
  }

  /**
   * Handle structural UI events
   */
  handleEvent(event: StructuralUIEvent): void {
    switch (event.type) {
      case "structuralOperationStarted":
        if (event.estimatedDuration && event.estimatedDuration > 1000) {
          this.show(event.operation, event.estimatedDuration);
        }
        break;
      case "structuralOperationProgress":
        this.updateProgress(event.progress);
        break;
      case "structuralOperationCompleted":
      case "structuralOperationFailed":
      case "structuralOperationCancelled":
        this.hide();
        break;
    }
  }

  /**
   * Show progress indicator
   */
  show(operation: StructuralOperation, estimatedDuration: number): void {
    if (this.isVisible) {
      this.hide();
    }

    this.currentOperation = operation;
    this.startTime = Date.now();
    this.isVisible = true;

    this.createProgressElement(operation, estimatedDuration);
    this.attachToContainer();
  }

  /**
   * Update progress percentage
   */
  updateProgress(progress: number): void {
    if (!this.isVisible || !this.progressElement) {
      return;
    }

    const progressBar = this.progressElement.querySelector(
      ".progress-bar",
    ) as HTMLElement;
    const progressText = this.progressElement.querySelector(
      ".progress-text",
    ) as HTMLElement;
    const timeText = this.progressElement.querySelector(
      ".time-text",
    ) as HTMLElement;

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    if (progressText && this.config.showPercentage) {
      progressText.textContent = `${Math.round(progress)}%`;
    }

    if (timeText && this.config.showEstimatedTime) {
      const elapsed = Date.now() - this.startTime;
      const estimatedTotal = elapsed / (progress / 100);
      const remaining = Math.max(0, estimatedTotal - elapsed);
      timeText.textContent = this.formatTime(remaining);
    }
  }

  /**
   * Hide progress indicator
   */
  hide(): void {
    if (!this.isVisible) {
      return;
    }

    const elapsed = Date.now() - this.startTime;
    const delay = Math.max(0, this.config.minDisplayTime - elapsed);

    setTimeout(() => {
      if (this.progressElement) {
        this.progressElement.classList.add("hiding");
        setTimeout(() => {
          this.removeProgressElement();
        }, 300); // Animation duration
      }
      this.isVisible = false;
      this.currentOperation = undefined;
    }, delay);
  }

  /**
   * Set cancel callback
   */
  setCancelCallback(callback: () => void): void {
    this.onCancel = callback;
  }

  /**
   * Check if progress indicator is currently visible
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Create progress element
   */
  private createProgressElement(
    operation: StructuralOperation,
    _estimatedDuration: number,
  ): void {
    this.progressElement = document.createElement("div");
    this.progressElement.className = `structural-progress-indicator structural-progress-${this.config.position} structural-progress-${this.config.theme}`;

    const operationText = this.getOperationText(operation);

    this.progressElement.innerHTML = `
      <div class="progress-content">
        <div class="progress-header">
          <span class="operation-text">${operationText}</span>
          ${this.config.showCancelButton ? '<button class="cancel-button" type="button">Cancel</button>' : ""}
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar"></div>
        </div>
        <div class="progress-footer">
          ${this.config.showPercentage ? '<span class="progress-text">0%</span>' : ""}
          ${this.config.showEstimatedTime ? '<span class="time-text">Calculating...</span>' : ""}
        </div>
      </div>
    `;

    // Add cancel button event listener
    if (this.config.showCancelButton) {
      const cancelButton = this.progressElement.querySelector(".cancel-button");
      if (cancelButton) {
        cancelButton.addEventListener("click", () => {
          if (this.onCancel) {
            this.onCancel();
          }
        });
      }
    }
  }

  /**
   * Attach progress element to container
   */
  private attachToContainer(): void {
    if (!this.progressElement) {
      return;
    }

    if (this.container) {
      this.container.appendChild(this.progressElement);
    } else {
      document.body.appendChild(this.progressElement);
    }

    // Trigger animation
    requestAnimationFrame(() => {
      this.progressElement?.classList.add("showing");
    });
  }

  /**
   * Remove progress element
   */
  private removeProgressElement(): void {
    if (this.progressElement) {
      if (this.progressElement.parentNode) {
        this.progressElement.parentNode.removeChild(this.progressElement);
      }
      this.progressElement = undefined;
    }
  }

  /**
   * Get human-readable operation text
   */
  private getOperationText(operation: StructuralOperation): string {
    const count = operation.count > 1 ? `${operation.count} ` : "";

    switch (operation.type) {
      case "insertRow":
        return `Inserting ${count}row${operation.count > 1 ? "s" : ""}...`;
      case "insertColumn":
        return `Inserting ${count}column${operation.count > 1 ? "s" : ""}...`;
      case "deleteRow":
        return `Deleting ${count}row${operation.count > 1 ? "s" : ""}...`;
      case "deleteColumn":
        return `Deleting ${count}column${operation.count > 1 ? "s" : ""}...`;
      default:
        return "Processing...";
    }
  }

  /**
   * Format time in milliseconds to human readable string
   */
  private formatTime(ms: number): string {
    if (ms < 1000) {
      return "Less than 1 second";
    }

    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds > 1 ? "s" : ""}`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  /**
   * Setup CSS styles
   */
  private setupStyles(): void {
    const style = document.createElement("style");
    style.id = "structural-progress-indicator-styles";

    style.textContent = `
      .structural-progress-indicator {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        background: var(--progress-bg, white);
        border: 1px solid var(--progress-border, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 16px;
        min-width: 300px;
        max-width: 400px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }
      
      .structural-progress-indicator.showing {
        opacity: 1;
      }
      
      .structural-progress-indicator.hiding {
        opacity: 0;
      }
      
      .structural-progress-top {
        top: 20px;
      }
      
      .structural-progress-bottom {
        bottom: 20px;
      }
      
      .structural-progress-center {
        top: 50%;
        transform: translate(-50%, -50%);
      }
      
      .structural-progress-dark {
        --progress-bg: #1f2937;
        --progress-border: #374151;
        --progress-text: #f9fafb;
        --progress-bar-bg: #4b5563;
        --progress-bar-fill: #3b82f6;
        color: var(--progress-text);
      }
      
      .structural-progress-light {
        --progress-bg: white;
        --progress-border: #e5e7eb;
        --progress-text: #1f2937;
        --progress-bar-bg: #f3f4f6;
        --progress-bar-fill: #3b82f6;
        color: var(--progress-text);
      }
      
      .structural-progress-auto {
        --progress-bg: white;
        --progress-border: #e5e7eb;
        --progress-text: #1f2937;
        --progress-bar-bg: #f3f4f6;
        --progress-bar-fill: #3b82f6;
        color: var(--progress-text);
      }
      
      @media (prefers-color-scheme: dark) {
        .structural-progress-auto {
          --progress-bg: #1f2937;
          --progress-border: #374151;
          --progress-text: #f9fafb;
          --progress-bar-bg: #4b5563;
          --progress-bar-fill: #3b82f6;
        }
      }
      
      .progress-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .operation-text {
        font-weight: 500;
        font-size: 14px;
      }
      
      .cancel-button {
        background: transparent;
        border: 1px solid var(--progress-border);
        color: var(--progress-text);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .cancel-button:hover {
        background: var(--progress-bar-bg);
      }
      
      .progress-bar-container {
        width: 100%;
        height: 8px;
        background: var(--progress-bar-bg, #f3f4f6);
        border-radius: 4px;
        overflow: hidden;
      }
      
      .progress-bar {
        height: 100%;
        background: var(--progress-bar-fill, #3b82f6);
        border-radius: 4px;
        width: 0%;
        transition: width 0.3s ease;
      }
      
      .progress-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: var(--progress-text);
        opacity: 0.8;
      }
      
      .progress-text {
        font-weight: 500;
      }
      
      .time-text {
        font-style: italic;
      }
    `;

    // Remove existing styles if any
    const existing = document.getElementById(
      "structural-progress-indicator-styles",
    );
    if (existing) {
      existing.remove();
    }

    document.head.appendChild(style);
  }
}
