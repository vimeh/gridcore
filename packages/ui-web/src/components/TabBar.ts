import type { Workbook } from "../wasm";

// Define Sheet interface locally as WasmSheet may have different methods
interface Sheet {
  getName(): string;
  getId(): string;
}

export interface TabBarOptions {
  container: HTMLElement;
  workbook: Workbook;
  onTabChange?: (sheetName: string) => void;
  onTabAdd?: () => void;
  onTabRemove?: (sheetName: string) => void;
  onTabRename?: (oldName: string, newName: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
}

export class TabBar {
  private container: HTMLElement;
  private workbook: Workbook;
  private tabContainer: HTMLElement;
  private addButton: HTMLElement;
  private contextMenu: HTMLElement | null = null;
  private draggedTab: HTMLElement | null = null;
  private draggedSheetId: string | null = null;

  private onTabChange?: (sheetName: string) => void;
  private onTabAdd?: () => void;
  private onTabRemove?: (sheetName: string) => void;
  private onTabRename?: (oldName: string, newName: string) => void;
  private onTabReorder?: (fromIndex: number, toIndex: number) => void;

  constructor(options: TabBarOptions) {
    this.container = options.container;
    this.workbook = options.workbook;
    this.onTabChange = options.onTabChange;
    this.onTabAdd = options.onTabAdd;
    this.onTabRemove = options.onTabRemove;
    this.onTabRename = options.onTabRename;
    this.onTabReorder = options.onTabReorder;

    // Create tab container
    this.tabContainer = document.createElement("div");
    this.tabContainer.className = "tab-container";

    // Create add button
    this.addButton = document.createElement("button");
    this.addButton.className = "tab-add-button";
    this.addButton.innerHTML = "+";
    this.addButton.title = "Add new sheet";

    // Set up container structure
    this.container.className = "tab-bar";
    this.container.appendChild(this.tabContainer);
    this.container.appendChild(this.addButton);

    this.render();
    this.attachEventListeners();
  }

  private render(): void {
    this.tabContainer.innerHTML = "";

    const sheetNames = this.workbook.getSheetNames();
    const activeSheetName = this.workbook.getActiveSheetName();

    sheetNames.forEach((sheetName: string, index: number) => {
      const tab = this.createTab(
        sheetName,
        sheetName === activeSheetName,
        index,
      );
      this.tabContainer.appendChild(tab);
    });
  }

  private createTab(
    sheetName: string,
    isActive: boolean,
    index: number,
  ): HTMLElement {
    const tab = document.createElement("div");
    tab.className = `tab${isActive ? " active" : ""}`;
    tab.dataset.sheetName = sheetName;
    tab.dataset.index = index.toString();
    tab.draggable = true;

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = sheetName;
    tab.appendChild(nameSpan);

    // Add close button if there's more than one sheet
    if (this.workbook.getSheetCount() > 1) {
      const closeButton = document.createElement("button");
      closeButton.className = "tab-close-button";
      closeButton.innerHTML = "×";
      closeButton.title = "Close sheet";
      closeButton.onclick = (e) => {
        e.stopPropagation();
        this.handleRemoveTab(sheetName);
      };
      tab.appendChild(closeButton);
    }

    return tab;
  }

  private attachEventListeners(): void {
    // Tab click handler
    this.tabContainer.addEventListener("click", (e) => {
      const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement;
      if (tab && !tab.classList.contains("active")) {
        const sheetName = tab.dataset.sheetName;
        if (sheetName) {
          this.handleTabClick(sheetName);
        }
      }
    });

    // Tab context menu handler
    this.tabContainer.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement;
      if (tab) {
        const sheetName = tab.dataset.sheetName;
        if (sheetName) {
          this.showContextMenu(sheetName, e as MouseEvent);
        }
      }
    });

    // Tab double-click for rename
    this.tabContainer.addEventListener("dblclick", (e) => {
      const nameSpan = (e.target as HTMLElement).closest(
        ".tab-name",
      ) as HTMLElement;
      if (nameSpan) {
        const tab = nameSpan.closest(".tab") as HTMLElement;
        const sheetName = tab?.dataset.sheetName;
        if (sheetName) {
          this.startRename(sheetName);
        }
      }
    });

    // Add button click
    this.addButton.addEventListener("click", () => {
      this.handleAddSheet();
    });

    // Drag and drop
    this.tabContainer.addEventListener("dragstart", (e) => {
      const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement;
      if (tab) {
        this.draggedTab = tab;
        this.draggedSheetId = tab.dataset.sheetName || null;
        tab.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
      }
    });

