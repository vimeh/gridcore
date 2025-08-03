import type { Grid } from "../Grid";
import type { CellAddress, CellValueType } from "../types";
import { PivotTransformer } from "./PivotTransformer";
import type {
  PivotTableConfig,
  PivotTableMetadata,
  PivotTableOutput,
} from "./PivotTypes";

export class PivotTable {
  private config: PivotTableConfig;
  private transformer: PivotTransformer;
  private lastOutput?: PivotTableOutput;
  private metadata?: PivotTableMetadata;

  constructor(config: PivotTableConfig) {
    this.config = config;
    this.transformer = null as any; // Will be set when generating
  }

  setConfig(config: Partial<PivotTableConfig>): void {
    this.config = { ...this.config, ...config };
    this.lastOutput = undefined;
    this.metadata = undefined;
  }

  getConfig(): PivotTableConfig {
    return { ...this.config };
  }

  generate(sourceGrid: Grid, outputTopLeft: CellAddress): PivotTableOutput {
    this.transformer = new PivotTransformer(sourceGrid, this.config);
    const aggregatedData = this.transformer.transform();

    // Get unique row and column values
    const uniqueRowKeys = new Set<string>();
    const uniqueColumnKeys = new Set<string>();

    for (const [rowKey, columns] of aggregatedData) {
      uniqueRowKeys.add(rowKey);
      for (const columnKey of columns.keys()) {
        uniqueColumnKeys.add(columnKey);
      }
    }

    const sortedRowKeys = Array.from(uniqueRowKeys)
      .filter((key) => key !== undefined)
      .sort();
    const sortedColumnKeys = Array.from(uniqueColumnKeys)
      .filter((key) => key !== undefined)
      .sort();

    // Build the output grid
    const output = new Map<string, CellValueType>();
    const { row: startRow, col: startCol } = outputTopLeft;

    // Calculate dimensions
    const rowFieldCount = this.config.rowFields.length;
    const columnFieldCount = this.config.columnFields.length;
    const valueFieldCount = this.config.valueFields.length;

    const headerRows =
      columnFieldCount === 0
        ? 1
        : columnFieldCount + (valueFieldCount > 1 ? 1 : 0);
    const headerCols = rowFieldCount;

    // Place column headers
    if (this.config.columnFields.length > 0) {
      sortedColumnKeys.forEach((colKey, colIndex) => {
        const colParts = colKey.split("|");
        colParts.forEach((part, partIndex) => {
          const row = startRow + partIndex;
          const col = startCol + headerCols + colIndex * valueFieldCount;
          output.set(`${row},${col}`, part);
        });
      });
    }

    // Place value field headers
    if (this.config.columnFields.length === 0) {
      // No column fields - always show value field headers
      this.config.valueFields.forEach((valueField, vfIndex) => {
        const row = startRow;
        const col = startCol + headerCols + vfIndex;
        const label =
          valueField.alias ||
          `${valueField.fieldName} (${valueField.aggregator})`;
        output.set(`${row},${col}`, label);
      });
    } else if (valueFieldCount > 1) {
      // With column fields, place under each column
      sortedColumnKeys.forEach((_, colIndex) => {
        this.config.valueFields.forEach((valueField, vfIndex) => {
          const row = startRow + headerRows - 1;
          const col =
            startCol + headerCols + colIndex * valueFieldCount + vfIndex;
          const label =
            valueField.alias ||
            `${valueField.fieldName} (${valueField.aggregator})`;
          output.set(`${row},${col}`, label);
        });
      });
    }

    // Place row headers and data
    sortedRowKeys.forEach((rowKey, rowIndex) => {
      const rowParts = rowKey.split("|");

      // Row headers
      rowParts.forEach((part, partIndex) => {
        const row = startRow + headerRows + rowIndex;
        const col = startCol + partIndex;
        output.set(`${row},${col}`, part);
      });

      // Data values
      const rowData = aggregatedData.get(rowKey);
      if (rowData) {
        if (this.config.columnFields.length === 0) {
          // No column fields - aggregate all data for this row
          const cellData = rowData.get("");
          if (cellData) {
            this.config.valueFields.forEach((valueField, vfIndex) => {
              const fieldAlias =
                valueField.alias ||
                `${valueField.fieldName} (${valueField.aggregator})`;
              const value = cellData.get(fieldAlias);
              if (value !== undefined) {
                const row = startRow + headerRows + rowIndex;
                const col = startCol + headerCols + vfIndex;
                output.set(`${row},${col}`, value);
              }
            });
          }
        } else {
          // With column fields
          sortedColumnKeys.forEach((colKey, colIndex) => {
            const cellData = rowData.get(colKey);
            if (cellData) {
              this.config.valueFields.forEach((valueField, vfIndex) => {
                const fieldAlias =
                  valueField.alias ||
                  `${valueField.fieldName} (${valueField.aggregator})`;
                const value = cellData.get(fieldAlias);
                if (value !== undefined) {
                  const row = startRow + headerRows + rowIndex;
                  const col =
                    startCol +
                    headerCols +
                    colIndex * valueFieldCount +
                    vfIndex;
                  output.set(`${row},${col}`, value);
                }
              });
            }
          });
        }
      }
    });

    // Add totals if configured
    if (
      this.config.showRowTotals ||
      this.config.showColumnTotals ||
      this.config.showGrandTotals
    ) {
      this.addTotals(
        output,
        sortedRowKeys,
        sortedColumnKeys,
        aggregatedData,
        outputTopLeft,
        headerRows,
        headerCols,
        valueFieldCount,
      );
    }

    // Calculate dimensions
    const totalRows =
      headerRows +
      sortedRowKeys.length +
      (this.config.showColumnTotals ? 1 : 0);
    const totalCols =
      headerCols +
      sortedColumnKeys.length * valueFieldCount +
      (this.config.showRowTotals ? valueFieldCount : 0);

    this.lastOutput = {
      cells: output,
      dimensions: { rows: totalRows, cols: totalCols },
      topLeft: outputTopLeft,
    };

    this.metadata = {
      rowHeaders: sortedRowKeys.map((key) => key.split("|")),
      columnHeaders: sortedColumnKeys.map((key) => key.split("|")),
      dataStartRow: startRow + headerRows,
      dataStartCol: startCol + headerCols,
    };

    return this.lastOutput;
  }

