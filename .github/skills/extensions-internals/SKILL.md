---
description: "Deep extension system implementation knowledge: IExtensionLoader interface contracts, IndexedDB storage schema, version-compare cache strategy, contribution point registration, extension sandbox, and the .foxe packaging format."
---

# Extensions Internals Skill

## IExtensionLoader Interface

Defined in `packages/suite-base/src/services/extension/IExtensionLoader.ts`:

```typescript
export type TypeExtensionLoader = "browser" | "server" | "filesystem";

export type LoadedExtension = {
  buffer?: Uint8Array;
  raw: string;
};

export type InstallExtensionProps = {
  foxeFileData: Uint8Array;
  file?: File;
  externalId?: string;
};

export interface IExtensionLoader {
  readonly namespace: Namespace;          // "org" | "local"
  readonly type: TypeExtensionLoader;     // "browser" | "server" | "filesystem"

  getExtension(id: string): Promise<ExtensionInfo | undefined>;
  getExtensions(): Promise<ExtensionInfo[]>;
  loadExtension(id: string): Promise<LoadedExtension>;
  installExtension(data: InstallExtensionProps): Promise<ExtensionInfo>;
  uninstallExtension(id: string): Promise<void>;
}
```

> ⚠️ `installExtension` takes an `InstallExtensionProps` object (with `foxeFileData`), **not** a
> URL string. The type union is `"browser" | "server" | "filesystem"` — there is no `"indexeddb"`
> or `"remote"` value.

Implementations:

| Class | File | namespace | type |
|-------|------|-----------|------|
| `IdbExtensionLoader` | `services/extension/IdbExtensionLoader.ts` | constructor arg | `"browser"` |
| `RemoteExtensionLoader` | `services/extension/RemoteExtensionLoader.ts` | constructor arg | `"server"` |
| `DesktopExtensionLoader` | `suite-desktop/src/renderer/services/DesktopExtensionLoader.ts` | `"local"` | `"filesystem"` |

All loaders implement this interface — the catalog provider doesn't know the backing store.

## IdbExtensionLoader + IdbExtensionStorage (IndexedDB)

`IdbExtensionLoader` delegates persistence to `IdbExtensionStorage`
(`packages/suite-base/src/services/extension/IdbExtensionStorage.ts`).

### Storage Schema
- Database name: `` `${KEY_WORKSPACE_PREFIX}lichtblick-extensions-${namespace}` `` (one DB per namespace)
- Database version: `1`
- Object store `metadata` — keyPath `"id"`, value `ExtensionInfo`
- Object store `extensions` — keyPath `"info.id"`, value `StoredExtension`

### Install Flow (installExtension)
```
1. Receive InstallExtensionProps { foxeFileData, file?, externalId? }
2. Decompress + extract package.json / dist entry from the .foxe
3. validatePackageInfo() builds ExtensionInfo
4. Persist ExtensionInfo to `metadata` + StoredExtension to `extensions`
```

### Load Flow (loadExtension)
```
1. storage.get(id) → StoredExtension (throws "Extension not found" if missing)
2. decompressFile(content) → extractFoxeFileContent(ALLOWED_FILES.EXTENSION)
3. Return LoadedExtension { buffer?, raw }
```

### Namespace Isolation
- `"org"` extensions: managed by organization, auto-synced
- `"local"` extensions: user-installed, never auto-removed
- Each namespace gets its **own** IndexedDB database (suffix `-{namespace}`)

## DesktopExtensionLoader

`packages/suite-desktop/src/renderer/services/DesktopExtensionLoader.ts` \u2014 `namespace = "local"`,
`type = "filesystem"`. Reads installed extensions from the desktop file system (via the preload
bridge) rather than IndexedDB. Same `IExtensionLoader` contract.

## RemoteExtensionLoader

`packages/suite-base/src/services/extension/RemoteExtensionLoader.ts` \u2014 `type = "server"` (the
remote/org loader). The `type` value is **`"server"`, not `"remote"`** \u2014 the only valid `type`
values are `"browser"`, `"server"`, and `"filesystem"`.

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
  "main": "dist/index.js"
}
```

> The `package.json` carries metadata only. Contributions (panels, converters, aliases, camera
> models) are registered at runtime in `activate(ctx)` \u2014 see "Contribution Registration" below.

## Contribution Registration (Dynamic)

> ⚠️ Contributions are **not** declared statically in `package.json`. There is no
> `lichtblick.panels` / `messageConverters` contributions key. Instead the extension's bundled
> source is executed and registers contributions at runtime via the `activate(ctx)` callback.

`buildContributionPoints.ts`
(`packages/suite-base/src/providers/helpers/buildContributionPoints.ts`) executes the extension
source with `new Function("module", "require", source)`, then calls
`module.exports.activate(ctx)`. The `ExtensionContext` (`ctx`) exposes:

```typescript
const ctx: ExtensionContext = {
  mode,                          // "production" | "test" | "development"
  registerPanel(registration),   // panelId = `${qualifiedName}.${registration.name}`
  registerMessageConverter(args), // collects InstalledMessageConverter + panelSettings
  registerTopicAliases(aliasFn),  // note: registerTopicAliases (plural), not ...Function
  registerCameraModel({ name, modelBuilder }),
};
```

`buildContributionPoints` returns the accumulated
`{ panels, messageConverters, topicAliasFunctions, panelSettings, cameraModels }`.

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

Extensions run in a restricted context built by `buildContributionPoints.ts`:
- Source executed via `new Function("module", "require", source)` — `require` only resolves
  `react` and `react-dom`
- No direct DOM access (panels render via a React component)
- Limited to the `ExtensionContext` API surface:
  ```typescript
  interface ExtensionContext {
    mode: "production" | "test" | "development";
    registerPanel(registration: ExtensionPanelRegistration): void;
    registerMessageConverter<Src>(args: RegisterMessageConverterArgs<Src>): void;
    registerTopicAliases(aliasFunction: TopicAliasFunction): void;
    registerCameraModel(args: RegisterCameraModelArgs): void;
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
