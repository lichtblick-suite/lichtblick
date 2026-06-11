# AI Agent System

This document describes the AI agent architecture used in the Lichtblick monorepo to assist with development tasks via GitHub Copilot.

## Structure Overview

```
.github/
├── agents/          # Domain-specific agent definitions (.agent.md)
├── skills/          # Deep-dive knowledge modules (SKILL.md)
└── instructions/    # Auto-applied coding conventions (.instructions.md)
```

### How It Works

- **Agents** are invoked by name (e.g., `@player`) to handle tasks in a specific domain. Each agent has a description, allowed tools, and domain knowledge embedded in its markdown body.
- **Skills** are loaded on-demand by agents when they need deeper implementation knowledge. An agent's body references skills by name (e.g., "load `player-internals` skill").
- **Instructions** are applied automatically to every file matching their `applyTo` glob pattern. They enforce coding conventions without explicit invocation.

---

## Agents (23)

Located in `.github/agents/`. Each file uses YAML frontmatter with `description` and `tools` fields.

### Orchestrator

| Agent          | Description                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestrator` | Top-level orchestrator that routes tasks to specialized sub-agents based on domain expertise. Use when unsure which specialist to invoke, or for tasks spanning multiple subsystems. |

### Platform

| Agent     | Description                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop` | Desktop/Electron platform specialist covering the main process, preload scripts, IPC communication, BrowserWindow management, native menus, and file system access.                                       |
| `web`     | Web platform specialist covering the browser-based Lichtblick build: webpack configuration, COOP/COEP headers, browser compatibility, SharedArrayBuffer requirements, and web-specific data source setup. |

### Core Infrastructure

| Agent              | Description                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `player`           | Player layer specialist covering IterablePlayer state machine, FoxgloveWebSocketPlayer, UserScriptPlayer, and data source lifecycle.         |
| `message-pipeline` | MessagePipeline specialist covering the React context, zustand store, subscription management, and render state building.                    |
| `preload`          | Preloading and caching specialist covering BlockLoader, CachingIterableSource, BufferedIterableSource, and `unstable_subscribeMessageRange`. |
| `deserialization`  | Deserialization specialist covering schema parsing, message decoding, protobuf/flatbuffer/ROS/JSON schemas, and WASM-based decoders.         |
| `extensions`       | Extension system specialist covering extension loading, registration, the extension API, contribution points, and the .foxe file format.     |
| `layouts`          | Layout system specialist covering layout storage, sync, conflict resolution, permissions, and the CurrentLayoutProvider state machine.       |

### Connections

| Agent                  | Description                                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `remote-connection`    | Remote file connection specialist covering HTTP range requests, MCAP remote reading, CachedFilelike caching, MultiIterableSource multi-file orchestration, and file-based data source loading. |
| `websocket-connection` | WebSocket connection specialist covering FoxgloveWebSocketPlayer, WorkerSocketAdapter, and the Foxglove WebSocket protocol.                                                                    |

### Panels

| Agent                     | Description                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panels-general`          | General panel infrastructure specialist covering PanelExtensionAdapter, renderState building, panel lifecycle, pauseFrame, and the extension API contract.                          |
| `panel-3d`                | 3D panel specialist covering THREE.js rendering, SceneExtensions, TransformTree, point clouds, GPU buffer management, camera handling, picking, and the ImageMode.                  |
| `panel-image`             | Image panel specialist covering camera image visualization within the 3D rendering context (ImageMode).                                                                             |
| `panel-plot`              | Plot panel specialist covering PlotCoordinator, TimestampDatasetsBuilder, Chart.js Worker rendering, OffscreenCanvas, and time-series data extraction.                              |
| `panel-log`               | Log panel specialist covering virtualized log display, react-window VariableSizeList, dynamic row heights, autoscroll behavior, and log level filtering.                            |
| `panel-map`               | Map panel specialist covering Leaflet integration, GeoJSON rendering, NavSatFix message handling, and the FilteredPointLayer pixel-deduplication system.                            |
| `panel-raw-messages`      | RawMessages panel specialist covering JSON message tree display, virtualized tree rendering with @tanstack/react-virtual, message inspection, diff mode, and field path navigation. |
| `panel-state-transitions` | StateTransitions panel specialist covering discrete state visualization using TimeBasedChart, message-path extraction, and preloaded data range subscriptions.                      |
| `panel-user-scripts`      | UserScripts panel specialist covering the Monaco editor integration, TypeScript compilation, script execution in SharedWorkers, diagnostics, and the user script API.               |

### Development

| Agent          | Description                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend-dev` | General React and TypeScript development specialist for the Lichtblick monorepo. Use for component creation, hooks, state management, styling with tss-react/MUI, and code patterns. |
| `unit-test`    | Unit test creation and maintenance specialist. Use for writing new tests, fixing broken tests, improving coverage, and understanding mocking patterns.                               |
| `theme`        | Theme system specialist covering the MUI theme configuration, palette definitions, typography, and the dark/light color scheme implementation.                                       |

