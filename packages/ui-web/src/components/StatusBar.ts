import type { SpreadsheetController, UIState } from "@gridcore/ui-core";

export interface StatusBarCallbacks {
  onInteractionModeChange: (mode: "normal" | "keyboard-only") => void;
}

export class StatusBar {
  private container: HTMLElement;
  private statusBarElement: HTMLDivElement;
  private modeElement: HTMLDivElement;
  private modeText: HTMLSpanElement;
  private detailText: HTMLSpanElement;
  private keyboardOnlyToggle: HTMLInputElement;
  private controller: SpreadsheetController;
  private callbacks: StatusBarCallbacks;
  private unsubscribe: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    controller: SpreadsheetController,
    callbacks: StatusBarCallbacks,
  ) {
    this.container = container;
    this.controller = controller;
    this.callbacks = callbacks;

    this.statusBarElement = this.createStatusBar();
    this.modeElement = this.createModeIndicator();
    const toggleContainer = this.createKeyboardToggle();

    const modeText = this.modeElement.querySelector(".mode-text");
    const detailText = this.modeElement.querySelector(".mode-detail");

    if (!modeText || !detailText) {
      throw new Error("Failed to create mode indicator elements");
    }

    this.modeText = modeText as HTMLSpanElement;
    this.detailText = detailText as HTMLSpanElement;

    this.statusBarElement.appendChild(this.modeElement);
    this.statusBarElement.appendChild(toggleContainer);
    this.container.appendChild(this.statusBarElement);

    // Subscribe to controller events
    this.unsubscribe = this.controller.subscribe((event) => {
      if (event.type === "stateChanged") {
        this.handleModeChange(event.state);
      }
    });

    // Set initial state
    this.updateDisplay(this.controller.getState());
  }

  private createStatusBar(): HTMLDivElement {
    const statusBar = document.createElement("div");
    statusBar.className = "status-bar";
    statusBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 32px;
      background: #f5f5f5;
      border-top: 1px solid #ddd;
      padding: 0 12px;
      font-size: 13px;
      color: #333;
    `;
    return statusBar;
  }

  private createModeIndicator(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "mode-indicator";
    div.innerHTML = `
      <span class="mode-text"></span>
      <span class="mode-detail"></span>
    `;

    // Style the indicator
    Object.assign(div.style, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "4px 8px",
      backgroundColor: "#333",
      color: "white",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontSize: "12px",
      minWidth: "200px",
      transition: "all 0.2s ease",
    });

    const modeText = div.querySelector(".mode-text") as HTMLSpanElement;
    Object.assign(modeText.style, {
      fontWeight: "bold",
      textTransform: "uppercase",
      fontSize: "13px",
    });

    const detailText = div.querySelector(".mode-detail") as HTMLSpanElement;
    Object.assign(detailText.style, {
      opacity: "0.85",
      fontSize: "11px",
      whiteSpace: "nowrap",
    });

    return div;
  }

  private createKeyboardToggle(): HTMLElement {
    const toggleContainer = document.createElement("div");
    toggleContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const toggleLabel = document.createElement("label");
    toggleLabel.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
    `;

    this.keyboardOnlyToggle = document.createElement("input");
    this.keyboardOnlyToggle.type = "checkbox";
    this.keyboardOnlyToggle.checked = false;
    this.keyboardOnlyToggle.style.cursor = "pointer";

    this.keyboardOnlyToggle.addEventListener("change", () => {
      const newMode = this.keyboardOnlyToggle.checked
        ? "keyboard-only"
        : "normal";
      this.callbacks.onInteractionModeChange(newMode);
    });

    const toggleText = document.createElement("span");
    toggleText.textContent = "Keyboard Only Mode";
    toggleText.style.fontSize = "13px";
    toggleText.style.color = "#333";

    toggleLabel.appendChild(this.keyboardOnlyToggle);
    toggleLabel.appendChild(toggleText);
    toggleContainer.appendChild(toggleLabel);

    return toggleContainer;
  }

  private handleModeChange(state: UIState): void {
    this.updateDisplay(state);
  }

  private updateDisplay(state: UIState): void {
    const colors = {
      navigation: { bg: "#2c5282", text: "#bee3f8" },
      normal: { bg: "#38a169", text: "#c6f6d5" },
      insert: { bg: "#3182ce", text: "#bee3f8" },
      visual: { bg: "#d69e2e", text: "#fefcbf" },
      "visual-line": { bg: "#e53e3e", text: "#fed7d7" },
      "visual-block": { bg: "#9f3a38", text: "#fcb9b9" },
      resize: { bg: "#6b46c1", text: "#e9d8fd" },
    };

    // Determine primary mode and color
    let primaryMode: string = "NAVIGATION";
    let colorKey: keyof typeof colors = "navigation";
    const details: string[] = [];

    // Check the spreadsheet mode
    switch (state.spreadsheetMode) {
      case "navigation":
        primaryMode = "NAVIGATION";
        colorKey = "navigation";
        break;
      case "editing":
        // In editing mode, check cell mode
        switch (state.cellMode) {
          case "normal":
            primaryMode = "NORMAL";
            colorKey = "normal";
            break;
          case "insert":
            primaryMode = "INSERT";
            colorKey = "insert";
            break;
          case "visual":
            if (state.visualType === "character") {
              primaryMode = "VISUAL";
              colorKey = "visual";
            } else if (state.visualType === "line") {
              primaryMode = "VISUAL LINE";
              colorKey = "visual-line";
            } else {
              primaryMode = "VISUAL BLOCK";
              colorKey = "visual-block";
            }
            break;
        }
        break;
      case "resize":
        primaryMode = "RESIZE";
        colorKey = "resize";
        details.push(`${state.resizeTarget} ${state.resizeIndex}`);
        break;
      case "command":
        primaryMode = "COMMAND";
        colorKey = "normal"; // Using normal color for command mode
        details.push(`:${state.commandValue}`);
        break;
      case "visual":
        // Handle spreadsheet visual mode
        switch (state.visualMode) {
          case "char":
            primaryMode = "VISUAL";
            colorKey = "visual";
            break;
          case "row":
            primaryMode = "VISUAL ROW";
            colorKey = "visual-line";
            break;
          case "column":
            primaryMode = "VISUAL COLUMN";
            colorKey = "visual-line";
            break;
          case "block":
            primaryMode = "VISUAL BLOCK";
            colorKey = "visual-block";
            break;
          default:
            primaryMode = "VISUAL";
            colorKey = "visual";
            break;
        }
        break;
    }

    // Set primary mode text
    this.modeText.textContent = primaryMode;

    // Add helpful hints based on current mode
    let hints: string[] = [];
    switch (state.spreadsheetMode) {
      case "navigation":
        hints = ["hjkl to move", "i/a to edit", "v for visual"];
        break;
      case "editing":
        switch (state.cellMode) {
          case "normal":
            hints = ["i/a to insert", "v for visual", "ESC to exit"];
            break;
          case "insert":
            hints = ["ESC to normal", "text editing active"];
            break;
          case "visual":
            hints = ["hjkl to select", "ESC to exit"];
            break;
        }
        break;
      case "resize":
        hints = ["+/- to resize", "= to auto-fit", "ESC to exit"];
        break;
      case "command":
        hints = ["Enter to execute", "ESC to cancel"];
        break;
    }

    // Combine details and hints
    const allDetails = [...details, ...hints];
    this.detailText.textContent = allDetails.join(" • ");

    // Apply colors
    const color = colors[colorKey];
    this.modeElement.style.backgroundColor = color.bg;
    this.modeElement.style.color = color.text;
  }

  setInteractionMode(mode: "normal" | "keyboard-only"): void {
    this.keyboardOnlyToggle.checked = mode === "keyboard-only";
  }

  destroy(): void {
    // Clean up subscription
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Remove element from DOM
    this.statusBarElement.remove();
  }
}
