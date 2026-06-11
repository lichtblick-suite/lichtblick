---
description: "Deep extension system implementation knowledge: IExtensionLoader interface contracts, IndexedDB storage schema, version-compare cache strategy, contribution point registration, extension sandbox, and the .foxe packaging format."
---

# Extensions Internals Skill

## IExtensionLoader Interface

```typescript
interface IExtensionLoader {
  readonly namespace: string;        // "org" | "local"
  readonly type: string;             // "filesystem" | "indexeddb" | "remote"

  getExtensions(): Promise<ExtensionInfo[]>;
  loadExtension(id: string): Promise<ExtensionContent>;
  installExtension(foxeUrl: string): Promise<ExtensionInfo>;
  uninstallExtension(id: string): Promise<void>;
}
```

All loaders implement this interface — the catalog provider doesn't know the backing store.

## IdbExtensionLoader (IndexedDB)

### Storage Schema
- Database name: `"extensions"`
- Object store: `"extensions"`
- Key: composite `[namespace, extensionId]`
- Value: `{ info: ExtensionInfo, content: ExtensionContent }`

### Cache Strategy (loadSingleExtension)
```
1. Check IndexedDB for cached entry
2. If cached version === available version → return cached
3. If no cache OR version mismatch → download .foxe → unzip → store → return
```

Version comparison uses semver:
- Same version → skip download (cache hit)
- Different version → re-download (cache invalidation)

### Namespace Isolation
- `"org"` extensions: managed by organization, auto-synced
- `"local"` extensions: user-installed, never auto-removed
- Same extension ID can exist in both namespaces (org wins in conflicts)

## RemoteExtensionLoader

```typescript
class RemoteExtensionLoader implements IExtensionLoader {
  readonly namespace = "org";
  readonly type = "remote";

  constructor(private apiUrl: string, private workspace: string) {}

  async getExtensions(): Promise<ExtensionInfo[]> {
    // GET /api/workspaces/{workspace}/extensions
    const response = await fetch(`${this.apiUrl}/workspaces/${this.workspace}/extensions`);
    return response.json();
  }

  async loadExtension(id: string): Promise<ExtensionContent> {
    // GET /api/workspaces/{workspace}/extensions/{id}/content
    const foxeBlob = await fetch(...);
    return unpackFoxe(foxeBlob);
  }
}
```

## .foxe Package Format (Detail)

### Structure
```
├── package.json         (required)
├── dist/
│   └── index.js         (required — bundled extension entry)
├── README.md            (optional)
└── CHANGELOG.md         (optional)
```

### package.json Required Fields
```json
{
  "name": "@publisher/extension-name",
  "version": "1.2.3",
  "displayName": "Human Readable Name",
  "description": "What this extension does",
  "publisher": "publisher-name",
  "main": "dist/index.js",
  "lichtblick": {
    // Contribution declarations
  }
}
```

### Contribution Declarations
```json
{
  "lichtblick": {
    "panels": [{
      "name": "MyPanel",
      "title": "My Custom Panel"
    }],
    "messageConverters": [{
      "fromSchemaName": "custom_msgs/MyType",
      "toSchemaName": "foxglove.ImageAnnotations"
    }],
    "topicAliasFunctions": [{
      "name": "myAlias",
      "title": "My Topic Alias"
    }]
  }
}
```

## ExtensionCatalogProvider (Zustand Store)

### State Shape
```typescript
interface ExtensionCatalogState {
  installedExtensions: ExtensionInfo[];
  installedPanels: Map<string, RegisteredPanel>;
  installedMessageConverters: MessageConverter[];
  installedTopicAliasFunctions: TopicAliasFunction[];
  installedCameraModels: CameraModel[];

  // Actions
  refreshExtensions: () => Promise<void>;
  installExtension: (loader: IExtensionLoader, url: string) => Promise<void>;
  uninstallExtension: (loader: IExtensionLoader, id: string) => Promise<void>;
}
```

### Registration Flow
```
refreshExtensions() called
  → For each loader: getExtensions()
  → For each extension: loadExtension()
  → Execute extension code in sandbox
  → Extension calls activate(context)
  → context.registerPanel() / context.registerMessageConverter()
  → Zustand state updated with new contributions
```

## Extension Sandbox

Extensions run in a restricted context:
- No direct DOM access (panels render via React component)
- No `fetch` access (unless explicitly granted)
- Limited to the extension API surface:
  ```typescript
  interface ExtensionContext {
    registerPanel(config: PanelConfig): void;
    registerMessageConverter(config: ConverterConfig): void;
    registerTopicAliasFunction(config: AliasConfig): void;
  }
  ```

## Panel Registration

```typescript
// Inside extension's activate():
export function activate(context: ExtensionContext) {
  context.registerPanel({
    name: "MyPanel",
    initPanel: (panelAPI: PanelExtensionContext) => {
      panelAPI.onRender = (renderState, done) => {
        // Render panel content
        done();
      };
      panelAPI.subscribe([{ topic: "/my_topic" }]);
    },
  });
}
```

## Conflict Resolution

Priority order when same contribution exists in multiple sources:
1. Local namespace (user-installed) — highest priority
2. Org namespace (organization-managed)
3. Built-in panels (always lowest priority)

## Debugging Extensions

1. Check browser DevTools console for extension load errors
2. IndexedDB inspector shows cached extension data
3. Extension catalog zustand devtools shows registration state
4. Common issues: missing `main` field, incorrect contribution format, version string format
