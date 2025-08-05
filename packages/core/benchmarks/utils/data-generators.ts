import { CellAddress } from "../../src/domain/models/CellAddress"

export function generateRandomValue(): string | number {
  const type = Math.random()
  if (type < 0.6) {
    // 60% numbers
    return Math.floor(Math.random() * 10000)
  } else if (type < 0.8) {
    // 20% strings
    return `Text${Math.floor(Math.random() * 1000)}`
  } else {
    // 20% formulas
    const formulas = [
      "=A1+B1",
      "=SUM(A1:A10)",
      "=AVERAGE(B1:B5)",
      "=IF(A1>100,A1*2,A1)",
      "=A1*B1+C1",
    ]
    return formulas[Math.floor(Math.random() * formulas.length)]
  }
}

export function generateSequentialAddresses(count: number): CellAddress[] {
  const addresses: CellAddress[] = []
  let row = 0
  let col = 0

  for (let i = 0; i < count; i++) {
    const result = CellAddress.create(row, col)
    if (result.ok) {
      addresses.push(result.value)
    }

    col++
    if (col >= 26) {
      col = 0
      row++
    }
  }

  return addresses
}

export function generateRandomAddresses(count: number, maxRow = 1000, maxCol = 26): CellAddress[] {
  const addresses: CellAddress[] = []
  const seen = new Set<string>()

  while (addresses.length < count) {
    const row = Math.floor(Math.random() * maxRow)
    const col = Math.floor(Math.random() * maxCol)
    const result = CellAddress.create(row, col)
    
    if (result.ok) {
      const key = result.value.toString()
      if (!seen.has(key)) {
        seen.add(key)
        addresses.push(result.value)
      }
    }
  }

  return addresses
}

export function generateFormulaChain(length: number): Array<{ address: CellAddress; value: string | number }> {
  const data: Array<{ address: CellAddress; value: string | number }> = []
  
  // First cell has a value
  const firstAddr = CellAddress.create(0, 0)
  if (firstAddr.ok) {
    data.push({ address: firstAddr.value, value: 1 })
  }

  // Rest reference the previous cell
  for (let i = 1; i < length; i++) {
    const addr = CellAddress.create(i, 0)
    if (addr.ok) {
      data.push({ address: addr.value, value: `=A${i}+1` })
    }
  }

  return data
}

export function generateComplexFormulas(count: number): Array<{ address: CellAddress; value: string }> {
  const formulas: Array<{ address: CellAddress; value: string }> = []
  const templates = [
    "=SUM(A1:A10)*AVERAGE(B1:B10)",
    "=IF(SUM(A1:A5)>100,MAX(B1:B5),MIN(C1:C5))",
    "=AVERAGE(A1:A20)+SUM(B1:B20)/COUNT(C1:C20)",
    "=IF(A1>B1,IF(A1>C1,A1,C1),IF(B1>C1,B1,C1))",
    "=(SUM(A1:A10)-AVERAGE(A1:A10))/COUNT(A1:A10)",
  ]

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 26)
    const col = i % 26
    const addr = CellAddress.create(row, col)
    if (addr.ok) {
      const formula = templates[i % templates.length]
      formulas.push({ address: addr.value, value: formula })
    }
  }

  return formulas
}

export function generateLargeDataset(rows: number, cols: number): Map<string, string | number> {
  const data = new Map<string, string | number>()

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const addr = CellAddress.create(r, c)
      if (addr.ok) {
        // Mix of values and formulas
        if (r === 0 || c === 0) {
          // Headers
          data.set(addr.value.toString(), r === 0 ? `Col${c}` : `Row${r}`)
        } else if ((r + c) % 10 === 0) {
          // Some formulas
          data.set(addr.value.toString(), `=A${r}+${String.fromCharCode(65 + c)}1`)
        } else {
          // Mostly numbers
          data.set(addr.value.toString(), r * cols + c)
        }
      }
    }
  }

  return data
}