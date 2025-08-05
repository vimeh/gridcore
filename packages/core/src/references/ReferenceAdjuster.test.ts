import { describe, expect, test } from "bun:test";
import { CellAddress } from "../domain/models/CellAddress";
import { ReferenceAdjuster } from "./ReferenceAdjuster";
import type { CellReference } from "./types";

describe("ReferenceAdjuster", () => {
  describe("adjustForCopy", () => {
    test("should adjust relative references when copying", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      const sourceResult = CellAddress.create(0, 0); // A1
      const targetResult = CellAddress.create(1, 1); // B2

      expect(sourceResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);

      if (sourceResult.ok && targetResult.ok) {
        const result = adjuster.adjustForCopy(
          ref,
          sourceResult.value,
          targetResult.value,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 1,
            row: 1,
            columnAbsolute: false,
            rowAbsolute: false,
          });
          expect(result.value.changed).toBe(true);
          expect(result.value.clamped).toBe(false);
        }
      }
    });

    test("should not adjust absolute references", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: true,
      };

      const sourceResult = CellAddress.create(0, 0);
      const targetResult = CellAddress.create(1, 1);

      expect(sourceResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);

      if (sourceResult.ok && targetResult.ok) {
        const result = adjuster.adjustForCopy(
          ref,
          sourceResult.value,
          targetResult.value,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 0,
            row: 0,
            columnAbsolute: true,
            rowAbsolute: true,
          });
          expect(result.value.changed).toBe(false);
        }
      }
    });

    test("should adjust only relative components of mixed references", () => {
      const adjuster = new ReferenceAdjuster();
      const mixedColRef: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: false,
      };

      const sourceResult = CellAddress.create(0, 0);
      const targetResult = CellAddress.create(2, 3);

      expect(sourceResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);

      if (sourceResult.ok && targetResult.ok) {
        const result = adjuster.adjustForCopy(
          mixedColRef,
          sourceResult.value,
          targetResult.value,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 0,
            row: 2,
            columnAbsolute: true,
            rowAbsolute: false,
          });
          expect(result.value.changed).toBe(true);
        }
      }
    });

    test("should clamp to bounds when enabled", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 1,
        row: 1,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      const sourceResult = CellAddress.create(2, 2);
      const targetResult = CellAddress.create(0, 0);

      expect(sourceResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);

      if (sourceResult.ok && targetResult.ok) {
        const result = adjuster.adjustForCopy(
          ref,
          sourceResult.value,
          targetResult.value,
          {
            clampToBounds: true,
          },
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 0,
            row: 0,
            columnAbsolute: false,
            rowAbsolute: false,
          });
          expect(result.value.clamped).toBe(true);
        }
      }
    });

    test("should return error when going out of bounds with strict checking", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 1,
        row: 1,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      const sourceResult = CellAddress.create(2, 2);
      const targetResult = CellAddress.create(0, 0);

      expect(sourceResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);

      if (sourceResult.ok && targetResult.ok) {
        const result = adjuster.adjustForCopy(
          ref,
          sourceResult.value,
          targetResult.value,
          {
            clampToBounds: false,
          },
        );

        expect(result.ok).toBe(false);
        expect(result.error).toBe("OUT_OF_BOUNDS");
      }
    });
  });

  describe("cycleReferenceType", () => {
    test("should cycle through all reference types", () => {
      const adjuster = new ReferenceAdjuster();
      let ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      // A1 -> $A$1
      ref = adjuster.cycleReferenceType(ref);
      expect(ref.columnAbsolute).toBe(true);
      expect(ref.rowAbsolute).toBe(true);

      // $A$1 -> A$1
      ref = adjuster.cycleReferenceType(ref);
      expect(ref.columnAbsolute).toBe(false);
      expect(ref.rowAbsolute).toBe(true);

      // A$1 -> $A1
      ref = adjuster.cycleReferenceType(ref);
      expect(ref.columnAbsolute).toBe(true);
      expect(ref.rowAbsolute).toBe(false);

      // $A1 -> A1
      ref = adjuster.cycleReferenceType(ref);
      expect(ref.columnAbsolute).toBe(false);
      expect(ref.rowAbsolute).toBe(false);
    });
  });

  describe("explicit reference type setters", () => {
    test("should set reference types explicitly", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: true,
      };

      expect(adjuster.makeRelative(ref)).toEqual({
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      });

      expect(adjuster.makeAbsolute(ref)).toEqual({
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: true,
      });

      expect(adjuster.makeMixedColumn(ref)).toEqual({
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: false,
      });

      expect(adjuster.makeMixedRow(ref)).toEqual({
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: true,
      });
    });
  });

  describe("adjustForFill", () => {
    test("should adjust correctly for down fill", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      const fillStartResult = CellAddress.create(0, 0); // A1
      const fillTargetResult = CellAddress.create(2, 0); // A3

      expect(fillStartResult.ok).toBe(true);
      expect(fillTargetResult.ok).toBe(true);

      if (fillStartResult.ok && fillTargetResult.ok) {
        const result = adjuster.adjustForFill(
          ref,
          fillStartResult.value,
          fillTargetResult.value,
          "down",
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 0,
            row: 2,
            columnAbsolute: false,
            rowAbsolute: false,
          });
        }
      }
    });

    test("should adjust correctly for right fill", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      const fillStartResult = CellAddress.create(0, 0); // A1
      const fillTargetResult = CellAddress.create(0, 2); // C1

      expect(fillStartResult.ok).toBe(true);
      expect(fillTargetResult.ok).toBe(true);

      if (fillStartResult.ok && fillTargetResult.ok) {
        const result = adjuster.adjustForFill(
          ref,
          fillStartResult.value,
          fillTargetResult.value,
          "right",
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.reference).toEqual({
            column: 2,
            row: 0,
            columnAbsolute: false,
            rowAbsolute: false,
          });
        }
      }
    });
  });

  describe("wouldBeOutOfBounds", () => {
    test("should detect when adjustment would go out of bounds", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 1,
        row: 1,
        columnAbsolute: false,
        rowAbsolute: false,
      };

      expect(adjuster.wouldBeOutOfBounds(ref, -2, -2)).toBe(true);
      expect(adjuster.wouldBeOutOfBounds(ref, 1, 1)).toBe(false);
    });

    test("should respect absolute flags when checking bounds", () => {
      const adjuster = new ReferenceAdjuster();
      const ref: CellReference = {
        column: 1,
        row: 1,
        columnAbsolute: true,
        rowAbsolute: false,
      };

      expect(adjuster.wouldBeOutOfBounds(ref, -2, -2)).toBe(true);
      expect(adjuster.wouldBeOutOfBounds(ref, -2, 0)).toBe(false);
    });
  });
});
