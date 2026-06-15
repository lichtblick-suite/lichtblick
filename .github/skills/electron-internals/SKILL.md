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

The preload script (`packages/suite-desktop/src/preload/index.ts`) exposes **four** separate
bridges to the renderer — not a single `desktopBridge`:

```typescript
// packages/suite-desktop/src/preload/index.ts
contextBridge.exposeInMainWorld("ctxbridge", ctx);            // main app/context API (Desktop)
contextBridge.exposeInMainWorld("menuBridge", menuBridge);    // native menu event subscription
contextBridge.exposeInMainWorld("storageBridge", storageBridge); // local file storage CRUD
contextBridge.exposeInMainWorld("desktopBridge", desktopBridge); // desktop-specific operations
```

| Bridge | Type | Purpose |
|--------|------|---------|
| `ctxbridge` | `Desktop` | Core context API consumed by the renderer app shell |
| `menuBridge` | `NativeMenuBridge` | Subscribe to forwarded native menu events (`addIpcEventListener`) |
| `storageBridge` | `Storage` | Local file storage: `list`, `all`, `get`, `put`, `delete` |
| `desktopBridge` | `Desktop` | Desktop-specific operations (deep links, color scheme, etc.) |

```typescript
// renderer — consuming a bridge
const desktopBridge = (global as { desktopBridge: Desktop }).desktopBridge;
const storageBridge = (global as { storageBridge: Storage }).storageBridge;
await storageBridge.list("layouts");
```

### Security Rules
- Never expose `ipcRenderer` directly
- Class instances do not survive the bridge — only plain functions/objects are exposed (prototypes are lost), which is why storage methods are `.bind()`-attached in preload
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

### Layout / Storage Loading
- Local storage entries are read/written via `storageBridge` (`list`, `all`, `get`, `put`, `delete`)
- The renderer's `DesktopLayoutLoader` (`packages/suite-desktop/src/renderer/services/DesktopLayoutLoader.ts`) wraps these calls

### Extension Loading
- `.foxe` files in extension directory
- `DesktopExtensionLoader` (filesystem type) reads directly via bridge
- Supports install/uninstall by copying/deleting files

## Deep Links

```
lichtblick://open?url=https://example.com/recording.mcap
```

- **OS protocol registration** uses the legacy `foxglove` scheme:
  `app.setAsDefaultProtocolClient("foxglove")` (`packages/suite-desktop/src/main/index.ts`)
- **Handled deep-link URLs** use the `lichtblick://` scheme — the `open-url` handler and
  second-instance argv filter both match `arg.startsWith("lichtblick://")`
- Recognized links include `lichtblick://open?...` and `lichtblick://signin-complete`
- Second-instance handler re-emits `open-url` and forwards to the existing window
- Parsed in renderer to open the appropriate data source

> ⚠️ The protocol-client registration argument (`"foxglove"`) differs from the URL scheme the app
> actually parses (`lichtblick://`). Do not assume they are the same string.

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
