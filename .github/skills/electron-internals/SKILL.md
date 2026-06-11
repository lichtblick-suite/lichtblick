---
description: "Deep Electron implementation knowledge: main/renderer process communication, contextBridge patterns, BrowserWindow lifecycle, native menu integration, and security considerations."
---

# Electron Internals Skill

## Process Architecture

### Main Process
- Node.js environment with full OS access
- Manages BrowserWindow instances
- Handles app lifecycle (startup, quit, focus)
- Single-instance lock prevents multiple app copies

### Preload Script
- Runs in renderer context BUT with Node.js access
- Bridge between main and renderer via `contextBridge.exposeInMainWorld()`
- Must be minimal — every import adds to startup time

### Renderer Process
- Standard web environment (Chromium)
- No direct Node.js access (security)
- Communicates with main via exposed bridges

## contextBridge Pattern

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld("desktopBridge", {
  updateNativeColorScheme: () => ipcRenderer.send("updateNativeColorScheme"),
  fetchLayouts: () => ipcRenderer.invoke("fetchLayouts"),
  // ...typed API surface
});
```

```typescript
// renderer/Root.tsx — consuming the bridge
const desktopBridge = (global as { desktopBridge: Desktop }).desktopBridge;
await desktopBridge.fetchLayouts();
```

### Security Rules
- Never expose `ipcRenderer` directly
- Each bridge method is a typed, scoped function
- No `eval()`, no `remote` module usage
- CSP headers prevent inline scripts

## BrowserWindow Management (StudioWindow)

```typescript
class StudioWindow {
  #window: BrowserWindow;

  constructor() {
    this.#window = new BrowserWindow({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,  // needed for preload Node access
      },
    });
  }
}
```

### Window Lifecycle
1. App starts → `StudioWindow` created
2. Preload runs → bridges exposed
3. Renderer loads → React app mounts
4. Deep links → forwarded to renderer via bridge
5. Close → cleanup, save state, quit

## Native Menu Integration

```typescript
// Main process builds menu template
const template: MenuItemConstructorOptions[] = [
  { label: "File", submenu: [
    { label: "Open File...", click: () => sendToRenderer("open-file") },
  ]},
];

// Renderer receives via menuBridge
menuBridge.on("menu-event", (event: ForwardedMenuEvent) => {
  switch (event) {
    case "open-file": // show file picker
  }
});
```

## File System Access

### Layout Loading
- Layouts stored as `.json` files in app data directory
- `desktopBridge.fetchLayouts()` → main process reads directory → returns array

### Extension Loading
- `.foxe` files in extension directory
- `DesktopExtensionLoader` (filesystem type) reads directly via bridge
- Supports install/uninstall by copying/deleting files

## Deep Links

```
lichtblick://open?url=https://example.com/recording.mcap
```

- Registered via `app.setAsDefaultProtocolClient("lichtblick")`
- Second-instance handler forwards to existing window
- Parsed in renderer to open appropriate data source

## Build & Packaging

- `desktop/electronBuilderConfig.js` — electron-builder configuration
- `desktop/webpack.config.ts` — webpack for main/preload/renderer
- Output: `.dmg` (macOS), `.exe`/`.msi` (Windows), `.deb`/`.AppImage` (Linux)
- Auto-update via electron-updater (if configured)

## Performance Tips

1. **Preload weight**: Keep preload imports minimal — delays window show
2. **IPC serialization**: Large objects are serialized — prefer transferring file paths over file contents
3. **Window show**: Use `show: false` + `ready-to-show` event for smooth startup
4. **Background throttling**: Electron throttles background tabs by default — respect this for power usage
