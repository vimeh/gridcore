import { SpreadsheetTUI } from "./src/SpreadsheetTUI"

const tui = new SpreadsheetTUI()

// Enter resize mode
console.log("Before gr:", tui.getState().spreadsheetMode)
tui["handleKeyPress"]("g", { ctrl: false, alt: false, shift: false, key: "g" })
tui["handleKeyPress"]("r", { ctrl: false, alt: false, shift: false, key: "r" })
console.log("After gr:", tui.getState().spreadsheetMode, "resizeIndex:", tui.getState().resizeIndex)

// Try to move to next column
tui["handleKeyPress"]("l", { ctrl: false, alt: false, shift: false, key: "l" })
console.log("After l:", tui.getState().resizeIndex)