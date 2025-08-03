import { Sheet } from "./Sheet"
import type { WorkbookState, WorkbookMetadata as WorkbookMetadataType, WorkbookStateOptions } from "./types/WorkbookState"

export interface WorkbookMetadata extends Omit<WorkbookMetadataType, "createdAt" | "modifiedAt"> {
  createdAt: Date
  modifiedAt: Date
}

export class Workbook {
  private sheets: Map<string, Sheet>
  private activeSheetId: string
  private metadata: WorkbookMetadata
  private sheetOrder: string[]

  constructor() {
    this.sheets = new Map()
    this.sheetOrder = []
    this.metadata = {
      createdAt: new Date(),
      modifiedAt: new Date(),
    }

    // Create default sheet
    const defaultSheet = this.addSheet("Sheet1")
    this.activeSheetId = defaultSheet.getId()
  }

  addSheet(name?: string): Sheet {
    // Generate unique sheet name if not provided
    if (!name) {
      name = this.generateUniqueSheetName()
    } else {
      // Ensure name is unique
      name = this.ensureUniqueSheetName(name)
    }

    const sheet = new Sheet(name)
    sheet.setIndex(this.sheetOrder.length)
    
    this.sheets.set(sheet.getId(), sheet)
    this.sheetOrder.push(sheet.getId())
    
    this.metadata.modifiedAt = new Date()
    
    return sheet
  }

  removeSheet(sheetId: string): boolean {
    const sheet = this.sheets.get(sheetId)
    if (!sheet) {
      return false
    }

    // Cannot remove the last sheet
    if (this.sheets.size <= 1) {
      throw new Error("Cannot remove the last sheet in the workbook")
    }

    // If removing the active sheet, switch to another sheet
    if (this.activeSheetId === sheetId) {
      const currentIndex = this.sheetOrder.indexOf(sheetId)
      const newIndex = currentIndex > 0 ? currentIndex - 1 : 1
      this.activeSheetId = this.sheetOrder[newIndex]
    }

    // Remove from sheets map and order
    this.sheets.delete(sheetId)
    this.sheetOrder = this.sheetOrder.filter(id => id !== sheetId)

    // Re-index remaining sheets
    this.reindexSheets()
    
    this.metadata.modifiedAt = new Date()
    
    return true
  }

  getActiveSheet(): Sheet {
    const sheet = this.sheets.get(this.activeSheetId)
    if (!sheet) {
      throw new Error("Active sheet not found")
    }
    return sheet
  }

  setActiveSheet(sheetId: string): void {
    if (!this.sheets.has(sheetId)) {
      throw new Error(`Sheet with id ${sheetId} not found`)
    }
    this.activeSheetId = sheetId
    this.metadata.modifiedAt = new Date()
  }

  getSheetById(sheetId: string): Sheet | undefined {
    return this.sheets.get(sheetId)
  }

  getSheetByName(name: string): Sheet | undefined {
    for (const sheet of this.sheets.values()) {
      if (sheet.getName() === name) {
        return sheet
      }
    }
    return undefined
  }

  getSheetByIndex(index: number): Sheet | undefined {
    if (index < 0 || index >= this.sheetOrder.length) {
      return undefined
    }
    const sheetId = this.sheetOrder[index]
    return this.sheets.get(sheetId)
  }

  getAllSheets(): Sheet[] {
    return this.sheetOrder.map(id => this.sheets.get(id)!).filter(Boolean)
  }

  getSheetCount(): number {
    return this.sheets.size
  }

  renameSheet(sheetId: string, newName: string): void {
    const sheet = this.sheets.get(sheetId)
    if (!sheet) {
      throw new Error(`Sheet with id ${sheetId} not found`)
    }

    // Ensure new name is unique
    const uniqueName = this.ensureUniqueSheetName(newName, sheetId)
    sheet.setName(uniqueName)
    
    this.metadata.modifiedAt = new Date()
  }

  moveSheet(sheetId: string, newIndex: number): void {
    const currentIndex = this.sheetOrder.indexOf(sheetId)
    if (currentIndex === -1) {
      throw new Error(`Sheet with id ${sheetId} not found`)
    }

    // Validate new index
    if (newIndex < 0 || newIndex >= this.sheetOrder.length) {
      throw new Error("Invalid sheet index")
    }

    if (currentIndex === newIndex) {
      return
    }

    // Remove from current position
    this.sheetOrder.splice(currentIndex, 1)
    
    // Insert at new position
    this.sheetOrder.splice(newIndex, 0, sheetId)
    
    // Re-index all sheets
    this.reindexSheets()
    
    this.metadata.modifiedAt = new Date()
  }

  duplicateSheet(sheetId: string): Sheet {
    const originalSheet = this.sheets.get(sheetId)
    if (!originalSheet) {
      throw new Error(`Sheet with id ${sheetId} not found`)
    }

    const clonedSheet = originalSheet.clone()
    
    // Ensure unique name
    const uniqueName = this.ensureUniqueSheetName(clonedSheet.getName())
    clonedSheet.setName(uniqueName)
    
    // Add to workbook
    clonedSheet.setIndex(this.sheetOrder.length)
    this.sheets.set(clonedSheet.getId(), clonedSheet)
    this.sheetOrder.push(clonedSheet.getId())
    
    this.metadata.modifiedAt = new Date()
    
    return clonedSheet
  }

