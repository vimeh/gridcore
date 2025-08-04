import type { Cell, CellAddress } from "@gridcore/core";

export interface FormulaBarCallbacks {
  onValueChange: (address: CellAddress, value: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDebugToggle?: (enabled: boolean) => void;
}

export class FormulaBar {
  private container: HTMLElement;
  private addressInput!: HTMLInputElement;
  private formulaInput!: HTMLInputElement;
  private currentCell: CellAddress | null = null;
  private isEditingExternally: boolean = false;

  constructor(
    container: HTMLElement,
    private callbacks: FormulaBarCallbacks,
  ) {
    this.container = container;
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

    // Formula input
    this.formulaInput = document.createElement("input");
    this.formulaInput.type = "text";
    this.formulaInput.className = "formula-bar-input";
    this.formulaInput.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
    `;
    this.formulaInput.addEventListener(
      "keydown",
      this.handleFormulaKeyDown.bind(this),
    );
    this.formulaInput.addEventListener(
      "blur",
      this.handleFormulaBlur.bind(this),
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
      this.formulaInput.value =
        cell?.formula?.toString() || String(cell?.rawValue || "");
    } else {
      this.addressInput.value = "";
      this.formulaInput.value = "";
    }
  }

  setEditingState(isEditing: boolean): void {
    this.isEditingExternally = isEditing;
    // Make formula input read-only when cell editor is active
    this.formulaInput.readOnly = isEditing;
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
    this.formulaInput.select();
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

    const value = this.formulaInput.value;
    this.callbacks.onValueChange(this.currentCell, value);
  }

  destroy(): void {
    this.container.innerHTML = "";
  }
}
