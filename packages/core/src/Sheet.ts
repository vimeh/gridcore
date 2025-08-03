import { SpreadsheetEngine } from "./SpreadsheetEngine"
import type { GridDimensions } from "./types"
import type { SheetState } from "./types/WorkbookState"

export interface SheetMetadata {
  createdAt: Date
  modifiedAt: Date
  index: number
  hidden?: boolean
  protected?: boolean
}

function generateId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export class Sheet {
  private id: string
  private name: string
  private engine: SpreadsheetEngine
  private metadata: SheetMetadata

  constructor(name: string, rows: number = 1000, cols: number = 26) {
    this.id = generateId()
    this.name = name
    this.engine = new SpreadsheetEngine(rows, cols)
    this.metadata = {
      createdAt: new Date(),
      modifiedAt: new Date(),
      index: 0,
    }
  }

  getId(): string {
    return this.id
  }

  getName(): string {
    return this.name
  }

  setName(name: string): void {
    this.name = name
    this.metadata.modifiedAt = new Date()
  }

  getEngine(): SpreadsheetEngine {
    return this.engine
  }

  getMetadata(): SheetMetadata {
    return { ...this.metadata }
  }

  setIndex(index: number): void {
    this.metadata.index = index
    this.metadata.modifiedAt = new Date()
  }

  getIndex(): number {
    return this.metadata.index
  }

  setHidden(hidden: boolean): void {
    this.metadata.hidden = hidden
    this.metadata.modifiedAt = new Date()
  }

  isHidden(): boolean {
    return this.metadata.hidden ?? false
  }

  setProtected(isProtected: boolean): void {
    this.metadata.protected = isProtected
    this.metadata.modifiedAt = new Date()
  }

  isProtected(): boolean {
    return this.metadata.protected ?? false
  }

  getDimensions(): GridDimensions {
    return this.engine.getDimensions()
  }

  clone(): Sheet {
    const newSheet = new Sheet(this.name + " (Copy)", this.getDimensions().rows, this.getDimensions().cols)
    
    // Clone the engine data
    const engineData = this.engine.toJSON()
    const clonedEngine = SpreadsheetEngine.fromJSON(engineData)
    newSheet.engine = clonedEngine
    
    // Clone metadata but update dates
    newSheet.metadata = {
      ...this.metadata,
      createdAt: new Date(),
      modifiedAt: new Date(),
    }
    
    return newSheet
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      engine: this.engine.toJSON(),
      metadata: {
        ...this.metadata,
        createdAt: this.metadata.createdAt.toISOString(),
        modifiedAt: this.metadata.modifiedAt.toISOString(),
      },
    }
  }

  toState(): SheetState {
    const engineState = this.engine.toState()
    return {
      ...engineState,
      id: this.id,
      name: this.name,
      index: this.metadata.index,
      hidden: this.metadata.hidden,
      protected: this.metadata.protected,
    }
  }

  static fromState(state: SheetState): Sheet {
    const sheet = new Sheet(state.name)
    sheet.id = state.id
    sheet.engine = SpreadsheetEngine.fromState(state)
    sheet.metadata.index = state.index
    if (state.hidden !== undefined) sheet.metadata.hidden = state.hidden
    if (state.protected !== undefined) sheet.metadata.protected = state.protected
    return sheet
  }

  static fromJSON(data: ReturnType<Sheet["toJSON"]>, preserveId: boolean = true): Sheet {
    const sheet = new Sheet(data.name)
    if (preserveId) {
      sheet.id = data.id
    }
    sheet.engine = SpreadsheetEngine.fromJSON(data.engine)
    sheet.metadata = {
      ...data.metadata,
      createdAt: new Date(data.metadata.createdAt),
      modifiedAt: new Date(data.metadata.modifiedAt),
    }
    return sheet
  }
}