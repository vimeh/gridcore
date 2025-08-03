# GridCore Desktop

A native desktop application for GridCore using Tauri v2, wrapping the ui-web interface.

## Architecture

- **Frontend**: Uses the ui-web package build output
- **Backend**: Rust-powered Tauri framework
- **Plugins**: File system access, dialogs, shell commands, and logging

## Development

```bash
# Install dependencies
bun install

# Run in development mode (starts ui-web dev server automatically)
bun run dev

# Build for production
bun run build
```

## Features

- Native desktop performance
- Small bundle size (~3MB)
- Cross-platform support (Windows, macOS, Linux)
- Secure by default with capability-based permissions
- Native file system access
- System dialogs
- Shell command execution (with permissions)
- OS-level menu bar with keyboard shortcuts

## Configuration

- Window settings: `src-tauri/tauri.conf.json`
- Rust backend: `src-tauri/src/`
- Capabilities: `src-tauri/capabilities/default.json`
- Menu configuration: `src-tauri/src/menu.rs`

## Menu System

The desktop app includes a native OS-level menu bar with:

- **File Menu**: New, Open, Save, Save As, Export, Quit
- **Edit Menu**: Undo, Redo, Cut, Copy, Paste, Select All, Find, Replace
- **View Menu**: Zoom controls, Fullscreen, Toggle Vim mode, Toggle UI elements
- **Window Menu**: Minimize, Close
- **Help Menu**: Documentation, Keyboard shortcuts, Report issue, About

Menu events are forwarded to the web UI via postMessage for handling.