import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { CellAddress, CellValue } from "../../../domain/models";
import { BaseBulkOperation } from "../base/BaseBulkOperation";
import type {
  BulkOperationOptions,
  Selection,
  UndoableBulkOperation,
} from "../interfaces/BulkOperation";
import type {
  CellChange,
  OperationPreview,
} from "../interfaces/OperationPreview";
import { OperationPreviewBuilder } from "../interfaces/OperationPreview";

/**
 * Options for find and replace operation
 */
export interface FindReplaceOptions extends BulkOperationOptions {
  /** The pattern to search for */
  findPattern: string;

  /** The replacement text */
  replaceWith: string;

  /** Whether to use regex pattern matching */
  useRegex?: boolean;

  /** Whether to perform case-sensitive matching */
  caseSensitive?: boolean;

  /** Whether to replace all occurrences in each cell (global) */
  global?: boolean;

  /** The scope of the operation */
  scope?: "selection" | "sheet" | "allSheets";

  /** Whether to search in formula content */
  searchInFormulas?: boolean;

  /** Whether to search only in cell values */
  searchInValues?: boolean;

  /** Whether to match whole cells only */
  wholeCellMatch?: boolean;
}

/**
 * Represents a found match within a cell
 */
export interface MatchResult {
  /** The cell address where the match was found */
  address: CellAddress;

  /** The original cell value */
  originalValue: string;

  /** The new value after replacement */
  newValue: string;

  /** Array of individual matches found in the cell */
  matches: {
    /** Start position of the match */
    start: number;
    /** End position of the match */
    end: number;
    /** The matched text */
    matchedText: string;
    /** The replacement text */
    replacementText: string;
  }[];

  /** Whether this cell contains a formula */
  isFormula: boolean;

  /** The type of content that was searched */
  searchType: "value" | "formula";
}

/**
 * Find and Replace operation that searches for patterns and replaces them
 * Supports regex patterns, case sensitivity, and different scopes
 */
