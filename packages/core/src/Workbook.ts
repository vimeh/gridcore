import { Sheet } from "./Sheet";

export class Workbook {
  private sheets = new Map<string, Sheet>();
  private activeSheetId: string | null = null;
  private sheetOrder: string[] = [];

  constructor() {
    // Create initial sheet
    const sheet = new Sheet("Sheet1");
    this.addSheet(sheet);
    this.activeSheetId = sheet.getId();
  }

  addSheet(sheet: Sheet): void {
    this.sheets.set(sheet.getId(), sheet);
    this.sheetOrder.push(sheet.getId());
  }

  createSheet(name?: string): Sheet {
    const sheetName = name || this.generateSheetName();
    const sheet = new Sheet(sheetName);
    this.addSheet(sheet);
    return sheet;
  }

  removeSheet(sheetId: string): boolean {
    if (this.sheets.size <= 1) {
      // Cannot remove the last sheet
      return false;
    }

    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      return false;
    }

    this.sheets.delete(sheetId);
    const index = this.sheetOrder.indexOf(sheetId);
    if (index > -1) {
      this.sheetOrder.splice(index, 1);
    }

    // If we removed the active sheet, set a new active sheet
    if (this.activeSheetId === sheetId) {
      this.activeSheetId = this.sheetOrder[0] || null;
    }

    return true;
  }

  getSheet(sheetId: string): Sheet | undefined {
    return this.sheets.get(sheetId);
  }

  getSheetByName(name: string): Sheet | undefined {
    for (const sheet of this.sheets.values()) {
      if (sheet.getName() === name) {
        return sheet;
      }
    }
    return undefined;
  }

  getActiveSheet(): Sheet | undefined {
    if (!this.activeSheetId) {
      return undefined;
    }
    return this.sheets.get(this.activeSheetId);
  }

  setActiveSheet(sheetId: string): boolean {
    if (this.sheets.has(sheetId)) {
      this.activeSheetId = sheetId;
      return true;
    }
    return false;
  }

  getAllSheets(): Sheet[] {
    return this.sheetOrder
      .map((id) => this.sheets.get(id))
      .filter((sheet): sheet is Sheet => sheet !== undefined);
  }

  getSheetCount(): number {
    return this.sheets.size;
  }

  renameSheet(sheetId: string, newName: string): boolean {
    // Check if name is already taken
    if (this.getSheetByName(newName)) {
      return false;
    }

    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      return false;
    }

    sheet.setName(newName);
    return true;
  }

  private generateSheetName(): string {
    let num = this.sheets.size + 1;
    let name = `Sheet${num}`;

    // Ensure unique name
    while (this.getSheetByName(name)) {
      num++;
      name = `Sheet${num}`;
    }

    return name;
  }
}
