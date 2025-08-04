#!/usr/bin/env bun
import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"

const execAsync = promisify(exec)

/**
 * Opens the state diagram HTML in the default browser
 */
async function openStateDiagram() {
  const htmlPath = join(import.meta.dir, "../docs/state-machine/state-diagram.html")

  // Check if the file exists
  if (!existsSync(htmlPath)) {
    console.error("❌ State diagram not found. Run 'bun run generate:state-docs' first.")
    process.exit(1)
  }

  // Open in browser based on platform
  const platform = process.platform
  let command: string

  if (platform === "darwin") {
    command = `open "${htmlPath}"`
  } else if (platform === "win32") {
    command = `start "${htmlPath}"`
  } else {
    // Linux
    command = `xdg-open "${htmlPath}"`
  }

  try {
    await execAsync(command)
    console.log(`✅ Opened state diagram in browser: ${htmlPath}`)
  } catch (error) {
    console.error("Failed to open browser:", error)
    console.log(`You can manually open: ${htmlPath}`)
  }
}

// Run if called directly
if (import.meta.main) {
  openStateDiagram()
}