import { beforeEach, describe, expect, test } from "bun:test";
import { Cell } from "../../domain/models/Cell";
import { CellAddress } from "../../domain/models/CellAddress";
import { FormulaEvaluator } from "../../infrastructure/evaluators/FormulaEvaluator";
import { FormulaParser } from "../../infrastructure/parsers/FormulaParser";
import { InMemoryCellRepository } from "../../infrastructure/repositories/InMemoryCellRepository";
import { InMemoryDependencyRepository } from "../../infrastructure/repositories/InMemoryDependencyRepository";
import { EventStore } from "../../infrastructure/stores/EventStore";
import { CalculationService } from "./CalculationService";
import { FormulaService } from "./FormulaService";

describe("CalculationService", () => {
  let service: CalculationService;
  let cellRepository: InMemoryCellRepository;
  let dependencyRepository: InMemoryDependencyRepository;
  let eventStore: EventStore;

  beforeEach(() => {
    cellRepository = new InMemoryCellRepository();
    dependencyRepository = new InMemoryDependencyRepository();
    eventStore = new EventStore();

    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    const formulaService = new FormulaService(parser, evaluator);

    service = new CalculationService(
      cellRepository,
      dependencyRepository,
      formulaService,
      eventStore,
    );
  });

  describe("calculateCell", () => {
    test("calculates cell without formula", () => {
      const address = CellAddress.create(0, 0).value;
      const cell = Cell.create(42).value;
      cellRepository.set(address, cell);

      const result = service.calculateCell(address);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(42);
      }
    });

    test("calculates cell with simple formula", () => {
      // Set up cells
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create(20).value);
      cellRepository.set(c1, Cell.create("=A1+B1", c1).value);

      // Set up dependencies
      dependencyRepository.addDependency(c1, a1);
      dependencyRepository.addDependency(c1, b1);

      const result = service.calculateCell(c1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(30);
      }
    });

    test("calculates cell with nested formulas", () => {
      // A1 = 10, B1 = 20, C1 = A1+B1, D1 = C1*2
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;
      const d1 = CellAddress.create(0, 3).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create(20).value);
      cellRepository.set(c1, Cell.create("=A1+B1", c1).value);
      cellRepository.set(d1, Cell.create("=C1*2", d1).value);

      // Set up dependencies
      dependencyRepository.addDependency(c1, a1);
      dependencyRepository.addDependency(c1, b1);
      dependencyRepository.addDependency(d1, c1);

      const result = service.calculateCell(d1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(60); // (10+20)*2
      }
    });

    test("detects circular dependency", () => {
      // A1 = B1, B1 = A1
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create("=B1", a1).value);
      cellRepository.set(b1, Cell.create("=A1", b1).value);

      dependencyRepository.addDependency(a1, b1);
      dependencyRepository.addDependency(b1, a1);

      const result = service.calculateCell(a1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Circular dependency");
      }
    });

    test("handles formula errors", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create("=A1/0", b1).value);

      dependencyRepository.addDependency(b1, a1);

      const result = service.calculateCell(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasError()).toBe(true);
        expect(result.value.error).toContain("Division by zero");
      }
    });

    test("caches calculation results", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create("=A1*2", b1).value);

      dependencyRepository.addDependency(b1, a1);

      // First calculation
      const result1 = service.calculateCell(b1);
      expect(result1.ok).toBe(true);

      // Change A1 (but don't invalidate cache)
      cellRepository.set(a1, Cell.create(20).value);

      // Second calculation should return cached value
      const result2 = service.calculateCell(b1);
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.computedValue).toBe(20); // Still 10*2, not 20*2
      }
    });

    test("emits CellCalculated event", () => {
      const address = CellAddress.create(0, 0).value;
      const cell = Cell.create(42).value;
      cellRepository.set(address, cell);

      let eventEmitted = false;
      eventStore.on("CellCalculated", (event) => {
        eventEmitted = true;
        expect(event.address).toBe(address);
        expect(event.cell.computedValue).toBe(42);
      });

      service.calculateCell(address);
      expect(eventEmitted).toBe(true);
    });
  });

  describe("calculateRange", () => {
    test("calculates multiple cells", () => {
      const a1 = CellAddress.create(0, 0).value;
      const a2 = CellAddress.create(1, 0).value;
      const a3 = CellAddress.create(2, 0).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(a2, Cell.create(20).value);
      cellRepository.set(a3, Cell.create("=A1+A2", a3).value);

      dependencyRepository.addDependency(a3, a1);
      dependencyRepository.addDependency(a3, a2);

      const result = service.calculateRange([a1, a2, a3]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(3);
        expect(result.value.get("A1")?.computedValue).toBe(10);
        expect(result.value.get("A2")?.computedValue).toBe(20);
        expect(result.value.get("A3")?.computedValue).toBe(30);
      }
    });

    test("fails if any cell calculation fails", () => {
      const a1 = CellAddress.create(0, 0).value;
      const a2 = CellAddress.create(1, 0).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(a2, Cell.create("=UNKNOWN()", a2).value);

      const result = service.calculateRange([a1, a2]);
      expect(result.ok).toBe(false);
    });
  });

  describe("recalculateDependents", () => {
    test("recalculates all dependent cells", () => {
      // A1 = 10, B1 = A1*2, C1 = B1+5
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;
      const c1 = CellAddress.create(0, 2).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create("=A1*2", b1).value);
      cellRepository.set(c1, Cell.create("=B1+5", c1).value);

      dependencyRepository.addDependency(b1, a1);
      dependencyRepository.addDependency(c1, b1);

      // Change A1
      cellRepository.set(a1, Cell.create(20).value);

      // Recalculate dependents
      const result = service.recalculateDependents(a1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.get("A1")?.computedValue).toBe(20);
        expect(result.value.get("B1")?.computedValue).toBe(40); // 20*2
        expect(result.value.get("C1")?.computedValue).toBe(45); // 40+5
      }
    });

    test("handles empty dependents", () => {
      const a1 = CellAddress.create(0, 0).value;
      cellRepository.set(a1, Cell.create(10).value);

      const result = service.recalculateDependents(a1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(1);
        expect(result.value.get("A1")?.computedValue).toBe(10);
      }
    });
  });

  describe("invalidateCache", () => {
    test("invalidates cache for cell and dependents", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create("=A1*2", b1).value);

      dependencyRepository.addDependency(b1, a1);

      // Calculate to populate cache
      service.calculateCell(b1);

      // Invalidate A1
      service.invalidateCache(a1);

      // Change A1
      cellRepository.set(a1, Cell.create(20).value);

      // Recalculate B1 - should use new value
      const result = service.calculateCell(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(40); // 20*2
      }
    });

    test("handles invalid address gracefully", () => {
      const invalidAddress = CellAddress.create(0, 0).value;
      // Should not throw
      expect(() => {
        service.invalidateCache(invalidAddress);
      }).not.toThrow();
    });
  });

  describe("clearCache", () => {
    test("clears all cached values", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(b1, Cell.create(20).value);

      // Calculate to populate cache
      service.calculateCell(a1);
      service.calculateCell(b1);

      // Clear cache
      service.clearCache();

      // Change values
      cellRepository.set(a1, Cell.create(100).value);
      cellRepository.set(b1, Cell.create(200).value);

      // Recalculate - should use new values
      const result1 = service.calculateCell(a1);
      const result2 = service.calculateCell(b1);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value.computedValue).toBe(100);
        expect(result2.value.computedValue).toBe(200);
      }
    });
  });

  describe("complex scenarios", () => {
    test("calculates SUM with range", () => {
      // A1=10, A2=20, A3=30, B1=SUM(A1:A3)
      const a1 = CellAddress.create(0, 0).value;
      const a2 = CellAddress.create(1, 0).value;
      const a3 = CellAddress.create(2, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(10).value);
      cellRepository.set(a2, Cell.create(20).value);
      cellRepository.set(a3, Cell.create(30).value);
      cellRepository.set(b1, Cell.create("=SUM(A1:A3)", b1).value);

      dependencyRepository.addDependency(b1, a1);
      dependencyRepository.addDependency(b1, a2);
      dependencyRepository.addDependency(b1, a3);

      const result = service.calculateCell(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe(60);
      }
    });

    test("calculates IF with conditions", () => {
      const a1 = CellAddress.create(0, 0).value;
      const b1 = CellAddress.create(0, 1).value;

      cellRepository.set(a1, Cell.create(15).value);
      cellRepository.set(b1, Cell.create('=IF(A1>10,"High","Low")', b1).value);

      dependencyRepository.addDependency(b1, a1);

      const result = service.calculateCell(b1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.computedValue).toBe("High");
      }
    });
  });
});
