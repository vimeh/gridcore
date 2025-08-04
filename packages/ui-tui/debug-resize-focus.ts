import { SpreadsheetTUI } from "./src/SpreadsheetTUI"

const tui = new SpreadsheetTUI()

// Enter resize mode
console.log("Initial state:", tui.getState().spreadsheetMode)
tui["handleKeyPress"]("g", { ctrl: false, alt: false, shift: false, key: "g" })
tui["handleKeyPress"]("r", { ctrl: false, alt: false, shift: false, key: "r" })

const state1 = tui.getState()
console.log("\nAfter 'gr':")
console.log("- Mode:", state1.spreadsheetMode)
console.log("- ResizeTarget:", state1.resizeTarget)
console.log("- ResizeIndex:", state1.resizeIndex)

// Try to move to next column
console.log("\nPressing 'l' key...")
const result = tui["handleKeyPress"]("l", { ctrl: false, alt: false, shift: false, key: "l" })
console.log("handleKeyPress result:", result)

const state2 = tui.getState()
console.log("\nAfter 'l':")
console.log("- Mode:", state2.spreadsheetMode)
console.log("- ResizeTarget:", state2.resizeTarget)
console.log("- ResizeIndex:", state2.resizeIndex)

// Let's also check what the controller thinks about this
const controller = tui["controller"]
console.log("\nController state:", controller.getState().resizeIndex)