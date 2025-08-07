import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    fs: {
      // Allow serving files from the gridcore-rs directory for WASM
      allow: [".."]
    }
  },
  build: {
    outDir: "dist",
  },
  optimizeDeps: {
    exclude: ["gridcore-controller"]
  },
  resolve: {
    alias: {
      "gridcore-controller": "/Users/vinay/v/code/gridcore/worktrees/rust/packages/ui-core/dist/gridcore_controller.js"
    }
  }
});
