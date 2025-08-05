import type { SpreadsheetController, UIState } from "@gridcore/ui-core";

export class ModeIndicator {
  private element: HTMLDivElement;
  private modeText: HTMLSpanElement;
  private detailText: HTMLSpanElement;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    private controller: SpreadsheetController,
  ) {
    this.element = this.createElement();
    const modeText = this.element.querySelector(".mode-text");
    const detailText = this.element.querySelector(".mode-detail");

    if (!modeText || !detailText) {
      throw new Error("Failed to create mode indicator elements");
    }

    this.modeText = modeText as HTMLSpanElement;
    this.detailText = detailText as HTMLSpanElement;
    this.container.appendChild(this.element);

    // Subscribe to controller events
    this.unsubscribe = this.controller.subscribe((event) => {
      if (event.type === "stateChanged") {
        this.handleModeChange(event.state);
      }
    });

    // Set initial state
    this.updateDisplay(this.controller.getState());
  }

  private createElement(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "mode-indicator";
    div.innerHTML = `
      <span class="mode-text"></span>
      <span class="mode-detail"></span>
    `;

    // Style the indicator
    Object.assign(div.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      padding: "10px 16px",
      backgroundColor: "#333",
      color: "white",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontSize: "14px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      zIndex: "2000",
      transition: "all 0.2s ease",
      minWidth: "200px",
    });

    const modeText = div.querySelector(".mode-text") as HTMLSpanElement;
    Object.assign(modeText.style, {
      fontWeight: "bold",
      textTransform: "uppercase",
      fontSize: "16px",
    });

    const detailText = div.querySelector(".mode-detail") as HTMLSpanElement;
    Object.assign(detailText.style, {
      opacity: "0.85",
      fontSize: "12px",
      lineHeight: "1.4",
    });

    return div;
  }

  private handleModeChange(state: UIState): void {
    this.updateDisplay(state);

    // Add animation effect on mode change
    this.element.style.transform = "scale(1.1)";
    setTimeout(() => {
      this.element.style.transform = "scale(1)";
    }, 200);
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
        }
        break;
    }

    // Set primary mode text
    this.modeText.textContent = primaryMode;

    // No interaction mode in UIState - that's Web UI specific

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
    this.element.style.backgroundColor = color.bg;
    this.element.style.color = color.text;
  }

  setPosition(position: {
    bottom?: string;
    left?: string;
    right?: string;
    top?: string;
  }): void {
    Object.assign(this.element.style, position);
  }

  show(): void {
    this.element.style.display = "flex";
  }

  hide(): void {
    this.element.style.display = "none";
  }

  destroy(): void {
    // Clean up subscription
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Remove element from DOM
    this.element.remove();
  }
}
