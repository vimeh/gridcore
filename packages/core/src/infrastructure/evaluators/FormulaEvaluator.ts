import type {
  IFormulaEvaluator,
  FormulaAST,
  EvaluationContext,
  FormulaFunction,
} from "../../domain/interfaces/IFormulaEvaluator"
import { Result, ok, err } from "../../shared/types/Result"
import { CellValue, isNumericValue, isStringValue } from "../../domain/models/CellValue"
import { CellAddress } from "../../domain/models/CellAddress"
import { CellRange } from "../../domain/models/CellRange"

export class FormulaEvaluator implements IFormulaEvaluator {
  private readonly builtinFunctions: Map<string, (args: CellValue[]) => Result<CellValue>>

  constructor() {
    this.builtinFunctions = new Map([
      ["SUM", this.sumFunction],
      ["AVERAGE", this.averageFunction],
      ["COUNT", this.countFunction],
      ["MAX", this.maxFunction],
      ["MIN", this.minFunction],
      ["IF", this.ifFunction],
      ["CONCAT", this.concatFunction],
      ["LEN", this.lenFunction],
      ["UPPER", this.upperFunction],
      ["LOWER", this.lowerFunction],
    ])
  }

  evaluate(ast: FormulaAST, context: EvaluationContext): Result<CellValue> {
    try {
      const result = this.evaluateNode(ast, context)
      return result
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown evaluation error")
    }
  }

  private evaluateNode(node: FormulaAST, context: EvaluationContext): Result<CellValue> {
    switch (node.type) {
      case "literal":
        return ok(node.value as CellValue)

      case "cellRef":
        if (!node.address) {
          return err("Cell reference missing address")
        }
        const cellValue = context.getCellValue(node.address)
        return ok(cellValue)

      case "rangeRef":
        if (!node.range) {
          return err("Range reference missing range")
        }
        const values = context.getRangeValues(node.range)
        // Range values are handled specially by functions
        return ok(values as any)

      case "function":
        if (!node.name || !node.arguments) {
          return err("Function missing name or arguments")
        }
        return this.evaluateFunction(node.name, node.arguments, context)

      case "binaryOp":
        if (!node.left || !node.right) {
          return err("Binary operation missing operands")
        }
        return this.evaluateBinaryOp(node.operator || "", node.left, node.right, context)

      case "unaryOp":
        if (!node.operand) {
          return err("Unary operation missing operand")
        }
        return this.evaluateUnaryOp(node.operator || "", node.operand, context)

      default:
        return err(`Unknown AST node type: ${(node as any).type}`)
    }
  }

  private evaluateFunction(
    name: string,
    args: FormulaAST[],
    context: EvaluationContext
  ): Result<CellValue> {
    // Evaluate arguments
    const evaluatedArgs: CellValue[] = []
    for (const arg of args) {
      const result = this.evaluateNode(arg, context)
      if (!result.ok) {
        return err(result.error)
      }
      
      // If the result is an array (from range), flatten it
      if (Array.isArray(result.value)) {
        evaluatedArgs.push(...result.value)
      } else {
        evaluatedArgs.push(result.value)
      }
    }

    // Get function implementation
    const func = this.builtinFunctions.get(name.toUpperCase())
    if (!func) {
      return err(`Unknown function: ${name}`)
    }

    return func.call(this, evaluatedArgs)
  }

  private evaluateBinaryOp(
    operator: string,
    left: FormulaAST,
    right: FormulaAST,
    context: EvaluationContext
  ): Result<CellValue> {
    const leftResult = this.evaluateNode(left, context)
    if (!leftResult.ok) {
      return err(leftResult.error)
    }

    const rightResult = this.evaluateNode(right, context)
    if (!rightResult.ok) {
      return err(rightResult.error)
    }

    const leftValue = leftResult.value
    const rightValue = rightResult.value

    switch (operator) {
      case "+":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue + rightValue)
        }
        return err("Addition requires numeric operands")

