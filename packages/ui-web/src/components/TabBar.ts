import type { Sheet, Workbook } from "@gridcore/core";

export interface TabBarOptions {
  container: HTMLElement;
  workbook: Workbook;
  onTabChange?: (sheetId: string) => void;
  onTabAdd?: () => void;
  onTabRemove?: (sheetId: string) => void;
  onTabRename?: (sheetId: string, newName: string) => void;
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

  private onTabChange?: (sheetId: string) => void;
  private onTabAdd?: () => void;
  private onTabRemove?: (sheetId: string) => void;
  private onTabRename?: (sheetId: string, newName: string) => void;
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

    const sheets = this.workbook.getAllSheets();
    const activeSheet = this.workbook.getActiveSheet();

    sheets.forEach((sheet, index) => {
      const tab = this.createTab(
        sheet,
        sheet.getId() === activeSheet?.getId(),
        index,
      );
      this.tabContainer.appendChild(tab);
    });
  }

  private createTab(
    sheet: Sheet,
    isActive: boolean,
    index: number,
  ): HTMLElement {
    const tab = document.createElement("div");
    tab.className = `tab${isActive ? " active" : ""}`;
    tab.dataset.sheetId = sheet.getId();
    tab.dataset.index = index.toString();
    tab.draggable = true;

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = sheet.getName();
    tab.appendChild(nameSpan);

    // Add close button if there's more than one sheet
    if (this.workbook.getSheetCount() > 1) {
      const closeButton = document.createElement("button");
      closeButton.className = "tab-close-button";
      closeButton.innerHTML = "×";
      closeButton.title = "Close sheet";
      closeButton.onclick = (e) => {
        e.stopPropagation();
        this.handleRemoveTab(sheet.getId());
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
        const sheetId = tab.dataset.sheetId;
        if (sheetId) {
          this.handleTabClick(sheetId);
        }
      }
    });

    // Tab context menu handler
    this.tabContainer.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement;
      if (tab) {
        const sheetId = tab.dataset.sheetId;
        if (sheetId) {
          this.showContextMenu(sheetId, e as MouseEvent);
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
        const sheetId = tab?.dataset.sheetId;
        if (sheetId) {
          this.startRename(sheetId);
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
        this.draggedSheetId = tab.dataset.sheetId || null;
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

  private handleTabClick(sheetId: string): void {
    this.workbook.setActiveSheet(sheetId);
    this.render();
    this.onTabChange?.(sheetId);
  }

  private handleAddSheet(): void {
    const newSheet = this.workbook.createSheet();
    this.workbook.setActiveSheet(newSheet.getId());
    this.render();
    this.onTabAdd?.();

    // Auto-start rename for new sheet
    setTimeout(() => this.startRename(newSheet.getId()), 100);
  }

  private handleRemoveTab(sheetId: string): void {
    if (this.workbook.getSheetCount() <= 1) {
      alert("Cannot remove the last sheet");
      return;
    }

    const sheet = this.workbook.getSheet(sheetId);
    if (sheet && confirm(`Remove sheet "${sheet.getName()}"?`)) {
      this.workbook.removeSheet(sheetId);
      this.render();
      this.onTabRemove?.(sheetId);
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

  private startRename(sheetId: string): void {
    const tab = this.tabContainer.querySelector(
      `[data-sheet-id="${sheetId}"]`,
    ) as HTMLElement;
    if (!tab) return;

    const nameSpan = tab.querySelector(".tab-name") as HTMLElement;
    if (!nameSpan) return;

    const sheet = this.workbook.getSheet(sheetId);
    if (!sheet) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tab-rename-input";
    input.value = sheet.getName();
    input.style.width = `${nameSpan.offsetWidth}px`;

    const finishRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== sheet.getName()) {
        try {
          this.workbook.renameSheet(sheetId, newName);
          this.onTabRename?.(sheetId, newName);
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

  private showContextMenu(sheetId: string, event: MouseEvent): void {
    this.hideContextMenu();

    const sheet = this.workbook.getSheet(sheetId);
    if (!sheet) return;

    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "tab-context-menu";

    const menuItems = [
      {
        label: "Rename",
        action: () => this.startRename(sheetId),
      },
      {
        label: "Duplicate",
        action: () => {
          // TODO: implement duplicateSheet functionality
          console.warn("duplicateSheet not implemented yet");
          const newSheet = this.workbook.createSheet();
          this.workbook.setActiveSheet(newSheet.getId());
          this.render();
        },
      },
      ...(this.workbook.getSheetCount() > 1
        ? [
            {
              label: "Delete",
              action: () => this.handleRemoveTab(sheetId),
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
