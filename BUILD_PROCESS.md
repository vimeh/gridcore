# GridCore Rust WASM Build Process

## Prerequisites
- Rust with wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`
- wasm-pack: `cargo install wasm-pack`
- Bun: `curl -fsSL https://bun.sh/install | bash`

## Complete Build Process

### 1. Build the Rust WASM Module
```bash
# Navigate to the WASM package directory
cd gridcore-rs/gridcore-wasm

# Build WASM module without optimization (avoids bulk memory errors)
wasm-pack build --target web --out-dir pkg --no-opt

# This creates the following files in pkg/:
# - gridcore_wasm.js (JavaScript glue code)
# - gridcore_wasm_bg.wasm (WebAssembly binary)
# - gridcore_wasm.d.ts (TypeScript definitions)
```

### 2. Copy WASM Files to UI
```bash
# Copy WASM files to ui-web for direct browser access
cp -r gridcore-rs/gridcore-wasm/pkg/* packages/ui-web/src/wasm/

# Files should now exist in:
# - packages/ui-web/src/wasm/gridcore_wasm.js
# - packages/ui-web/src/wasm/gridcore_wasm_bg.wasm
# - packages/ui-web/src/wasm/gridcore_wasm.d.ts
```

### 3. Build UI Core Package
```bash
# Navigate to ui-core package
cd packages/ui-core

# Install dependencies if needed
bun install

# Build the package
bun run build

# This creates dist/ with the TypeScript adapter that wraps WASM
```

### 4. Build UI Web Package
```bash
# Navigate to ui-web package  
cd packages/ui-web

# Install dependencies if needed
bun install

# No build needed for development - Vite serves directly
```

### 5. Run the Development Server
```bash
# From ui-web directory or project root
cd packages/ui-web
bun run dev

# Or from project root
bun run dev

# Server runs on http://localhost:3000
```

## Testing the Rust Core

### Option 1: Test Page
Navigate to: `http://localhost:3000/test-rust.html`
- This page directly tests WASM module loading and basic operations

### Option 2: Main App with Rust Core
Navigate to: `http://localhost:3000/?rust=true`
- The `?rust=true` query parameter activates the Rust core
- Without it, the app uses the TypeScript core

## Common Issues and Solutions

### Issue: "RuntimeError: Unreachable code should not be executed"
**Cause**: WasmWorkbook created without any sheets
**Solution**: Ensure WasmWorkbook::new() creates a default sheet (already fixed)

### Issue: "wasm-opt validation errors" 
**Cause**: Bulk memory operations not supported by wasm-opt
**Solution**: Build with `--no-opt` flag to skip optimization

### Issue: "WASM module not found"
**Cause**: WASM files not in correct location
**Solution**: Ensure files are copied to `packages/ui-web/src/wasm/`

### Issue: "Cannot find module '../wasm/gridcore_wasm.js'"
**Cause**: TypeScript can't find WASM module
**Solution**: Files must be in ui-web/src/wasm/, not ui-core

## Quick Rebuild Script

Create a script `rebuild-wasm.sh`:
```bash
#!/bin/bash
set -e

echo "Building WASM module..."
cd gridcore-rs/gridcore-wasm
wasm-pack build --target web --out-dir pkg --no-opt

echo "Copying WASM files..."
cp -r pkg/* ../../packages/ui-web/src/wasm/

echo "Building ui-core..."
cd ../../packages/ui-core
bun run build

echo "Done! Run 'bun run dev' to start the server"
```

Make it executable:
```bash
chmod +x rebuild-wasm.sh
```

## Project Structure
```
gridcore/
├── gridcore-rs/
│   ├── gridcore-core/       # Rust core spreadsheet engine
│   │   └── src/
│   │       ├── workbook/
│   │       │   ├── wasm.rs  # WASM bindings for workbook
│   │       │   └── workbook.rs
│   │       └── facade/
│   │           └── wasm.rs  # WASM bindings for facade
│   └── gridcore-wasm/       # WASM wrapper package
│       ├── Cargo.toml
│       ├── src/
│       │   └── lib.rs       # Re-exports all WASM types
│       └── pkg/             # Built WASM output
│           ├── gridcore_wasm.js
│           ├── gridcore_wasm_bg.wasm
│           └── gridcore_wasm.d.ts
└── packages/
    ├── ui-core/
    │   └── src/
    │       └── rust/
    │           └── adapter.ts  # TypeScript adapter for WASM
    └── ui-web/
        ├── src/
        │   ├── wasm/           # WASM files served to browser
        │   │   ├── gridcore_wasm.js
        │   │   └── gridcore_wasm_bg.wasm
        │   └── main.ts         # Entry point, checks ?rust=true
        └── public/
            └── test-rust.html  # WASM test page
```

## Environment Variables
- `USE_RUST_CORE=true` - Use Rust core instead of TypeScript (Node.js)
- URL param `?rust=true` - Use Rust core in browser

## Verification Steps
1. Check WASM module loads: Open browser console, should see "WASM core initialized successfully"
2. Test basic operations: Use test-rust.html buttons
3. Check main app: Spreadsheet should work with ?rust=true