      case "-":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue - rightValue)
        }
        return err("Subtraction requires numeric operands")

      case "*":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue * rightValue)
        }
        return err("Multiplication requires numeric operands")

      case "/":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          if (rightValue === 0) {
            return err("Division by zero")
          }
          return ok(leftValue / rightValue)
        }
        return err("Division requires numeric operands")

      case "^":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(Math.pow(leftValue, rightValue))
        }
        return err("Exponentiation requires numeric operands")

      case "=":
        return ok(leftValue === rightValue)

      case "<>":
        return ok(leftValue !== rightValue)

      case "<":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue < rightValue)
        }
        return err("Less than requires numeric operands")

      case ">":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue > rightValue)
        }
        return err("Greater than requires numeric operands")

      case "<=":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue <= rightValue)
        }
        return err("Less than or equal requires numeric operands")

      case ">=":
        if (isNumericValue(leftValue) && isNumericValue(rightValue)) {
          return ok(leftValue >= rightValue)
        }
        return err("Greater than or equal requires numeric operands")

      default:
        return err(`Unknown operator: ${operator}`)
    }
  }

  private evaluateUnaryOp(
    operator: string,
    operand: FormulaAST,
    context: EvaluationContext
  ): Result<CellValue> {
    const operandResult = this.evaluateNode(operand, context)
    if (!operandResult.ok) {
      return err(operandResult.error)
    }

    const value = operandResult.value

    switch (operator) {
      case "-":
        if (isNumericValue(value)) {
          return ok(-value)
        }
        return err("Negation requires numeric operand")

      case "+":
        if (isNumericValue(value)) {
          return ok(value)
        }
        return err("Unary plus requires numeric operand")

      default:
        return err(`Unknown unary operator: ${operator}`)
    }
  }

  // Built-in functions
  private sumFunction(args: CellValue[]): Result<CellValue> {
    let sum = 0
    for (const arg of args) {
      if (isNumericValue(arg)) {
        sum += arg
      }
    }
    return ok(sum)
  }

  private averageFunction(args: CellValue[]): Result<CellValue> {
    const numericArgs = args.filter(isNumericValue)
    if (numericArgs.length === 0) {
      return err("AVERAGE requires at least one numeric value")
    }
    const sum = numericArgs.reduce((acc, val) => acc + val, 0)
    return ok(sum / numericArgs.length)
  }

  private countFunction(args: CellValue[]): Result<CellValue> {
    const count = args.filter(arg => arg !== null && arg !== undefined).length
    return ok(count)
  }

  private maxFunction(args: CellValue[]): Result<CellValue> {
    const numericArgs = args.filter(isNumericValue)
    if (numericArgs.length === 0) {
      return err("MAX requires at least one numeric value")
    }
    return ok(Math.max(...numericArgs))
  }

  private minFunction(args: CellValue[]): Result<CellValue> {
    const numericArgs = args.filter(isNumericValue)
    if (numericArgs.length === 0) {
      return err("MIN requires at least one numeric value")
    }
    return ok(Math.min(...numericArgs))
  }

  private ifFunction(args: CellValue[]): Result<CellValue> {
    if (args.length !== 3) {
      return err("IF requires exactly 3 arguments")
    }
    const [condition, trueValue, falseValue] = args
    
    // Evaluate condition as truthy/falsy
    const isTrue = condition === true || 
                   (isNumericValue(condition) && condition !== 0) ||
                   (isStringValue(condition) && condition.length > 0)
    
    return ok(isTrue ? trueValue : falseValue)
  }

  private concatFunction(args: CellValue[]): Result<CellValue> {
    const stringArgs = args.map(arg => 
      arg === null || arg === undefined ? "" : String(arg)
    )
    return ok(stringArgs.join(""))
  }

  private lenFunction(args: CellValue[]): Result<CellValue> {
    if (args.length !== 1) {
      return err("LEN requires exactly 1 argument")
    }
    const value = args[0]
    if (value === null || value === undefined) {
      return ok(0)
    }
    return ok(String(value).length)
  }

  private upperFunction(args: CellValue[]): Result<CellValue> {
    if (args.length !== 1) {
      return err("UPPER requires exactly 1 argument")
    }
    const value = args[0]
    if (value === null || value === undefined) {
      return ok("")
    }
    return ok(String(value).toUpperCase())
  }

  private lowerFunction(args: CellValue[]): Result<CellValue> {
    if (args.length !== 1) {
      return err("LOWER requires exactly 1 argument")
    }
    const value = args[0]
    if (value === null || value === undefined) {
      return ok("")
    }
    return ok(String(value).toLowerCase())
  }

  registerFunction(func: FormulaFunction): void {
    this.builtinFunctions.set(func.name.toUpperCase(), (args: CellValue[]) => func.evaluate(args, {} as EvaluationContext))
  }

  unregisterFunction(name: string): void {
    this.builtinFunctions.delete(name.toUpperCase())
  }

  hasFunction(name: string): boolean {
    return this.builtinFunctions.has(name.toUpperCase())
  }
}