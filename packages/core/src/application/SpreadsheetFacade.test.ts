import { beforeEach, describe, expect, test } from "bun:test";
import type {
  BatchUpdateCompletedEvent,
  BatchUpdateStartedEvent,
  CellValueChangedEvent,
} from "../domain/interfaces/IEventService";
import { CellAddress } from "../domain/models/CellAddress";
import { CellRange } from "../domain/models/CellRange";
import { FormulaEvaluator } from "../infrastructure/evaluators/FormulaEvaluator";
import { FormulaParser } from "../infrastructure/parsers/FormulaParser";
import { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository";
import { InMemoryDependencyRepository } from "../infrastructure/repositories/InMemoryDependencyRepository";
import { EventStore } from "../infrastructure/stores/EventStore";
import { SpreadsheetFacade } from "./SpreadsheetFacade";
import { CalculationService } from "./services/CalculationService";
import { FormulaService } from "./services/FormulaService";

describe("SpreadsheetFacade", () => {
  let facade: SpreadsheetFacade;
  let cellRepository: InMemoryCellRepository;
  let dependencyRepository: InMemoryDependencyRepository;
  let calculationService: CalculationService;
  let formulaService: FormulaService;
  let eventStore: EventStore;

  beforeEach(() => {
    cellRepository = new InMemoryCellRepository();
    dependencyRepository = new InMemoryDependencyRepository();
    eventStore = new EventStore();

    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    formulaService = new FormulaService(parser, evaluator);

    calculationService = new CalculationService(
      cellRepository,
      dependencyRepository,
      formulaService,
      eventStore,
    );

    facade = new SpreadsheetFacade(
      cellRepository,
      dependencyRepository,
      calculationService,
      formulaService,
      eventStore,
    );
  });

  describe("setCellValue", () => {
    test("sets simple value", () => {
      const address = CellAddress.create(0, 0).value;
      const result = facade.setCellValue(address, 42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(42);
      }
    });

    test("sets formula", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, 10);
      const result = facade.setCellValue(b1, "=A1*2");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasFormula()).toBe(true);
        expect(result.value.computedValue).toBe(20);
      }
    });

    test("updates dependencies", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");
      facade.setCellValue(c1, "=B1+5");

      // Update A1
      facade.setCellValue(a1, 20);

      // Check cascading updates
      const b1Result = facade.getCellValue(b1);
      const c1Result = facade.getCellValue(c1);

      expect(b1Result.ok).toBe(true);
      expect(c1Result.ok).toBe(true);
      if (b1Result.ok && c1Result.ok) {
        expect(b1Result.value).toBe(40); // 20*2
        expect(c1Result.value).toBe(45); // 40+5
      }
    });

    test("emits CellValueChanged event", () => {
      const address = CellAddress.create(0, 0).value;
      let eventEmitted = false;

      eventStore.on("CellValueChanged", (event: CellValueChangedEvent) => {
        eventEmitted = true;
        expect(event.address).toBe(address);
        expect(event.newValue.computedValue).toBe(42);
      });

      facade.setCellValue(address, 42);
      expect(eventEmitted).toBe(true);
    });

    test("handles formula errors", () => {
      const address = CellAddress.create(0, 0).value;
      const result = facade.setCellValue(address, "=1/0");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasError()).toBe(true);
        expect(result.value.error).toContain("Division by zero");
      }
    });
  });

  describe("getCellValue", () => {
    test("gets simple value", () => {
      const address = CellAddress.create(0, 0).value;
      facade.setCellValue(address, 42);

      const result = facade.getCellValue(address);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    test("gets computed formula value", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      const result = facade.getCellValue(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(20);
      }
    });

    test("returns null for empty cell", () => {
      const address = CellAddress.create(0, 0).value;

      const result = facade.getCellValue(address);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });
  });

  describe("getCell", () => {
    test("gets cell object", () => {
      const address = CellAddress.create(0, 0).value;
      facade.setCellValue(address, 42);

      const result = facade.getCell(address);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rawValue).toBe(42);
        expect(result.value.computedValue).toBe(42);
      }
    });

    test("returns error for non-existent cell", () => {
      const address = CellAddress.create(0, 0).value;

      const result = facade.getCell(address);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Cell not found");
      }
    });
  });

  describe("deleteCell", () => {
    test("deletes cell", () => {
      const address = CellAddress.create(0, 0).value;
      facade.setCellValue(address, 42);

      const deleteResult = facade.deleteCell(address);
      expect(deleteResult.ok).toBe(true);

      const getResult = facade.getCell(address);
      expect(getResult.ok).toBe(false);
    });

    test("updates dependent cells", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      facade.deleteCell(a1);

      const result = facade.getCellValue(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // A1 is now empty/null
      }
    });

    test("emits CellsDeleted event", () => {
      const address = CellAddress.create(0, 0).value;
      facade.setCellValue(address, 42);

      let eventEmitted = false;
      eventStore.on("CellsDeleted", (event) => {
        eventEmitted = true;
        expect(event.addresses).toHaveLength(1);
        expect(event.addresses[0]).toBe(address);
      });

      facade.deleteCell(address);
      expect(eventEmitted).toBe(true);
    });
  });

  describe("range operations", () => {
    test("getCellsInRange", () => {
      const a1 = CellAddress.create(0, 0).value;
      const a2 = CellAddress.create(1, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const b2 = CellAddress.create(1, 1).value;

      facade.setCellValue(a1, 1);
      facade.setCellValue(a2, 2);
      facade.setCellValue(b1, 3);
      facade.setCellValue(b2, 4);

      const range = CellRange.create(a1, b2).value;
      const result = facade.getCellsInRange(range);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(4);
        expect(result.value.get("A1")?.computedValue).toBe(1);
        expect(result.value.get("A2")?.computedValue).toBe(2);
        expect(result.value.get("B1")?.computedValue).toBe(3);
        expect(result.value.get("B2")?.computedValue).toBe(4);
      }
    });

    test("setCellsInRange", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b2 = CellAddress.create(1, 1).value;
      const range = CellRange.create(a1, b2).value;

      const values = [
        [1, 2],
        [3, 4],
      ];

      const result = facade.setCellsInRange(range, values);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(4);
        expect(facade.getCellValue(a1).value).toBe(1);
        expect(facade.getCellValue(CellAddress.create(0, 1).value).value).toBe(
          2,
        );
        expect(facade.getCellValue(CellAddress.create(1, 0).value).value).toBe(
          3,
        );
        expect(facade.getCellValue(b2).value).toBe(4);
      }
    });

    test("deleteCellsInRange", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b2 = CellAddress.create(1, 1).value;
      const range = CellRange.create(a1, b2).value;

      // Set some values
      facade.setCellValue(a1, 1);
      facade.setCellValue(CellAddress.create(0, 1).value, 2);
      facade.setCellValue(CellAddress.create(1, 0).value, 3);
      facade.setCellValue(b2, 4);

      const result = facade.deleteCellsInRange(range);

      expect(result.ok).toBe(true);
      expect(facade.getCellCount()).toBe(0);
    });
  });

  describe("recalculation", () => {
    test("recalculate all cells", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");
      facade.setCellValue(c1, "=B1+A1");

      // Change A1 without triggering automatic recalc
      const cell = cellRepository.get(a1);
      if (!cell) {
        throw new Error("Cell A1 not found");
      }
      cellRepository.set(a1, cell.withComputedValue(20));

      // Recalculate all
      const result = facade.recalculate();

      expect(result.ok).toBe(true);
      expect(facade.getCellValue(b1).value).toBe(40); // 20*2
      expect(facade.getCellValue(c1).value).toBe(60); // 40+20
    });

    test("recalculateCell", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      // Change A1
      facade.setCellValue(a1, 20);

      // Force recalculation of B1
      const result = facade.recalculateCell(b1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(40);
      }
    });
  });

  describe("batch operations", () => {
    test("beginBatch returns batch ID", () => {
      const batchId = facade.beginBatch();
      expect(batchId).toContain("batch-");
    });

    test("batch operations are deferred", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      const batchId = facade.beginBatch();

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      // Before commit, B1 should not exist in repository
      const beforeCommit = cellRepository.get(b1);
      expect(beforeCommit).toBe(undefined);

      facade.commitBatch(batchId);

      // After commit, B1 should be calculated
      expect(facade.getCellValue(b1).value).toBe(20);
    });

    test("rollbackBatch cancels operations", () => {
      const a1 = CellAddress.create(0, 0).value;

      const batchId = facade.beginBatch();
      facade.setCellValue(a1, 42);
      facade.rollbackBatch(batchId);

      // Cell should not exist
      const result = facade.getCell(a1);
      expect(result.ok).toBe(false);
    });

    test("emits batch events", () => {
      let startEmitted = false;
      let completeEmitted = false;

      eventStore.on("BatchUpdateStarted", (event: BatchUpdateStartedEvent) => {
        startEmitted = true;
        expect(event.batchId).toContain("batch-");
      });

      eventStore.on(
        "BatchUpdateCompleted",
        (event: BatchUpdateCompletedEvent) => {
          completeEmitted = true;
          expect(event.affectedCells).toHaveLength(1); // Only B1 has a formula
        },
      );

      const batchId = facade.beginBatch();

      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      facade.commitBatch(batchId);

      expect(startEmitted).toBe(true);
      expect(completeEmitted).toBe(true);
    });

    test("handles batch errors", () => {
      const _batchId = facade.beginBatch();
      const result = facade.commitBatch("invalid-batch-id");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("utility methods", () => {
    test("clear removes all data", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(b1, "=A1*2");

      facade.clear();

      expect(facade.getCellCount()).toBe(0);
      expect(facade.getCell(a1).ok).toBe(false);
      expect(facade.getCell(b1).ok).toBe(false);
    });

    test("getCellCount returns correct count", () => {
      expect(facade.getCellCount()).toBe(0);

      facade.setCellValue(CellAddress.create(0, 0).value, 1);
      facade.setCellValue(CellAddress.create(0, 1).value, 2);
      facade.setCellValue(CellAddress.create(0, 2).value, 3);

      expect(facade.getCellCount()).toBe(3);
    });
  });

  describe("complex scenarios", () => {
    test("handles circular dependencies", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      facade.setCellValue(a1, "=B1");
      const result = facade.setCellValue(b1, "=A1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Circular dependency");
      }
    });

    test("handles complex formula updates", () => {
      const a1 = CellAddress.create(0, 0).value;
      const a2 = CellAddress.create(1, 0).value;
      const a3 = CellAddress.create(2, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;

      facade.setCellValue(a1, 10);
      facade.setCellValue(a2, 20);
      facade.setCellValue(a3, 30);
      facade.setCellValue(b1, "=SUM(A1:A3)");
      facade.setCellValue(c1, "=AVERAGE(A1:A3)");

      expect(facade.getCellValue(b1).value).toBe(60);
      expect(facade.getCellValue(c1).value).toBe(20);

      // Update a value
      facade.setCellValue(a2, 40);

      expect(facade.getCellValue(b1).value).toBe(80); // 10+40+30
      expect(facade.getCellValue(c1).value).toBe(80 / 3); // average
    });
  });
});