---

## Skills (13)

Located in `.github/skills/<name>/SKILL.md`. Each file uses YAML frontmatter with a `description` field. Skills provide deep implementation knowledge that agents load on demand.

| Skill                  | Description                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `3d-rendering`         | Deep THREE.js rendering knowledge: WebGL pipeline, buffer management, instanced rendering, shader considerations, and scene optimization techniques.                                    |
| `caching-internals`    | Caching strategies, memory budgets, block eviction, and buffered reading in the preloading subsystem.                                                                                   |
| `electron-internals`   | Electron implementation: main/renderer process communication, contextBridge patterns, BrowserWindow lifecycle, native menu integration, and security.                                   |
| `extensions-internals` | Extension system internals: IExtensionLoader contracts, IndexedDB storage schema, version-compare cache strategy, contribution point registration, extension sandbox, and .foxe format. |
| `layouts-internals`    | Layout system internals: ILayoutStorage contracts, IndexedDB schema, sync operation computation, mutex-locked LayoutManager, conflict resolution, exponential backoff.                  |
| `mcap-format`          | MCAP file format specification: binary structure, record types, indexing strategies, compression options, and best practices for optimizing Lichtblick reading performance.             |
| `message-path`         | Message-path package: path syntax, parsing grammar, data extraction from nested messages, and React hook integration.                                                                   |
| `performance`          | Performance optimization: profiling techniques, common bottlenecks, memory management patterns, and strategies for real-time data visualization.                                        |
| `player-internals`     | IterablePlayer state machine internals, tick loop, and data source iteration patterns.                                                                                                  |
| `plot-internals`       | Chart.js integration for the Plot panel: Worker-based rendering, dataset management, downsampling strategies, scale handling, and interaction patterns.                                 |
| `remote-caching`       | HTTP-layer caching for remote file access: CachedFilelike, VirtualLRUBuffer, connection management algorithm, BrowserHttpReader, FetchReader streaming, and RequestQueue concurrency.   |
| `unit-testing`         | Unit testing patterns, mock builder usage, and test data construction strategies.                                                                                                       |
| `web-workers`          | Web Worker patterns: Comlink integration, ComlinkWrap lifecycle, transfer handlers, OffscreenCanvas, SharedWorker isolation, and testing utilities.                                     |

### Agent → Skill Relationships

```mermaid
graph LR
    panel-3d --> 3d-rendering
    panel-3d --> web-workers
    panel-plot --> plot-internals
    panel-plot --> web-workers
    player --> player-internals
    player --> mcap-format
    player --> web-workers
    player --> caching-internals
    preload --> caching-internals
    preload --> player-internals
    remote-connection --> remote-caching
    remote-connection --> mcap-format
    remote-connection --> web-workers
    remote-connection --> caching-internals
    websocket-connection --> web-workers
    desktop --> electron-internals
    extensions --> extensions-internals
    layouts --> layouts-internals
    frontend-dev --> performance
    unit-test --> unit-testing
    panels-general --> message-path
    panel-raw-messages --> message-path
    panel-state-transitions --> message-path
```

---

## Instructions (2)

Located in `.github/instructions/`. Each file uses YAML frontmatter with an `applyTo` glob pattern. Rules are automatically applied to every file matching the pattern.

| Instruction    | Pattern            | Purpose                                                                                                                                                                                                         |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contributing` | `**/*.ts,**/*.tsx` | Enforces CONTRIBUTING.md conventions: component structure, TypeScript rules (strict, `undefined` > `null`, `ReactNull`), styling (`tss-react` only), GWT testing pattern, i18n guidelines, and license headers. |
| `performance`  | `**/*.ts,**/*.tsx` | Enforces performance best practices: allocation rules, React memoization, render-path optimization, and memory management patterns.                                                                             |

---

## Adding New Agents, Skills, or Instructions

### New Agent

Create `.github/agents/<name>.agent.md`:

```markdown
---
description: "Brief description of the agent's domain and when to use it."
tools: ["read", "edit", "search", "execute"]
---

# Agent Name

You are an expert on ...

## Key Files

- `packages/suite-base/src/...`

## Skills Reference

- For deep X internals: load `x-internals` skill
```

### New Skill

Create `.github/skills/<name>/SKILL.md`:

```markdown
---
description: "Brief description of the deep knowledge this skill provides."
---

# Skill Name

## Implementation Details

...
```

### New Instruction

Create `.github/instructions/<name>.instructions.md`:

```markdown
---
applyTo: "**/*.ts,**/*.tsx"
---

# Rules

- Rule 1
- Rule 2
```