export class FindReplaceOperation
  extends BaseBulkOperation
  implements UndoableBulkOperation
{
  private compiledPattern: RegExp | null = null;
  private findOptions: FindReplaceOptions;
  private matchResults: MatchResult[] = [];

  constructor(
    selection: Selection,
    options: FindReplaceOptions,
    cellRepository: ICellRepository,
  ) {
    super("findReplace", selection, options, cellRepository);
    this.findOptions = options;
    this.compilePattern();
  }

  /**
   * Compile the search pattern into a RegExp
   */
  private compilePattern(): void {
    try {
      const pattern = this.findOptions.findPattern;
      const flags = this.buildRegexFlags();

      if (this.findOptions.useRegex) {
        this.compiledPattern = new RegExp(pattern, flags);
      } else {
        // Escape special regex characters for literal matching
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        this.compiledPattern = new RegExp(
          this.findOptions.wholeCellMatch
            ? `^${escapedPattern}$`
            : escapedPattern,
          flags,
        );
      }
    } catch (error) {
      throw new Error(`Invalid search pattern: ${error}`);
    }
  }

  /**
   * Build regex flags based on options
   */
  private buildRegexFlags(): string {
    let flags = "";
    if (this.findOptions.global) {
      flags += "g";
    }
    if (!this.findOptions.caseSensitive) {
      flags += "i";
    }
    return flags;
  }

  /**
   * Transform each cell by finding and replacing matches
   */
  protected async transformCell(
    address: CellAddress,
    currentValue: CellValue,
  ): Promise<CellValue | null> {
    if (!this.compiledPattern) {
      return null;
    }

    // Get the cell to check if it has a formula
    const cell = await this.cellRepository.get(address);
    const isFormula = cell?.formula !== undefined;

    // Determine what content to search
    let searchContent: string;
    let searchType: "value" | "formula";

    if (isFormula && this.findOptions.searchInFormulas) {
      searchContent = cell?.rawValue as string; // Formula is stored in rawValue
      searchType = "formula";
    } else if (!isFormula && this.findOptions.searchInValues !== false) {
      // Search in values by default if not a formula
      searchContent = String(currentValue || "");
      searchType = "value";
    } else if (isFormula && this.findOptions.searchInValues !== false) {
      // For formula cells, search in the calculated value if searching values
      searchContent = String(currentValue || "");
      searchType = "value";
    } else {
      return null; // Skip this cell
    }

    // Find all matches
    const matches = this.findMatches(searchContent);
    if (matches.length === 0) {
      return null; // No matches found
    }

    // Perform replacement
    const newContent = this.performReplacement(searchContent, matches);

    // Store match result for preview
    this.matchResults.push({
      address,
      originalValue: searchContent,
      newValue: newContent,
      matches,
      isFormula,
      searchType,
    });

    // Return the appropriate new value
    if (searchType === "formula") {
      // For formula replacement, we would need to update the formula
      // This is a simplified implementation - in practice, we'd need to
      // work with the formula service to update formulas properly
      return currentValue; // For now, don't change the displayed value
    } else {
      return newContent;
    }
  }

  /**
   * Find all matches of the pattern in the given text
   */
  private findMatches(text: string): Array<{
    start: number;
    end: number;
    matchedText: string;
    replacementText: string;
  }> {
    if (!this.compiledPattern) {
      return [];
    }

    const matches: Array<{
      start: number;
      end: number;
      matchedText: string;
      replacementText: string;
    }> = [];

    if (this.findOptions.global) {
      let match;
      // Reset lastIndex to ensure we start from the beginning
      this.compiledPattern.lastIndex = 0;

      while ((match = this.compiledPattern.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          matchedText: match[0],
          replacementText: this.findOptions.replaceWith,
        });

        // Prevent infinite loop on zero-length matches
        if (match.index === this.compiledPattern.lastIndex) {
          this.compiledPattern.lastIndex++;
        }
      }
    } else {
      // Find only the first match
      const match = this.compiledPattern.exec(text);
      if (match) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          matchedText: match[0],
          replacementText: this.findOptions.replaceWith,
        });
      }
    }

    return matches;
  }

  /**
   * Perform the replacement using the found matches
   */
  private performReplacement(
    text: string,
    matches: Array<{
      start: number;
      end: number;
      matchedText: string;
      replacementText: string;
    }>,
  ): string {
    if (matches.length === 0) {
      return text;
    }

    if (!this.compiledPattern) {
      return text;
    }

    // For regex with capture groups, use String.replace() which handles $1, $2, etc.
    if (this.findOptions.useRegex) {
      return text.replace(this.compiledPattern, this.findOptions.replaceWith);
    }

    // For literal replacements, use manual replacement
    // Sort matches by start position in reverse order to avoid index shifting
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

    let result = text;
    for (const match of sortedMatches) {
      result =
        result.substring(0, match.start) +
        match.replacementText +
        result.substring(match.end);
    }

    return result;
  }

  /**
   * Generate a preview with highlighted matches
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    // Clear previous match results
    this.matchResults = [];

    // Call parent preview to get base functionality
    const basePreview = await super.preview(limit);

    // Create enhanced preview with match highlighting
    const builder = new OperationPreviewBuilder();

    // Copy base preview data
    builder.setAffectedCells(basePreview.affectedCells);
    builder.setTruncated(basePreview.isTruncated);
    builder.setSummary(basePreview.summary);
    builder.setEstimatedTime(basePreview.estimatedTime);

    // Add match-specific information
    for (const error of basePreview.errors) {
      builder.addError(error);
    }
    for (const warning of basePreview.warnings) {
      builder.addWarning(warning);
    }

    // Add enhanced changes with match highlighting
    for (const matchResult of this.matchResults.slice(0, limit)) {
      const change: CellChange = {
        address: matchResult.address,
        before: matchResult.originalValue,
        after: matchResult.newValue,
        isFormula: matchResult.isFormula,
        changeType: matchResult.searchType,
        metadata: {
          matches: matchResult.matches,
          searchType: matchResult.searchType,
          matchCount: matchResult.matches.length,
        },
      };

      builder.addChange(change);
    }

    // Add find/replace specific summary
    const totalMatches = this.matchResults.reduce(
      (sum, result) => sum + result.matches.length,
      0,
    );
    const enhancedSummary = {
      ...basePreview.summary,
      totalMatches,
      findPattern: this.findOptions.findPattern,
      replaceWith: this.findOptions.replaceWith,
      searchScope: this.findOptions.scope || "selection",
      caseSensitive: this.findOptions.caseSensitive || false,
      useRegex: this.findOptions.useRegex || false,
    };

    builder.setSummary(enhancedSummary);

    return builder.build();
  }

  /**
   * Validate the find/replace operation
   */
  validate(): string | null {
    // Check pattern first, before selection validation
    if (!this.findOptions.findPattern) {
      return "Find pattern cannot be empty";
    }

    if (this.findOptions.useRegex) {
      try {
        new RegExp(this.findOptions.findPattern);
      } catch (error) {
        return `Invalid regex pattern: ${error}`;
      }
    }

    // Then check base validation (selection, etc.)
    const baseValidation = super.validate();
    if (baseValidation) {
      return baseValidation;
    }

    return null;
  }

  /**
   * Get description of the operation
   */
  getDescription(): string {
    const scope = this.findOptions.scope || "selection";
    const pattern = this.findOptions.findPattern;
    const replacement = this.findOptions.replaceWith;
    const matchType = this.findOptions.caseSensitive
      ? "case-sensitive"
      : "case-insensitive";
    const patternType = this.findOptions.useRegex ? "regex" : "literal";

    return `Find "${pattern}" and replace with "${replacement}" (${patternType}, ${matchType}) in ${scope}`;
  }

  /**
   * Create an undo operation that reverses this find/replace
   */
  async createUndoOperation(): Promise<FindReplaceOperation> {
    // Create a reverse operation that replaces the new values back to original values
    const undoOptions: FindReplaceOptions = {
      ...this.findOptions,
      findPattern: this.findOptions.replaceWith,
      replaceWith: this.findOptions.findPattern,
      // For undo, we need to be more precise to avoid unintended replacements
      useRegex: false,
      wholeCellMatch: true,
    };

    return new FindReplaceOperation(
      this.selection,
      undoOptions,
      this.cellRepository,
    );
  }

  /**
   * Check if this operation can be undone
   */
  canUndo(): boolean {
    // Find/replace can generally be undone, but with some limitations
    // We can't perfectly undo regex replacements or operations that modify formulas
    return !this.findOptions.searchInFormulas && !this.findOptions.useRegex;
  }

  /**
   * Estimate time more accurately for find/replace operations
   */
  estimateTime(): number {
    const cellCount = this.selection.count();
    // Find/replace is more complex than simple set operations
    // Estimate based on pattern complexity and scope
    let cellsPerSecond = 15000; // Base rate for simple patterns

    if (this.findOptions.useRegex) {
      cellsPerSecond = Math.floor(cellsPerSecond * 0.7); // Regex is slower
    }

    if (this.findOptions.searchInFormulas) {
      cellsPerSecond = Math.floor(cellsPerSecond * 0.8); // Formula search is slower
    }

    const calculatedTime = Math.ceil((cellCount / cellsPerSecond) * 1000);
    return Math.max(200, calculatedTime); // Minimum 200ms
  }

  /**
   * Get match results from the last preview/execution
   */
  getMatchResults(): MatchResult[] {
    return [...this.matchResults];
  }

  /**
   * Get total number of matches found
   */
  getTotalMatches(): number {
    return this.matchResults.reduce(
      (sum, result) => sum + result.matches.length,
      0,
    );
  }
}
