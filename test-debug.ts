import { CellAddress } from "@gridcore/core/src/domain/models";
import { CellSelection } from "@gridcore/core/src/operations/bulk/base/CellSelection";
import { BulkMathOperation } from "@gridcore/core/src/operations/bulk/implementations/BulkMathOperation";

// Simple mock repository
class TestRepo {
  private cells = new Map();
  
  get(address) {
    const key = `${address.row},${address.col}`;
    return this.cells.get(key);
  }
  
  set(address, cell) {
    const key = `${address.row},${address.col}`;
    this.cells.set(key, cell);
  }
  
  delete(address) {
    const key = `${address.row},${address.col}`;
    this.cells.delete(key);
  }
  
  clear() {
    this.cells.clear();
  }
  
  getAllInRange() {
    return new Map();
  }
  
  getAll() {
    return this.cells;
  }
  
  count() {
    return this.cells.size;
  }
  
  initCells() {
    this.cells.set("1,1", { rawValue: 10, computedValue: 10 });
    this.cells.set("1,2", { rawValue: 20, computedValue: 20 });
  }
}

const repo = new TestRepo();
repo.initCells();

const selection = new CellSelection();
selection.addCell(new CellAddress(1, 1));
selection.addCell(new CellAddress(1, 2));

const operation = new BulkMathOperation(
  selection,
  { operation: "add", value: 5 },
  repo
);

const result = await operation.execute();
console.log("Result:", result);
console.log("Cell 1,1:", repo.get(new CellAddress(1, 1)));
console.log("Cell 1,2:", repo.get(new CellAddress(1, 2)));
