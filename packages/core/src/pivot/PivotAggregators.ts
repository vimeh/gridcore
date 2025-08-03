import type { CellValueType } from "../types"
import type { AggregatorDefinition, AggregatorFunction, AggregatorType } from "./PivotTypes"

const toNumber = (value: CellValueType): number => {
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") {
    const num = parseFloat(value)
    if (Number.isNaN(num)) return 0
    return num
  }
  return 0
}

const isNumeric = (value: CellValueType): boolean => {
  if (typeof value === "number") return true
  if (typeof value === "string") {
    const num = parseFloat(value)
    return !Number.isNaN(num)
  }
  return false
}

const sumAggregator: AggregatorFunction = (values: CellValueType[]) => {
  return values.reduce<number>((sum, val) => sum + toNumber(val), 0)
}

const averageAggregator: AggregatorFunction = (values: CellValueType[]) => {
  if (values.length === 0) return 0
  const numericValues = values.filter(isNumeric)
  if (numericValues.length === 0) return 0
  const sum = numericValues.reduce<number>((acc, val) => acc + toNumber(val), 0)
  return sum / numericValues.length
}

const countAggregator: AggregatorFunction = (values: CellValueType[]) => {
  return values.filter(isNumeric).length
}

const countaAggregator: AggregatorFunction = (values: CellValueType[]) => {
  return values.filter(val => val != null && val !== "").length
}

const minAggregator: AggregatorFunction = (values: CellValueType[]) => {
  const numericValues = values.filter(isNumeric).map(toNumber)
  if (numericValues.length === 0) return 0
  return Math.min(...numericValues)
}

const maxAggregator: AggregatorFunction = (values: CellValueType[]) => {
  const numericValues = values.filter(isNumeric).map(toNumber)
  if (numericValues.length === 0) return 0
  return Math.max(...numericValues)
}

const productAggregator: AggregatorFunction = (values: CellValueType[]) => {
  const numericValues = values.filter(isNumeric).map(toNumber)
  if (numericValues.length === 0) return 0
  return numericValues.reduce<number>((product, val) => product * val, 1)
}

export const aggregators: Map<AggregatorType, AggregatorDefinition> = new Map([
  ["SUM", { name: "SUM", fn: sumAggregator, requiresNumeric: true }],
  ["AVERAGE", { name: "AVERAGE", fn: averageAggregator, requiresNumeric: true }],
  ["COUNT", { name: "COUNT", fn: countAggregator, requiresNumeric: true }],
  ["COUNTA", { name: "COUNTA", fn: countaAggregator, requiresNumeric: false }],
  ["MIN", { name: "MIN", fn: minAggregator, requiresNumeric: true }],
  ["MAX", { name: "MAX", fn: maxAggregator, requiresNumeric: true }],
  ["PRODUCT", { name: "PRODUCT", fn: productAggregator, requiresNumeric: true }]
])

export function getAggregator(type: AggregatorType): AggregatorDefinition {
  const aggregator = aggregators.get(type)
  if (!aggregator) {
    throw new Error(`Unknown aggregator type: ${type}`)
  }
  return aggregator
}