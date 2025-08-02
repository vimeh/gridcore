import type { SpreadsheetState, SpreadsheetModeStateMachine } from "../state/SpreadsheetMode"

export class ModeIndicator {
  private element: HTMLDivElement
  private modeText: HTMLSpanElement
  private detailText: HTMLSpanElement
  private unsubscribe: (() => void) | null = null
  
  constructor(
    private container: HTMLElement,
    private modeStateMachine: SpreadsheetModeStateMachine
  ) {
    this.element = this.createElement();
    this.modeText = this.element.querySelector(".mode-text")!;
    this.detailText = this.element.querySelector(".mode-detail")!;
    this.container.appendChild(this.element);

    // Subscribe to mode changes
    this.unsubscribe = this.modeStateMachine.onModeChange(this.handleModeChange.bind(this))
    
    // Set initial state
    this.updateDisplay(this.modeStateMachine.getState())
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
    })
    
    const modeText = div.querySelector(".mode-text") as HTMLSpanElement
    Object.assign(modeText.style, {
      fontWeight: "bold",
      textTransform: "uppercase",
      fontSize: "16px",
    })
    
    const detailText = div.querySelector(".mode-detail") as HTMLSpanElement
    Object.assign(detailText.style, {
      opacity: "0.85",
      fontSize: "12px",
      lineHeight: "1.4",
    })
    
    return div
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
      "visual-block": { bg: "#9f3a38", text: "#fcb9b9" },
      resize: { bg: "#6b46c1", text: "#e9d8fd" },
    }
    
    // Determine primary mode and color
    let primaryMode: string
    let colorKey: keyof typeof colors
    
    if (state.gridMode === "navigation") {
      primaryMode = "NAVIGATION"
      colorKey = "navigation"
    } else {
      // In editing mode, use cell mode for coloring
      switch (state.cellMode) {
        case "insert":
          primaryMode = state.editMode ? `${state.editMode.toUpperCase()}` : "INSERT"
          colorKey = "insert"
          break
        case "visual":
          primaryMode = "VISUAL"
          colorKey = "visual"
          break
        case "visual-line":
          primaryMode = "VISUAL LINE"
          colorKey = "visual-line"
          break
        case "visual-block":
          primaryMode = "VISUAL BLOCK"
          colorKey = "visual-block"
          break
        case "resize":
          primaryMode = "RESIZE"
          colorKey = "resize"
          break
        default:
          primaryMode = "NORMAL"
          colorKey = "normal"
      }
    }
    
    // Set primary mode text
    this.modeText.textContent = primaryMode
    
    // Build detailed mode information
    const details: string[] = []
    
    // Grid mode (always show when editing)
    if (state.gridMode === "editing") {
      details.push(`Grid: ${state.gridMode}`)
    }
    
    // Cell mode (show when editing and not redundant with primary mode)
    if (state.gridMode === "editing" && state.cellMode !== "insert") {
      details.push(`Cell: ${state.cellMode}`)
    }
    
    // Edit mode (show when in insert mode and different from primary)
    if (state.cellMode === "insert" && state.editMode && state.editMode !== "insert") {
      details.push(`Edit: ${state.editMode}`)
    }
    
    // Pending edit mode (show when there's a pending edit mode)
    if (state.pendingEditMode && state.pendingEditMode !== state.editMode) {
      details.push(`Pending: ${state.pendingEditMode}`)
    }
    
    // Interaction mode (show when not normal)
    if (state.interactionMode !== "normal") {
      details.push(`Input: ${state.interactionMode}`)
    }
    
    // Visual mode details
    if (state.visualAnchor && state.visualCursor) {
      details.push(`Selection: ${state.visualAnchor.row},${state.visualAnchor.col} to ${state.visualCursor.row},${state.visualCursor.col}`)
    }
    
    // Resize mode details
    if (state.resizeTarget) {
      details.push(`Target: ${state.resizeTarget.type} ${state.resizeTarget.index}`)
    }
    
    // Add helpful hints based on current mode
    let hints: string[] = []
    if (state.gridMode === "navigation") {
      hints = ["hjkl to move", "i/a to edit", "v for visual"]
    } else {
      switch (state.cellMode) {
        case "normal":
          hints = ["i/a to insert", "v for visual", "ESC to exit"]
          break
        case "insert":
          hints = ["ESC to normal", "text editing active"]
          break
        case "visual":
        case "visual-line":
        case "visual-block":
          hints = ["hjkl to select", "ESC to exit"]
          break
        case "resize":
          hints = ["+/- to resize", "= to auto-fit", "ESC to exit"]
          break
      }
    }
    
    // Combine details and hints
    const allDetails = [...details, ...hints]
    this.detailText.textContent = allDetails.join(" • ")
    
    // Apply colors
    const color = colors[colorKey]
    this.element.style.backgroundColor = color.bg
    this.element.style.color = color.text
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
      this.unsubscribe()
      this.unsubscribe = null
    }
    
    // Remove element from DOM
    this.element.remove()
  }
}