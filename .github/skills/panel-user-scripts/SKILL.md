---
description: "Deep UserScripts panel knowledge: Monaco editor integration, UserScriptPlayer wrapper, TypeScript compilation in the transformer Worker, sandboxed runtime Worker execution, diagnostics, and the script API."
---

# Panel User Scripts Skill

The in-app TypeScript editor that lets users write custom message transformations.

## Architecture

```
UserScripts Panel (Monaco editor)
    │
    ▼
UserScriptPlayer (wraps the base Player)
    │
    ├── Transformer Worker (compiles + reports diagnostics)
    │   └── TypeScript compiler (in-Worker)
    │
    └── Runtime Worker (sandboxed script execution)
        └── user code runs here (isolated)
```

## Core Components

| File | Role |
|------|------|
| `panels/UserScriptEditor/` | Monaco editor UI, diagnostics display |
| `players/UserScriptPlayer/index.ts` | Player wrapper, Worker pool management |
| `players/UserScriptPlayer/transformerWorker/` | TypeScript compilation in a Worker |
| `players/UserScriptPlayer/runtimeWorker/` | Sandboxed script execution |

## Script Lifecycle

1. User writes TypeScript in Monaco
2. On save: code is sent to the Transformer Worker for compilation
3. Transformer compiles TS → JS and reports diagnostics (errors/warnings)
4. On success: the JS bundle is sent to the Runtime Worker
5. During playback: messages on input topics → Runtime Worker → output messages
6. Output messages are injected into `PlayerState` as additional topics

## Worker Naming Pattern

```typescript
// unique name per instance — isolates workers per tab (no cross-tab sharing)
new SharedWorker(new URL("./transformerWorker/index", import.meta.url), {
  name: uuidv4(),
});
```

- `SharedWorker` is the worker type, but cross-tab instance reuse is **disabled** by unique naming.
- Within a single player lifetime, runtime workers are reused/pooled where possible.
- Each active script processor maps to an isolated runtime execution context.

## Monaco Integration

- Full TypeScript language service (autocomplete, errors, hover)
- Custom Lichtblick script-API type definitions injected
- Diagnostics shown inline and in a panel below the editor

## Script API

```typescript
export const inputs = ["/camera/image"];
export const output = "/processed_image";

export default function transform(event: MessageEvent): OutputMessage {
  return {
    /* processed data */
  };
}
```

## Performance Notes

- Script execution never blocks the main thread (Worker isolation)
- Unchanged scripts don't recompile (compilation caching)
- Only subscribed input topics are forwarded to the Worker
- Runtime errors in user code are contained — they don't crash the app
- Each Runtime Worker has its own heap (no cross-script interference)

## Key Files
- `packages/suite-base/src/panels/UserScriptEditor/`
- `packages/suite-base/src/players/UserScriptPlayer/index.ts`
- `packages/suite-base/src/players/UserScriptPlayer/transformerWorker/`
- `packages/suite-base/src/players/UserScriptPlayer/runtimeWorker/`

## Skills Reference
- For SharedWorker patterns: load `web-workers` skill