  getMetadata(): WorkbookMetadata {
    return { ...this.metadata }
  }

  setTitle(title: string): void {
    this.metadata.title = title
    this.metadata.modifiedAt = new Date()
  }

  setAuthor(author: string): void {
    this.metadata.author = author
    this.metadata.modifiedAt = new Date()
  }

  private generateUniqueSheetName(): string {
    let counter = 1
    let name = `Sheet${counter}`
    
    while (this.getSheetByName(name)) {
      counter++
      name = `Sheet${counter}`
    }
    
    return name
  }

  private ensureUniqueSheetName(name: string, excludeSheetId?: string): string {
    let uniqueName = name
    let counter = 1
    
    while (true) {
      const existingSheet = this.getSheetByName(uniqueName)
      if (!existingSheet || existingSheet.getId() === excludeSheetId) {
        break
      }
      uniqueName = `${name} (${counter})`
      counter++
    }
    
    return uniqueName
  }

  private reindexSheets(): void {
    this.sheetOrder.forEach((sheetId, index) => {
      const sheet = this.sheets.get(sheetId)
      if (sheet) {
        sheet.setIndex(index)
      }
    })
  }

  toJSON() {
    return {
      sheets: this.getAllSheets().map(sheet => sheet.toJSON()),
      activeSheetId: this.activeSheetId,
      metadata: {
        ...this.metadata,
        createdAt: this.metadata.createdAt.toISOString(),
        modifiedAt: this.metadata.modifiedAt.toISOString(),
      },
      sheetOrder: this.sheetOrder,
    }
  }

  static fromJSON(data: ReturnType<Workbook["toJSON"]>): Workbook {
    const workbook = new Workbook()
    
    // Remove default sheet
    const defaultSheetId = workbook.getActiveSheet().getId()
    
    // Clear existing data
    workbook.sheets.clear()
    workbook.sheetOrder = []
    
    // Restore sheets
    const sheetIdMap = new Map<string, string>() // old ID -> new ID
    
    for (const sheetData of data.sheets) {
      const sheet = Sheet.fromJSON(sheetData, false) // Generate new IDs
      workbook.sheets.set(sheet.getId(), sheet)
      sheetIdMap.set(sheetData.id, sheet.getId())
    }
    
    // Restore sheet order
    workbook.sheetOrder = data.sheetOrder.map(oldId => sheetIdMap.get(oldId)!).filter(Boolean)
    
    // Restore active sheet
    const newActiveSheetId = sheetIdMap.get(data.activeSheetId)
    if (newActiveSheetId && workbook.sheets.has(newActiveSheetId)) {
      workbook.activeSheetId = newActiveSheetId
    } else if (workbook.sheetOrder.length > 0) {
      workbook.activeSheetId = workbook.sheetOrder[0]
    }
    
    // Restore metadata
    workbook.metadata = {
      ...data.metadata,
      createdAt: new Date(data.metadata.createdAt),
      modifiedAt: new Date(data.metadata.modifiedAt),
    }
    
    // Re-index sheets to ensure consistency
    workbook.reindexSheets()
    
    return workbook
  }

  toState(options: WorkbookStateOptions = {}): WorkbookState {
    const sheets = this.getAllSheets()
    const sheetStates = options.includeHiddenSheets
      ? sheets.map(sheet => sheet.toState())
      : sheets.filter(sheet => !sheet.isHidden()).map(sheet => sheet.toState())

    const state: WorkbookState = {
      version: "2.0",
      sheets: sheetStates,
      activeSheetId: this.activeSheetId,
      sheetOrder: this.sheetOrder,
    }

    if (options.includeMetadata !== false) {
      state.metadata = {
        ...this.metadata,
        createdAt: this.metadata.createdAt.toISOString(),
        modifiedAt: this.metadata.modifiedAt.toISOString(),
      }
    }

    return state
  }

  static fromState(state: WorkbookState): Workbook {
    const workbook = new Workbook()
    
    // Only proceed if there are sheets to restore
    if (state.sheets.length > 0) {
      // Remove default sheet
      workbook.sheets.clear()
      workbook.sheetOrder = []
      
      // Restore sheets
      for (const sheetState of state.sheets) {
        const sheet = Sheet.fromState(sheetState)
        workbook.sheets.set(sheet.getId(), sheet)
        workbook.sheetOrder.push(sheet.getId())
      }
      
      // Restore active sheet
      if (state.activeSheetId && workbook.sheets.has(state.activeSheetId)) {
        workbook.activeSheetId = state.activeSheetId
      } else if (workbook.sheetOrder.length > 0) {
        workbook.activeSheetId = workbook.sheetOrder[0]
      }
    }
    // If no sheets in state, keep the default sheet
    
    // Restore metadata
    if (state.metadata) {
      workbook.metadata = {
        ...state.metadata,
        createdAt: new Date(state.metadata.createdAt),
        modifiedAt: new Date(state.metadata.modifiedAt),
      }
    }
    
    return workbook
  }
}