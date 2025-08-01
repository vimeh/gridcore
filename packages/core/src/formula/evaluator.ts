import { ASTNode } from "./ast"
import { FormulaParser } from "./parser"
import { CellAddress, CellValueType, Cell } from "../types"

export type CellGetter = (address: CellAddress) => Cell | undefined
export type RangeGetter = (start: CellAddress, end: CellAddress) => Cell[]

export interface EvaluationContext {
  getCellValue: CellGetter
  getRangeValues: RangeGetter
  currentCell?: CellAddress
}

export interface EvaluationResult {
  value?: CellValueType
  error?: string
}

export class FormulaEvaluator {
  private parser: FormulaParser
  private functions: Map<string, Function>

  constructor() {
    this.parser = new FormulaParser()
    this.functions = new Map()
    this.registerBuiltInFunctions()
  }

  evaluate(formula: string, context: EvaluationContext): EvaluationResult {
    try {
      const parseResult = this.parser.parse(formula)
      
      if (parseResult.error) {
        return { error: `Parse error: ${parseResult.error.message}` }
      }

      if (!parseResult.ast) {
        return { error: "No AST generated" }
      }

      const value = this.evaluateNode(parseResult.ast, context)
      return { value }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message }
      }
      return { error: "Unknown evaluation error" }
    }
  }

  private evaluateNode(node: ASTNode, context: EvaluationContext): CellValueType {
    switch (node.type) {
      case "number":
        return node.value

      case "string":
        return node.value

      case "boolean":
        return node.value

      case "cell": {
        const cell = context.getCellValue(node.address)
        if (!cell) return 0
        if (cell.error) throw new Error(cell.error)
        return cell.computedValue ?? cell.rawValue
      }

      case "range": {
        throw new Error("Range references must be used within functions")
      }

      case "binary": {
        const left = this.evaluateNode(node.left, context)
        const right = this.evaluateNode(node.right, context)
        return this.evaluateBinaryOp(node.operator, left, right)
      }

      case "unary": {
        const operand = this.evaluateNode(node.operand, context)
        return this.evaluateUnaryOp(node.operator, operand)
      }

      case "function": {
        return this.evaluateFunction(node.name, node.args, context)
      }

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`)
    }
  }

  private evaluateBinaryOp(op: string, left: CellValueType, right: CellValueType): CellValueType {
    // Type coercion for numeric operations
    if (["+", "-", "*", "/", "^"].includes(op)) {
      const leftNum = this.toNumber(left)
      const rightNum = this.toNumber(right)

      switch (op) {
        case "+": return leftNum + rightNum
        case "-": return leftNum - rightNum
        case "*": return leftNum * rightNum
        case "/": 
          if (rightNum === 0) throw new Error("#DIV/0!")
          return leftNum / rightNum
        case "^": return Math.pow(leftNum, rightNum)
      }
    }

    // String concatenation
    if (op === "&") {
      return String(left) + String(right)
    }

    // Comparison operators
    switch (op) {
      case "=": return left === right
      case "<>": return left !== right
      case "<": return this.toNumber(left) < this.toNumber(right)
      case ">": return this.toNumber(left) > this.toNumber(right)
      case "<=": return this.toNumber(left) <= this.toNumber(right)
      case ">=": return this.toNumber(left) >= this.toNumber(right)
    }

    throw new Error(`Unknown operator: ${op}`)
  }

  private evaluateUnaryOp(op: string, operand: CellValueType): CellValueType {
    const num = this.toNumber(operand)
    
    switch (op) {
      case "+": return num
      case "-": return -num
      default:
        throw new Error(`Unknown unary operator: ${op}`)
    }
  }

  private evaluateFunction(name: string, args: ASTNode[], context: EvaluationContext): CellValueType {
    const func = this.functions.get(name.toUpperCase())
    if (!func) {
      throw new Error(`#NAME? Unknown function: ${name}`)
    }

    return func.call(this, args, context)
  }

  private toNumber(value: CellValueType): number {
    if (typeof value === "number") return value
    if (typeof value === "boolean") return value ? 1 : 0
    if (typeof value === "string") {
      const num = parseFloat(value)
      if (isNaN(num)) return 0
      return num
    }
    return 0
  }

  private registerBuiltInFunctions() {
    // Math functions
    this.functions.set("SUM", (args: ASTNode[], context: EvaluationContext) => {
      let sum = 0
      for (const arg of args) {
        if (arg.type === "range") {
          const cells = context.getRangeValues(arg.range.start, arg.range.end)
          for (const cell of cells) {
            if (cell && !cell.error) {
              const value = cell.computedValue ?? cell.rawValue
              sum += this.toNumber(value)
            }
          }
        } else {
          sum += this.toNumber(this.evaluateNode(arg, context))
        }
      }
      return sum
    })

    this.functions.set("AVERAGE", (args: ASTNode[], context: EvaluationContext) => {
      let sum = 0
      let count = 0
      for (const arg of args) {
        if (arg.type === "range") {
          const cells = context.getRangeValues(arg.range.start, arg.range.end)
          for (const cell of cells) {
            if (cell && !cell.error) {
              const value = cell.computedValue ?? cell.rawValue
              if (typeof value === "number" || (typeof value === "string" && !isNaN(parseFloat(value)))) {
                sum += this.toNumber(value)
                count++
              }
            }
          }
        } else {
          const value = this.evaluateNode(arg, context)
          sum += this.toNumber(value)
          count++
        }
      }
      if (count === 0) throw new Error("#DIV/0!")
      return sum / count
    })

    this.functions.set("COUNT", (args: ASTNode[], context: EvaluationContext) => {
      let count = 0
      for (const arg of args) {
        if (arg.type === "range") {
          const cells = context.getRangeValues(arg.range.start, arg.range.end)
          for (const cell of cells) {
            if (cell && !cell.error) {
              const value = cell.computedValue ?? cell.rawValue
              if (typeof value === "number" || (typeof value === "string" && !isNaN(parseFloat(value)))) {
                count++
              }
            }
          }
        } else {
          const value = this.evaluateNode(arg, context)
          if (typeof value === "number") count++
        }
      }
      return count
    })

    this.functions.set("MAX", (args: ASTNode[], context: EvaluationContext) => {
      let max = -Infinity
      let hasValue = false
      for (const arg of args) {
        if (arg.type === "range") {
          const cells = context.getRangeValues(arg.range.start, arg.range.end)
          for (const cell of cells) {
            if (cell && !cell.error) {
              const value = cell.computedValue ?? cell.rawValue
              const num = this.toNumber(value)
              if (!isNaN(num)) {
                max = Math.max(max, num)
                hasValue = true
              }
            }
          }
        } else {
          const value = this.evaluateNode(arg, context)
          const num = this.toNumber(value)
          max = Math.max(max, num)
          hasValue = true
        }
      }
      if (!hasValue) return 0
      return max
    })

    this.functions.set("MIN", (args: ASTNode[], context: EvaluationContext) => {
      let min = Infinity
      let hasValue = false
      for (const arg of args) {
        if (arg.type === "range") {
          const cells = context.getRangeValues(arg.range.start, arg.range.end)
          for (const cell of cells) {
            if (cell && !cell.error) {
              const value = cell.computedValue ?? cell.rawValue
              const num = this.toNumber(value)
              if (!isNaN(num)) {
                min = Math.min(min, num)
                hasValue = true
              }
            }
          }
        } else {
          const value = this.evaluateNode(arg, context)
          const num = this.toNumber(value)
          min = Math.min(min, num)
          hasValue = true
        }
      }
      if (!hasValue) return 0
      return min
    })

    // Logic functions
    this.functions.set("IF", (args: ASTNode[], context: EvaluationContext) => {
      if (args.length < 2 || args.length > 3) {
        throw new Error("IF requires 2 or 3 arguments")
      }
      const condition = this.evaluateNode(args[0], context)
      const isTrue = Boolean(condition)
      
      if (isTrue) {
        return this.evaluateNode(args[1], context)
      } else if (args.length === 3) {
        return this.evaluateNode(args[2], context)
      } else {
        return false
      }
    })

    this.functions.set("AND", (args: ASTNode[], context: EvaluationContext) => {
      for (const arg of args) {
        const value = this.evaluateNode(arg, context)
        if (!Boolean(value)) return false
      }
      return true
    })

    this.functions.set("OR", (args: ASTNode[], context: EvaluationContext) => {
      for (const arg of args) {
        const value = this.evaluateNode(arg, context)
        if (Boolean(value)) return true
      }
      return false
    })

    this.functions.set("NOT", (args: ASTNode[], context: EvaluationContext) => {
      if (args.length !== 1) {
        throw new Error("NOT requires exactly 1 argument")
      }
      const value = this.evaluateNode(args[0], context)
      return !Boolean(value)
    })

    // Text functions
    this.functions.set("CONCATENATE", (args: ASTNode[], context: EvaluationContext) => {
      let result = ""
      for (const arg of args) {
        const value = this.evaluateNode(arg, context)
        result += String(value)
      }
      return result
    })

    this.functions.set("UPPER", (args: ASTNode[], context: EvaluationContext) => {
      if (args.length !== 1) {
        throw new Error("UPPER requires exactly 1 argument")
      }
      const value = this.evaluateNode(args[0], context)
      return String(value).toUpperCase()
    })

    this.functions.set("LOWER", (args: ASTNode[], context: EvaluationContext) => {
      if (args.length !== 1) {
        throw new Error("LOWER requires exactly 1 argument")
      }
      const value = this.evaluateNode(args[0], context)
      return String(value).toLowerCase()
    })

    this.functions.set("LEN", (args: ASTNode[], context: EvaluationContext) => {
      if (args.length !== 1) {
        throw new Error("LEN requires exactly 1 argument")
      }
      const value = this.evaluateNode(args[0], context)
      return String(value).length
    })
  }

  registerFunction(name: string, func: Function): void {
    this.functions.set(name.toUpperCase(), func)
  }
}