    this.tabContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!this.draggedTab) return;

      const afterElement = this.getDragAfterElement(
        this.tabContainer,
        e.clientX,
      );
      if (afterElement == null) {
        this.tabContainer.appendChild(this.draggedTab);
      } else {
        this.tabContainer.insertBefore(this.draggedTab, afterElement);
      }
    });

    this.tabContainer.addEventListener("dragend", (_e) => {
      if (this.draggedTab) {
        this.draggedTab.classList.remove("dragging");

        // Get new order and notify
        const tabs = Array.from(this.tabContainer.querySelectorAll(".tab"));
        const oldIndex = parseInt(this.draggedTab.dataset.index || "0", 10);
        const newIndex = tabs.indexOf(this.draggedTab);

        if (oldIndex !== newIndex && this.draggedSheetId) {
          this.handleReorderTab(oldIndex, newIndex);
        }

        this.draggedTab = null;
        this.draggedSheetId = null;
      }
    });

    // Click outside to close context menu
    document.addEventListener("click", () => {
      this.hideContextMenu();
    });
  }

  private getDragAfterElement(
    container: HTMLElement,
    x: number,
  ): Element | null {
    const draggableElements = [
      ...container.querySelectorAll(".tab:not(.dragging)"),
    ];

    interface ClosestElement {
      offset: number;
      element: Element | null;
    }

    return draggableElements.reduce<ClosestElement>(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY, element: null },
    ).element;
  }

  private handleTabClick(sheetName: string): void {
    this.workbook.setActiveSheet(sheetName);
    this.render();
    this.onTabChange?.(sheetName);
  }

  private generateNewSheetName(): string {
    const existingNames = this.workbook.getSheetNames();
    let counter = 1;
    let newName = `Sheet${counter}`;
    while (existingNames.includes(newName)) {
      counter++;
      newName = `Sheet${counter}`;
    }
    return newName;
  }

  private handleAddSheet(): void {
    const newName = this.generateNewSheetName();
    this.workbook.createSheet(newName);
    this.workbook.setActiveSheet(newName);
    this.render();
    this.onTabAdd?.();

    // Auto-start rename for new sheet
    setTimeout(() => this.startRename(newName), 100);
  }

  private handleRemoveTab(sheetName: string): void {
    if (this.workbook.getSheetCount() <= 1) {
      alert("Cannot remove the last sheet");
      return;
    }

    if (confirm(`Remove sheet "${sheetName}"?`)) {
      this.workbook.deleteSheet(sheetName);
      this.render();
      this.onTabRemove?.(sheetName);
    }
  }

  private handleReorderTab(fromIndex: number, toIndex: number): void {
    if (this.draggedSheetId) {
      // TODO: implement moveSheet functionality
      console.warn("moveSheet not implemented yet");
      this.render();
      this.onTabReorder?.(fromIndex, toIndex);
    }
  }

  private startRename(sheetName: string): void {
    const tab = this.tabContainer.querySelector(
      `[data-sheet-name="${sheetName}"]`,
    ) as HTMLElement;
    if (!tab) return;

    const nameSpan = tab.querySelector(".tab-name") as HTMLElement;
    if (!nameSpan) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tab-rename-input";
    input.value = sheetName;
    input.style.width = `${nameSpan.offsetWidth}px`;

    const finishRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== sheetName) {
        try {
          this.workbook.renameSheet(sheetName, newName);
          this.onTabRename?.(sheetName, newName);
        } catch (error) {
          alert(
            error instanceof Error ? error.message : "Failed to rename sheet",
          );
        }
      }
      this.render();
    };

    input.addEventListener("blur", finishRename);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        finishRename();
      } else if (e.key === "Escape") {
        this.render();
      }
      e.stopPropagation();
    });

    nameSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  private showContextMenu(sheetName: string, event: MouseEvent): void {
    this.hideContextMenu();

    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "tab-context-menu";

    const menuItems = [
      {
        label: "Rename",
        action: () => this.startRename(sheetName),
      },
      {
        label: "Duplicate",
        action: () => {
          // TODO: implement duplicateSheet functionality
          console.warn("duplicateSheet not implemented yet");
          const newName = this.generateNewSheetName();
          this.workbook.createSheet(newName);
          this.workbook.setActiveSheet(newName);
          this.render();
        },
      },
      ...(this.workbook.getSheetCount() > 1
        ? [
            {
              label: "Delete",
              action: () => this.handleRemoveTab(sheetName),
            },
          ]
        : []),
    ];

    menuItems.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "tab-context-menu-item";
      menuItem.textContent = item.label;
      menuItem.onclick = () => {
        this.hideContextMenu();
        item.action();
      };
      this.contextMenu?.appendChild(menuItem);
    });

    document.body.appendChild(this.contextMenu);

    // Position menu
    const rect = this.contextMenu.getBoundingClientRect();
    const x = Math.min(event.clientX, window.innerWidth - rect.width);
    const y = Math.min(event.clientY, window.innerHeight - rect.height);

    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  public refresh(): void {
    this.render();
  }

  public dispose(): void {
    this.hideContextMenu();
    this.container.innerHTML = "";
  }
}
