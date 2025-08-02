import type {
  SpreadsheetModeStateMachine,
  SpreadsheetState,
} from "../state/SpreadsheetMode";

export class ModeIndicator {
  private element: HTMLDivElement;
  private modeText: HTMLSpanElement;
  private detailText: HTMLSpanElement;

  constructor(
    private container: HTMLElement,
    private modeStateMachine: SpreadsheetModeStateMachine,
  ) {
    this.element = this.createElement();
    this.modeText = this.element.querySelector(".mode-text")!;
    this.detailText = this.element.querySelector(".mode-detail")!;
    this.container.appendChild(this.element);

    // Subscribe to mode changes
    this.modeStateMachine.onModeChange(this.handleModeChange.bind(this));

    // Set initial state
    this.updateDisplay(this.modeStateMachine.getState());
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
      padding: "8px 16px",
      backgroundColor: "#333",
      color: "white",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      zIndex: "2000",
      transition: "all 0.2s ease",
    });

    const modeText = div.querySelector(".mode-text") as HTMLSpanElement;
    Object.assign(modeText.style, {
      fontWeight: "bold",
      textTransform: "uppercase",
    });

    const detailText = div.querySelector(".mode-detail") as HTMLSpanElement;
    Object.assign(detailText.style, {
      opacity: "0.8",
      fontSize: "12px",
    });

    return div;
  }

  private handleModeChange(
    state: SpreadsheetState,
    previousState: SpreadsheetState,
  ): void {
    this.updateDisplay(state);

    // Add animation effect on mode change
    this.element.style.transform = "scale(1.1)";
    setTimeout(() => {
      this.element.style.transform = "scale(1)";
    }, 200);
  }

  private updateDisplay(state: SpreadsheetState): void {
    const colors = {
      navigation: { bg: "#2c5282", text: "#bee3f8" },
      normal: { bg: "#38a169", text: "#c6f6d5" },
      insert: { bg: "#3182ce", text: "#bee3f8" },
      visual: { bg: "#d69e2e", text: "#fefcbf" },
      "visual-line": { bg: "#e53e3e", text: "#fed7d7" },
    };

    if (state.gridMode === "navigation") {
      this.modeText.textContent = "NAVIGATION";
      this.detailText.textContent = "hjkl to move • i to edit";
      const color = colors.navigation;
      this.element.style.backgroundColor = color.bg;
      this.element.style.color = color.text;
    } else {
      const modeKey =
        state.cellMode === "visual-line" ? "visual-line" : state.cellMode;
      const color = colors[modeKey] || colors.normal;

      this.element.style.backgroundColor = color.bg;
      this.element.style.color = color.text;

      switch (state.cellMode) {
        case "normal":
          this.modeText.textContent = "NORMAL";
          this.detailText.textContent =
            "i/a to insert • v for visual • ESC to exit";
          break;
        case "insert":
          this.modeText.textContent = "INSERT";
          this.detailText.textContent = "ESC to normal mode";
          break;
        case "visual":
          this.modeText.textContent = "VISUAL";
          this.detailText.textContent = "hjkl to select • ESC to exit";
          break;
        case "visual-line":
          this.modeText.textContent = "VISUAL LINE";
          this.detailText.textContent = "Select entire line • ESC to exit";
          break;
      }
    }
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
    this.element.remove();
  }
}
