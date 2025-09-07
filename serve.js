#!/usr/bin/env bun

// Simple static file server for GridCore
const port = process.env.PORT || 8080

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    let path = url.pathname

    // Default to index.html for root
    if (path === "/") {
      path = "/index.html"
    }

    // Serve files from dist directory
    const file = Bun.file(`./dist${path}`)
    
    if (await file.exists()) {
      // Set proper content type for WASM files
      const headers = {}
      if (path.endsWith(".wasm")) {
        headers["Content-Type"] = "application/wasm"
      } else if (path.endsWith(".js")) {
        headers["Content-Type"] = "application/javascript"
      } else if (path.endsWith(".css")) {
        headers["Content-Type"] = "text/css"
      } else if (path.endsWith(".html")) {
        headers["Content-Type"] = "text/html"
      }

      // Support brotli compression
      if (path.endsWith(".wasm") && req.headers.get("Accept-Encoding")?.includes("br")) {
        const brFile = Bun.file(`./dist${path}.br`)
        if (await brFile.exists()) {
          headers["Content-Encoding"] = "br"
          return new Response(brFile, { headers })
        }
      }

      // Support gzip compression
      if (path.endsWith(".wasm") && req.headers.get("Accept-Encoding")?.includes("gzip")) {
        const gzFile = Bun.file(`./dist${path}.gz`)
        if (await gzFile.exists()) {
          headers["Content-Encoding"] = "gzip"
          return new Response(gzFile, { headers })
        }
      }

      return new Response(file, { headers })
    }

    // Fallback to index.html for SPA routing
    return new Response(Bun.file("./dist/index.html"), {
      headers: { "Content-Type": "text/html" }
    })
  },
})

console.log(`✨ GridCore running at http://localhost:${port}`)
console.log(`   Serving files from ./dist/`)