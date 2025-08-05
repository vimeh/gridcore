import type { ICellRepository } from "./ICellRepository"
import type { Cell } from "../models/Cell"
import type { CellAddress } from "../models/CellAddress"

/**
 * Extended cell repository interface that includes both standard
 * and legacy method names for compatibility
 */
export interface IExtendedCellRepository extends ICellRepository {
  // Legacy methods used by fill and bulk-ops features
  getCell(address: CellAddress): Cell | undefined
  setCell(address: CellAddress, cell: Cell): void
}