  private addTotals(
    output: Map<string, CellValueType>,
    sortedRowKeys: string[],
    sortedColumnKeys: string[],
    aggregatedData: Map<string, Map<string, Map<string, CellValueType>>>,
    outputTopLeft: CellAddress,
    headerRows: number,
    headerCols: number,
    valueFieldCount: number,
  ): void {
    const { row: startRow, col: startCol } = outputTopLeft;

    // Row totals
    if (this.config.showRowTotals) {
      const totalColStart =
        startCol + headerCols + sortedColumnKeys.length * valueFieldCount;

      // Header
      output.set(`${startRow},${totalColStart}`, "Total");

      // Calculate row totals
      sortedRowKeys.forEach((rowKey, rowIndex) => {
        const rowData = aggregatedData.get(rowKey);
        if (rowData) {
          this.config.valueFields.forEach((valueField, vfIndex) => {
            const fieldAlias =
              valueField.alias ||
              `${valueField.fieldName} (${valueField.aggregator})`;
            let total = 0;

            for (const cellData of rowData.values()) {
              const value = cellData.get(fieldAlias);
              if (typeof value === "number") {
                total += value;
              }
            }

            const row = startRow + headerRows + rowIndex;
            const col = totalColStart + vfIndex;
            output.set(`${row},${col}`, total);
          });
        }
      });
    }

    // Column totals
    if (this.config.showColumnTotals) {
      const totalRowStart = startRow + headerRows + sortedRowKeys.length;

      // Header
      output.set(`${totalRowStart},${startCol}`, "Total");

      // Calculate column totals
      sortedColumnKeys.forEach((colKey, colIndex) => {
        this.config.valueFields.forEach((valueField, vfIndex) => {
          const fieldAlias =
            valueField.alias ||
            `${valueField.fieldName} (${valueField.aggregator})`;
          let total = 0;

          for (const [_, rowData] of aggregatedData) {
            const cellData = rowData.get(colKey);
            if (cellData) {
              const value = cellData.get(fieldAlias);
              if (typeof value === "number") {
                total += value;
              }
            }
          }

          const row = totalRowStart;
          const col =
            startCol + headerCols + colIndex * valueFieldCount + vfIndex;
          output.set(`${row},${col}`, total);
        });
      });
    }

    // Grand total
    if (
      this.config.showGrandTotals &&
      this.config.showRowTotals &&
      this.config.showColumnTotals
    ) {
      const totalRowStart = startRow + headerRows + sortedRowKeys.length;
      const totalColStart =
        startCol + headerCols + sortedColumnKeys.length * valueFieldCount;

      this.config.valueFields.forEach((valueField, vfIndex) => {
        const fieldAlias =
          valueField.alias ||
          `${valueField.fieldName} (${valueField.aggregator})`;
        let grandTotal = 0;

        for (const [_, rowData] of aggregatedData) {
          for (const cellData of rowData.values()) {
            const value = cellData.get(fieldAlias);
            if (typeof value === "number") {
              grandTotal += value;
            }
          }
        }

        const row = totalRowStart;
        const col = totalColStart + vfIndex;
        output.set(`${row},${col}`, grandTotal);
      });
    }
  }

  getLastOutput(): PivotTableOutput | undefined {
    return this.lastOutput;
  }

  getMetadata(): PivotTableMetadata | undefined {
    return this.metadata;
  }

  getFieldValues(grid: Grid, fieldName: string): CellValueType[] {
    if (!this.transformer) {
      this.transformer = new PivotTransformer(grid, this.config);
      // Need to transform to load the data
      this.transformer.transform();
    }
    return this.transformer.getUniqueValues(fieldName);
  }
}
