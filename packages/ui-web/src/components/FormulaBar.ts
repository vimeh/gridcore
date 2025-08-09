import type { Cell, CellAddress } from "../wasm";

// Formula highlight colors - using a structured format for different element types
const FORMULA_HIGHLIGHT_COLORS = {
  references: {
    relative: "#4285F4", // Blue
    absolute: "#EA4335", // Red
    "mixed-column": "#34A853", // Green
    "mixed-row": "#FBBC04", // Yellow
  },
  elements: {
    operator: "#666666", // Gray
    function: "#9333EA", // Purple
    number: "#0D7377", // Teal
    string: "#EC4899", // Pink
    parenthesis: "#333333", // Dark gray
  },
};

// Default highlight colors
const DEFAULT_HIGHLIGHT_COLORS = FORMULA_HIGHLIGHT_COLORS;

// Highlight segment interface
interface HighlightSegment {
  text: string;
  color?: string;
  bold?: boolean;
  type?: string;
  referenceType?: string;
}

// Simple FormulaHighlighter stub
class FormulaHighlighter {
  highlight(formula: string): string {
    return formula; // No highlighting for now
  }

  highlightFormula(formula: string, _colors?: any): any[] {
    // Return empty segments for now
    return [];
  }
}

export interface FormulaBarCallbacks {
  onValueChange: (address: CellAddress, value: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDebugToggle?: (enabled: boolean) => void;
}

export class FormulaBar {
  private container: HTMLElement;
  private addressInput!: HTMLInputElement;
  private formulaInput!: HTMLDivElement; // Changed from HTMLInputElement to support highlighting
  private formulaPlainInput!: HTMLInputElement; // Hidden input for actual value
  private currentCell: CellAddress | null = null;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used in setEditingState method
  private isEditingExternally = false;
  private highlighter: FormulaHighlighter;
  private isHighlightingEnabled = true;

  constructor(
    container: HTMLElement,
    private callbacks: FormulaBarCallbacks,
  ) {
    this.container = container;
    this.highlighter = new FormulaHighlighter();
    this.setupDOM();
  }

  private setupDOM(): void {
    this.container.innerHTML = "";
    this.container.className = "formula-bar";
    this.container.style.cssText = `
      display: flex;
      align-items: center;
      height: 32px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      padding: 0 8px;
      gap: 8px;
    `;

    // Cell address input
    this.addressInput = document.createElement("input");
    this.addressInput.type = "text";
    this.addressInput.className = "formula-bar-address";
    this.addressInput.style.cssText = `
      width: 80px;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
      text-align: center;
    `;
    this.addressInput.addEventListener(
      "keydown",
      this.handleAddressKeyDown.bind(this),
    );

    // Create highlighting CSS styles
    this.createHighlightingStyles();

    // Formula input - contenteditable div for highlighting
    this.formulaInput = document.createElement("div");
    this.formulaInput.contentEditable = "true";
    this.formulaInput.className = "formula-bar-input highlighted-formula";
    this.formulaInput.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
      background: white;
      outline: none;
      min-height: 20px;
      white-space: nowrap;
      overflow-x: auto;
      line-height: 1.4;
    `;

    // Hidden plain input to maintain form value
    this.formulaPlainInput = document.createElement("input");
    this.formulaPlainInput.type = "hidden";
    this.formulaPlainInput.className = "formula-bar-plain-input";

    this.formulaInput.addEventListener(
      "keydown",
      this.handleFormulaKeyDown.bind(this),
    );
    this.formulaInput.addEventListener(
      "blur",
      this.handleFormulaBlur.bind(this),
    );
    this.formulaInput.addEventListener(
      "input",
      this.handleFormulaInput.bind(this),
    );
    this.formulaInput.addEventListener(
      "paste",
      this.handleFormulaPaste.bind(this),
    );

    // Function icon
    const functionIcon = document.createElement("span");
    functionIcon.innerHTML = "ƒx";
    functionIcon.style.cssText = `
      font-weight: bold;
      color: #666;
      padding: 0 4px;
    `;

    this.container.appendChild(this.addressInput);
    this.container.appendChild(functionIcon);
    this.container.appendChild(this.formulaInput);
    this.container.appendChild(this.formulaPlainInput);

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";

    // Buttons
    const buttonStyles = `
      padding: 4px 12px;
      border: 1px solid #ccc;
      background: #f0f0f0;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
    `;

    const importButton = document.createElement("button");
    importButton.textContent = "Import";
    importButton.style.cssText = buttonStyles;
    importButton.addEventListener("click", () => this.callbacks.onImport());

    const exportButton = document.createElement("button");
    exportButton.textContent = "Export";
    exportButton.style.cssText = buttonStyles;
    exportButton.addEventListener("click", () => this.callbacks.onExport());

    // Debug mode toggle
    const debugToggle = document.createElement("label");
    debugToggle.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      cursor: pointer;
      user-select: none;
    `;

    const debugCheckbox = document.createElement("input");
    debugCheckbox.type = "checkbox";
    debugCheckbox.style.cssText = `
      cursor: pointer;
    `;
    debugCheckbox.addEventListener("change", () => {
      if (this.callbacks.onDebugToggle) {
        this.callbacks.onDebugToggle(debugCheckbox.checked);
      }
    });

    const debugLabel = document.createElement("span");
    debugLabel.textContent = "Debug";
    debugLabel.style.cssText = `
      font-size: 12px;
      color: #666;
    `;

    debugToggle.appendChild(debugCheckbox);
    debugToggle.appendChild(debugLabel);

    this.container.appendChild(spacer);
    this.container.appendChild(importButton);
    this.container.appendChild(exportButton);
    this.container.appendChild(debugToggle);
  }

