import type { CellAddress } from "../domain/models/CellAddress";
import { ReferenceAdjuster } from "../references/ReferenceAdjuster";
import { ReferenceDetector } from "../references/ReferenceDetector";
import { ReferenceParser } from "../references/ReferenceParser";
import type { AdjustmentOptions } from "../references/types";
import { err, ok, type Result } from "../shared/types/Result";

/**
 * Interface for formula transformation results.
 */
export interface FormulaTransformResult {
  /** The transformed formula string */
  formula: string;
  /** Whether any references were actually changed */
  changed: boolean;
  /** Number of references that were adjusted */
  adjustedCount: number;
  /** References that went out of bounds and were clamped */
  clampedReferences: string[];
}

/**
 * Transforms formulas by adjusting cell references during copy/paste operations.
 *
 * This class integrates the reference detection, parsing, and adjustment systems
 * to provide formula transformation capabilities for copy/paste operations.
 */
export class FormulaTransformer {
  private detector: ReferenceDetector;
  private adjuster: ReferenceAdjuster;
  private parser: ReferenceParser;

  constructor() {
    this.detector = new ReferenceDetector();
    this.adjuster = new ReferenceAdjuster();
    this.parser = new ReferenceParser();
  }

  /**
   * Transform a formula by adjusting all cell references for a copy operation.
   *
   * @param formula - The original formula string (with or without leading =)
   * @param source - The source cell address where the formula was copied from
   * @param target - The target cell address where the formula is being pasted
   * @param options - Additional adjustment options
   * @returns The transformed formula with adjusted references
   */
  transformForCopy(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<FormulaTransformResult> {
    try {
      // Analyze the formula to find all references
      const analysis = this.detector.analyzeFormula(formula);

      if (analysis.references.length === 0) {
        // No references to transform
        return ok({
          formula,
          changed: false,
          adjustedCount: 0,
          clampedReferences: [],
        });
      }

      // Sort references by position in reverse order so we can replace them
      // without affecting the positions of subsequent references
      const sortedRefs = [...analysis.references].sort(
        (a, b) => b.position - a.position,
      );

      let transformedFormula = formula;
      let totalChanged = false;
      let adjustedCount = 0;
      const clampedReferences: string[] = [];

      // Process each reference
      for (const refInfo of sortedRefs) {
        // Adjust the reference using the adjuster
        const adjustResult = this.adjuster.adjustForCopy(
          refInfo.reference,
          source,
          target,
          options,
        );

        if (!adjustResult.ok) {
          return err(
            `Failed to adjust reference ${refInfo.text}: ${adjustResult.error}`,
          );
        }

        const adjustment = adjustResult.value;

        if (adjustment.changed) {
          // Convert the adjusted reference back to string
          const newRefString = this.parser.stringifyCellReference(
            adjustment.reference,
          );

          // Replace the reference in the formula
          const beforeRef = transformedFormula.substring(0, refInfo.position);
          const afterRef = transformedFormula.substring(
            refInfo.position + refInfo.length,
          );
          transformedFormula = beforeRef + newRefString + afterRef;

          totalChanged = true;
          adjustedCount++;

          if (adjustment.clamped) {
            clampedReferences.push(refInfo.text);
          }
        }
      }

      return ok({
        formula: transformedFormula,
        changed: totalChanged,
        adjustedCount,
        clampedReferences,
      });
    } catch (error) {
      return err(
        error instanceof Error ? error.message : "Unknown transformation error",
      );
    }
  }

  /**
   * Transform a formula by adjusting references for a fill operation.
   *
   * @param formula - The original formula string
   * @param fillStart - The starting cell of the fill operation
   * @param fillTarget - The target cell of the fill operation
   * @param direction - The direction of the fill operation
   * @param options - Additional adjustment options
   * @returns The transformed formula with adjusted references
   */
  transformForFill(
    formula: string,
    fillStart: CellAddress,
    fillTarget: CellAddress,
    direction: "up" | "down" | "left" | "right",
    options: AdjustmentOptions = {},
  ): Result<FormulaTransformResult> {
    try {
      const analysis = this.detector.analyzeFormula(formula);

      if (analysis.references.length === 0) {
        return ok({
          formula,
          changed: false,
          adjustedCount: 0,
          clampedReferences: [],
        });
      }

      const sortedRefs = [...analysis.references].sort(
        (a, b) => b.position - a.position,
      );

      let transformedFormula = formula;
      let totalChanged = false;
      let adjustedCount = 0;
      const clampedReferences: string[] = [];

      for (const refInfo of sortedRefs) {
        const adjustResult = this.adjuster.adjustForFill(
          refInfo.reference,
          fillStart,
          fillTarget,
          direction,
          options,
        );

        if (!adjustResult.ok) {
          return err(
            `Failed to adjust reference ${refInfo.text} for fill: ${adjustResult.error}`,
          );
        }

        const adjustment = adjustResult.value;

        if (adjustment.changed) {
          const newRefString = this.parser.stringifyCellReference(
            adjustment.reference,
          );

          const beforeRef = transformedFormula.substring(0, refInfo.position);
          const afterRef = transformedFormula.substring(
            refInfo.position + refInfo.length,
          );
          transformedFormula = beforeRef + newRefString + afterRef;

          totalChanged = true;
          adjustedCount++;

          if (adjustment.clamped) {
            clampedReferences.push(refInfo.text);
          }
        }
      }

      return ok({
        formula: transformedFormula,
        changed: totalChanged,
        adjustedCount,
        clampedReferences,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error.message
          : "Unknown fill transformation error",
      );
    }
  }

  /**
   * Preview the transformation without actually applying it.
   * Useful for showing users what changes will be made.
   */
  previewTransformation(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<{
    original: string;
    transformed: string;
    changes: Array<{ from: string; to: string }>;
  }> {
    const analysis = this.detector.analyzeFormula(formula);
    const changes: Array<{ from: string; to: string }> = [];

    for (const refInfo of analysis.references) {
      const adjustResult = this.adjuster.adjustForCopy(
        refInfo.reference,
        source,
        target,
        options,
      );

      if (adjustResult.ok && adjustResult.value.changed) {
        const newRefString = this.parser.stringifyCellReference(
          adjustResult.value.reference,
        );
        changes.push({
          from: refInfo.text,
          to: newRefString,
        });
      }
    }

    const transformResult = this.transformForCopy(
      formula,
      source,
      target,
      options,
    );
    if (!transformResult.ok) {
      return err(transformResult.error);
    }

    return ok({
      original: formula,
      transformed: transformResult.value.formula,
      changes,
    });
  }
}
