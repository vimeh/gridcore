import type { ReferenceInfo, ReferenceType } from "@gridcore/core";
import { ReferenceDetector } from "@gridcore/core";

/**
 * Represents a highlight segment in a formula string.
 */
export interface HighlightSegment {
  /** Start position in the formula string */
  start: number;
  /** End position in the formula string */
  end: number;
  /** Text content of the segment */
  text: string;
  /** Type of content (reference, normal, operator, etc.) */
  type: HighlightType;
  /** Reference type if this is a reference segment */
  referenceType?: ReferenceType;
  /** Original reference info if this is a reference */
  referenceInfo?: ReferenceInfo;
}

/**
 * Types of content that can be highlighted in a formula.
 */
export type HighlightType =
  | "reference"
  | "operator"
  | "function"
  | "number"
  | "string"
  | "parenthesis"
  | "normal";

/**
 * Color scheme for different highlight types.
 */
export interface HighlightColors {
  /** Colors for different reference types */
  references: {
    relative: string;
    absolute: string;
    "mixed-column": string;
    "mixed-row": string;
  };
  /** Colors for other formula elements */
  elements: {
    operator: string;
    function: string;
    number: string;
    string: string;
    parenthesis: string;
    normal: string;
  };
}

/**
 * Default color scheme for formula highlighting.
 */
export const DEFAULT_HIGHLIGHT_COLORS: HighlightColors = {
  references: {
    relative: "#4ECDC4", // Teal for relative references (A1)
    absolute: "#FF6B6B", // Red for absolute references ($A$1)
    "mixed-column": "#FFD93D", // Yellow for mixed column ($A1)
    "mixed-row": "#6BCF7F", // Green for mixed row (A$1)
  },
  elements: {
    operator: "#E17055", // Orange for operators (+, -, *, /)
    function: "#74B9FF", // Blue for functions (SUM, MAX, etc.)
    number: "#A29BFE", // Purple for numbers
    string: "#00B894", // Green for strings
    parenthesis: "#636E72", // Gray for parentheses
    normal: "#2D3436", // Dark gray for normal text
  },
};

/**
 * TUI-specific colors using RGB values.
 */
export const TUI_HIGHLIGHT_COLORS = {
  references: {
    relative: { r: 78, g: 205, b: 196, a: 255 },
    absolute: { r: 255, g: 107, b: 107, a: 255 },
    "mixed-column": { r: 255, g: 217, b: 61, a: 255 },
    "mixed-row": { r: 107, g: 207, b: 127, a: 255 },
  },
  elements: {
    operator: { r: 225, g: 112, b: 85, a: 255 },
    function: { r: 116, g: 185, b: 255, a: 255 },
    number: { r: 162, g: 155, b: 254, a: 255 },
    string: { r: 0, g: 184, b: 148, a: 255 },
    parenthesis: { r: 99, g: 110, b: 114, a: 255 },
    normal: { r: 255, g: 255, b: 255, a: 255 },
  },
};

/**
 * Analyzes formulas and provides highlighting information for UI components.
 */
export class FormulaHighlighter {
  private detector: ReferenceDetector;

  constructor() {
    this.detector = new ReferenceDetector();
  }

  /**
   * Analyze a formula and return highlighting segments.
   */
  highlightFormula(formula: string): HighlightSegment[] {
    const segments: HighlightSegment[] = [];

    if (!formula) {
      return segments;
    }

    // Get reference analysis first
    const analysis = this.detector.analyzeFormula(formula);

    // Create segments by processing the formula character by character
    let currentPosition = 0;

    // Sort references by position to process them in order
    const sortedReferences = analysis.references.sort(
      (a, b) => a.position - b.position,
    );

    for (const ref of sortedReferences) {
      // Add any normal text before this reference
      if (currentPosition < ref.position) {
        const normalText = formula.substring(currentPosition, ref.position);
        this.addNormalTextSegments(segments, normalText, currentPosition);
      }

      // Add the reference segment
      segments.push({
        start: ref.position,
        end: ref.position + ref.length,
        text: ref.text,
        type: "reference",
        referenceType: ref.type,
        referenceInfo: ref,
      });

      currentPosition = ref.position + ref.length;
    }

    // Add any remaining normal text
    if (currentPosition < formula.length) {
      const remainingText = formula.substring(currentPosition);
      this.addNormalTextSegments(segments, remainingText, currentPosition);
    }

    return segments;
  }