  setActiveCell(address: CellAddress | null, cell: Cell | undefined): void {
    this.currentCell = address;

    if (address) {
      this.addressInput.value = address.toString();
      // Get the display value from the cell
      const cellObj = cell?.toObject?.();
      const value = cellObj?.formula || String(cellObj?.value || "");
      this.setFormulaValue(value);
    } else {
      this.addressInput.value = "";
      this.setFormulaValue("");
    }
  }

  setEditingState(isEditing: boolean): void {
    this.isEditingExternally = isEditing;
    // Make formula input read-only when cell editor is active
    this.formulaInput.contentEditable = isEditing ? "false" : "true";
    // Optionally disable the input styling
    if (isEditing) {
      this.formulaInput.style.opacity = "0.7";
      this.formulaInput.style.cursor = "not-allowed";
    } else {
      this.formulaInput.style.opacity = "1";
      this.formulaInput.style.cursor = "text";
    }
  }

  focusFormula(): void {
    this.formulaInput.focus();
    // Select all content for contenteditable
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this.formulaInput);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private handleAddressKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      // TODO: Navigate to the entered cell address
      this.formulaInput.focus();
    }
  }

  private handleFormulaKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      this.commitValue();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.formulaInput.blur();
    }
  }

  private handleFormulaBlur(): void {
    // Don't commit on blur to allow clicking elsewhere
  }

  private commitValue(): void {
    if (!this.currentCell) return;

    const value = this.getFormulaValue();
    this.callbacks.onValueChange(this.currentCell, value);
  }

  destroy(): void {
    this.container.innerHTML = "";
  }

  /**
   * Create CSS styles for syntax highlighting
   */
  private createHighlightingStyles(): void {
    const styleId = "formula-highlighting-styles";
    if (document.getElementById(styleId)) {
      return; // Styles already exist
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .highlighted-formula {
        position: relative;
      }
      
      .ref-relative {
        color: ${FORMULA_HIGHLIGHT_COLORS.references.relative};
        font-weight: 500;
      }
      
      .ref-absolute {
        color: ${FORMULA_HIGHLIGHT_COLORS.references.absolute};
        font-weight: bold;
      }
      
      .ref-mixed-column {
        color: ${FORMULA_HIGHLIGHT_COLORS.references["mixed-column"]};
        font-weight: 500;
      }
      
      .ref-mixed-row {
        color: ${FORMULA_HIGHLIGHT_COLORS.references["mixed-row"]};
        font-weight: 500;
      }
      
      .ref-operator {
        color: ${FORMULA_HIGHLIGHT_COLORS.elements.operator};
      }
      
      .ref-function {
        color: ${FORMULA_HIGHLIGHT_COLORS.elements.function};
        font-weight: 500;
      }
      
      .ref-number {
        color: ${FORMULA_HIGHLIGHT_COLORS.elements.number};
      }
      
      .ref-string {
        color: ${FORMULA_HIGHLIGHT_COLORS.elements.string};
      }
      
      .ref-parenthesis {
        color: ${FORMULA_HIGHLIGHT_COLORS.elements.parenthesis};
      }
      
      .formula-bar-input:focus {
        border-color: #007acc;
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.25);
      }
      
      .reference-tooltip {
        position: absolute;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Get the plain text value from the contenteditable div
   */
  private getFormulaValue(): string {
    return this.formulaInput.textContent || "";
  }

  /**
   * Set the formula value with syntax highlighting
   */
  private setFormulaValue(value: string): void {
    // Update hidden input for form compatibility
    this.formulaPlainInput.value = value;

    if (!this.isHighlightingEnabled || !value.startsWith("=")) {
      // No highlighting for non-formulas
      this.formulaInput.textContent = value;
      return;
    }

    // Apply syntax highlighting
    const segments = this.highlighter.highlightFormula(
      value,
      DEFAULT_HIGHLIGHT_COLORS,
    );
    this.renderHighlightedSegments(segments, value);
  }

  /**
   * Render highlighted segments in the contenteditable div
   */
  private renderHighlightedSegments(
    segments: HighlightSegment[],
    _originalText: string,
  ): void {
    const fragment = document.createDocumentFragment();

    for (const segment of segments) {
      const span = document.createElement("span");
      span.textContent = segment.text;

      // Apply appropriate CSS class
      if (segment.type === "reference" && segment.referenceType) {
        span.className = `ref-${segment.referenceType}`;
        span.title = this.getReferenceTooltip(segment.referenceType);
      } else if (segment.type) {
        span.className = `ref-${segment.type}`;
      }

      fragment.appendChild(span);
    }

    // Replace content while preserving cursor position
    const selection = window.getSelection();
    const cursorOffset = selection?.rangeCount ? this.getCursorOffset() : 0;

    this.formulaInput.innerHTML = "";
    this.formulaInput.appendChild(fragment);

    // Restore cursor position
    if (cursorOffset > 0) {
      this.setCursorOffset(cursorOffset);
    }
  }

  /**
   * Get tooltip text for reference types
   */
  private getReferenceTooltip(referenceType: string): string {
    switch (referenceType) {
      case "relative":
        return "Relative reference - adjusts when copied (A1)";
      case "absolute":
        return "Absolute reference - stays fixed when copied ($A$1)";
      case "mixed-column":
        return "Mixed reference - column fixed, row adjusts ($A1)";
      case "mixed-row":
        return "Mixed reference - row fixed, column adjusts (A$1)";
      default:
        return "";
    }
  }

  /**
   * Get current cursor offset in the contenteditable div
   */
  private getCursorOffset(): number {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(this.formulaInput);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  }

  /**
   * Set cursor position in the contenteditable div
   */
  private setCursorOffset(offset: number): void {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let currentOffset = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;

    const walker = document.createTreeWalker(
      this.formulaInput,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node: Node | null = walker.nextNode();
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      if (currentOffset + nodeLength >= offset) {
        targetNode = node;
        targetOffset = offset - currentOffset;
        break;
      }
      currentOffset += nodeLength;
      node = walker.nextNode();
    }

    if (targetNode) {
      range.setStart(targetNode, targetOffset);
      range.setEnd(targetNode, targetOffset);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * Handle input events for live highlighting
   */
  private handleFormulaInput(): void {
    const value = this.getFormulaValue();
    this.formulaPlainInput.value = value;

    // Re-apply highlighting if this is a formula
    if (this.isHighlightingEnabled && value.startsWith("=")) {
      // Debounce highlighting for performance
      clearTimeout(this.highlightingTimeout);
      this.highlightingTimeout = setTimeout(() => {
        const segments = this.highlighter.highlightFormula(
          value,
          DEFAULT_HIGHLIGHT_COLORS,
        );
        this.renderHighlightedSegments(segments, value);
      }, 100);
    }
  }

  /**
   * Handle paste events to maintain highlighting
   */
  private handleFormulaPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";

    // Insert plain text and then re-highlight
    document.execCommand("insertText", false, text);
    this.handleFormulaInput();
  }

  private highlightingTimeout: ReturnType<typeof setTimeout> | undefined;
}
