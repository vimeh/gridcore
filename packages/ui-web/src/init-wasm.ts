// Direct WASM initialization
import initCore from "gridcore-wasm"
import initController from "gridcore-controller"

let initialized = false

export async function initializeWasm(): Promise<void> {
  if (initialized) {
    console.warn("WASM already initialized")
    return
  }

  try {
    console.log("Initializing WASM core module...")
    await initCore()
    
    console.log("Initializing WASM controller module...")
    await initController()
    
    initialized = true
    console.log("WASM modules initialized successfully")
  } catch (error) {
    console.error("Failed to initialize WASM:", error)
    throw error
  }
}

export function isWasmInitialized(): boolean {
  return initialized
}