  /**
   * Get color for a specific reference type.
   */
  getReferenceColor(
    type: ReferenceType,
    colors: HighlightColors = DEFAULT_HIGHLIGHT_COLORS,
  ): string {
    return colors.references[type];
  }

  /**
   * Get TUI color for a specific reference type.
   */
  getTUIReferenceColor(type: ReferenceType): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    return TUI_HIGHLIGHT_COLORS.references[type];
  }

  /**
   * Find the reference segment at a specific cursor position.
   */
  findReferenceAtCursor(
    segments: HighlightSegment[],
    cursorPosition: number,
  ): HighlightSegment | null {
    return (
      segments.find(
        (segment) =>
          segment.type === "reference" &&
          cursorPosition >= segment.start &&
          cursorPosition < segment.end,
      ) || null
    );
  }

  /**
   * Find the next reference segment after a given position.
   */
  findNextReference(
    segments: HighlightSegment[],
    position: number,
  ): HighlightSegment | null {
    return (
      segments.find(
        (segment) => segment.type === "reference" && segment.start > position,
      ) || null
    );
  }

  /**
   * Find the previous reference segment before a given position.
   */
  findPreviousReference(
    segments: HighlightSegment[],
    position: number,
  ): HighlightSegment | null {
    const referenceSegments = segments
      .filter(
        (segment) => segment.type === "reference" && segment.end <= position, // Reference must end before or at the position
      )
      .sort((a, b) => b.start - a.start);

    return referenceSegments[0] || null;
  }

  /**
   * Update a reference segment with new text and reference info.
   */
  updateReferenceSegment(
    segments: HighlightSegment[],
    oldSegment: HighlightSegment,
    newText: string,
    newRefInfo: ReferenceInfo,
  ): HighlightSegment[] {
    const segmentIndex = segments.findIndex((seg) => seg === oldSegment);
    if (segmentIndex === -1) {
      return segments;
    }

    const newSegments = [...segments];
    const lengthDiff = newText.length - oldSegment.text.length;

    // Update the reference segment
    newSegments[segmentIndex] = {
      ...oldSegment,
      end: oldSegment.start + newText.length,
      text: newText,
      referenceType: newRefInfo.type,
      referenceInfo: newRefInfo,
    };

    // Adjust positions of subsequent segments
    for (let i = segmentIndex + 1; i < newSegments.length; i++) {
      newSegments[i] = {
        ...newSegments[i],
        start: newSegments[i].start + lengthDiff,
        end: newSegments[i].end + lengthDiff,
      };
    }

    return newSegments;
  }

  /**
   * Get reference statistics for a formula.
   */
  getReferenceStats(formula: string): {
    total: number;
    byType: Record<ReferenceType, number>;
  } {
    const segments = this.highlightFormula(formula);
    const referenceSegments = segments.filter(
      (seg) => seg.type === "reference",
    );

    const byType: Record<ReferenceType, number> = {
      relative: 0,
      absolute: 0,
      "mixed-column": 0,
      "mixed-row": 0,
    };

    referenceSegments.forEach((seg) => {
      if (seg.referenceType) {
        byType[seg.referenceType]++;
      }
    });

    return {
      total: referenceSegments.length,
      byType,
    };
  }

  /**
   * Add normal text segments, potentially breaking them into different types.
   */
  private addNormalTextSegments(
    segments: HighlightSegment[],
    text: string,
    startPosition: number,
  ): void {
    // For now, we'll just add everything as normal text
    // Later, we could enhance this to detect functions, operators, numbers, etc.
    if (text.trim().length > 0) {
      segments.push({
        start: startPosition,
        end: startPosition + text.length,
        text: text,
        type: "normal",
      });
    }
  }
}
