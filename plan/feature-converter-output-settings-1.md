---
goal: Independent settings and rendering state for original and converted topic outputs
version: 1
date_created: 2026-10-08
last_updated: 2026-10-08
owner: Lichtblick maintainers
status: Implemented; interactive validation pending
tags: [feature, converters, settings, compatibility]
---

# Introduction

![Status: Implemented](https://img.shields.io/badge/status-Implemented-green)

Give each original topic output and each registered converter output separate settings, saved configuration, and rendering state. Preserve MCAP and stream ingestion and existing extension registrations. Implement shared infrastructure and integrate the 3D panel and its Image mode first; other panels retain existing behavior until explicitly integrated.

Current implementation retains registration objects in `ExtensionCatalog.installedMessageConverters`. It merges converter settings by panel type and `fromSchemaName` in `buildContributionPoints()`. `buildSettingsTree()` selects one schema per topic; `useConfigById()` merges defaults into `config.topics[topic]`. `convertMessage()` preserves the source topic and copies its `topicConfig`, without identifying the producing converter. The 3D renderer also has topic-keyed renderables. Splitting only the sidebar cannot deliver independent output behavior.

## 1. Requirements & Constraints

- **REQ-001**: Define an output as an original message stream or a converter registration applied to a source topic. Individual returned messages/entities are not separate outputs.
- **REQ-002**: Use `(topic, sourceSchemaName, converterId)` for converted-output identity. Use `(topic, sourceSchemaName, original)` for original-output identity. Include the source schema so duplicate topic names with distinct schemas do not collide where the player exposes those schemas.
- **REQ-003**: Preserve `MessageEvent.topic` as the real source topic. Do not create synthetic player topics or modify MCAP/network protocols.
- **REQ-004**: Separate defaults, edits, visibility, renderable/entity state, and converter-provided settings for every output. Identical source and destination schemas must not cause output settings to merge.
- **REQ-005**: In output-aware panels, show topic groups with an Original data section and one section per applicable converter output. Show sections from metadata before receiving messages. Only show outputs supported by that panel's schema subscriptions.
- **REQ-006**: Allow explicit converter selection when multiple converters have identical source/destination schemas. Keep existing converter preference rules for subscriptions without explicit selection.
- **REQ-007**: Existing extensions without new fields must continue to register and convert. Original messages without output metadata remain valid.
- **REQ-008**: Preserve existing saved layouts. Original data continues using legacy topic settings. Converted outputs without saved overrides inherit legacy settings; editing one output must not edit siblings or the legacy topic record.
- **REQ-009**: Apply identical identity and configuration routing to live frames, preloaded frames, range iteration, and seek processing.
- **CON-001**: This document is the only change authorized by the planning request. Implementation tasks below require a subsequent implementation request.
- **CON-002**: Do not refactor unrelated ingestion, decoding, transform semantics, panels, or extension repositories. Do not run broad reverts. Record changed files per implementation task.
- **CON-003**: No new runtime converter instances are necessary. Persist stable registration identity, never JavaScript object identity or a random session ID.
- **PAT-001**: Serialize identities as JSON tuples through one helper; do not concatenate unrestricted names with ambiguous delimiters.

### Data contract

Add optional registration fields `id?: string` and `displayName?: string` to `RegisterMessageConverterArgs`. Derive installed `converterId` from JSON encoding `[extension.qualifiedName, registration.id ?? [fromSchemaName, toSchemaName]]`. Require explicit IDs to distinguish multiple registrations of the same pair within one extension. Reject duplicate derived IDs within that extension with a diagnostic rather than merging settings.

Add an optional `output` field to `MessageEvent` with discriminated variants `{ kind: "original", sourceSchemaName: string }` and `{ kind: "converted", sourceSchemaName: string, converterId: string }`. Missing metadata means original data with `messageEvent.schemaName`. The output key is `JSON.stringify([topic, sourceSchemaName, kind, converterId ?? ""])`.

Add optional `converterId` to conversion subscriptions, including range subscriptions. An explicit ID must match the topic source schema and requested destination schema; a missing/unavailable match produces no converted output and must never silently select another converter.

Store independent full output overrides in `config.topicOutputs[topic][outputKey]`. Resolve effective settings by deep-merging a fresh object in this order: panel defaults, that converter's `defaultConfig`, legacy `config.topics[topic]`, saved output override. Preserve existing merge behavior for arrays. On first edit of a converted output, save a deep copy of its effective settings before applying the edit, preventing subsequent legacy changes from unintentionally changing its settings. Original-output edits retain the legacy path unless distinct original schemas on one topic require an output override.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Establish stable identities and a registry that cannot merge distinct converters. No phase dependencies. Tasks are sequential in table order.
- Completion: Two same-schema converters with different explicit IDs retain distinct settings and keep their IDs across extension reloads.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `packages/suite/src/index.ts`, add and document the optional registration, event, and subscription fields defined above. Document identity stability and the interpretation of missing event metadata. Update `PanelSettings` documentation to distinguish new output paths from legacy topic paths. | Yes | 2026-10-08 |
| TASK-002 | In `packages/suite-base/src/types/messageConverters.ts`, add required installed `converterId`. Create `packages/suite-base/src/util/topicOutput.ts` containing output-key generation, original-event normalization, output descriptors, and effective-config resolution. Keep actual topic and schema strings intact. | Yes | 2026-10-08 |
| TASK-003 | In `packages/suite-base/src/providers/helpers/buildContributionPoints.ts`, assign stable IDs in `registerMessageConverter()`, validate duplicates, and retain converter-specific panel settings on their registration. Add a converter-ID settings index alongside the legacy schema index; do not remove legacy consumers yet. Update `context/ExtensionCatalogContext.ts`, `components/PanelSettings/types.ts`, and `providers/ExtensionCatalogProvider/ExtensionCatalogProvider.tsx`, including mock registration and uninstall/reload paths. | Yes | 2026-10-08 |

### Implementation Phase 2

- **GOAL-002**: Route each output through the selected converter with its own configuration. Depends on Phase 1. Tasks are sequential in table order.
- Completion: Original messages and two converted outputs on the same topic retain distinct identities and configs in every delivery path.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | In `components/PanelExtensionAdapter/messageProcessing.ts`, update `collateTopicSchemaConversions()` to match explicit converter IDs, enumerate matching topic/schema entries instead of selecting only the first topic name, and deduplicate by converter identity. Preserve namespace preference for legacy subscriptions. Include identity in `mapDifference()` comparisons where reference equality would retrigger an unchanged registration after reload. | Yes | 2026-10-08 |
| TASK-005 | In `convertMessage()`, obtain the selected output's effective configuration and pass it in the input event's `topicConfig` before invoking the converter. Attach the converted `output` descriptor and effective config to the returned event. Keep `originalMessageEvent` referencing original data/config. Do not mutate the source event. | Yes | 2026-10-08 |
| TASK-006 | Update `components/PanelExtensionAdapter/renderState.ts`, `PanelExtensionAdapter.tsx`, `messageRangeIterator.ts`, `useSubscribeMessageRange.ts`, and `types.ts` to carry config and converter identity through all frame/range conversion paths. Extend cache invalidation to output config changes and explicit converter selection. Original subscriptions must still receive unconverted data. | Yes | 2026-10-08 |

### Implementation Phase 3

- **GOAL-003**: Build and persist separate settings sections. Depends on Phase 2. Tasks are sequential in table order.
- Completion: Editing a converter section changes only its saved output configuration and invokes only its settings handler.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | In `PanelAPI/useConfigById.ts`, expose output-aware effective settings while preserving legacy defaults for panels that have not opted in. Resolve converter defaults by converter ID; never combine defaults from unrelated registrations. Add an opt-in output descriptor list to the settings tree contract in `packages/suite/src/index.ts` and preserve it through `context/PanelStateContext.ts`. | Yes | 2026-10-08 |
| TASK-008 | In `components/PanelSettings/settingsTree.ts`, support output-aware nodes at `["topics", topic, "outputs", outputKey]`. Use descriptors to select the converter-specific `settings()` callback, pass only that output's effective config, and merge into only that output node. Keep the legacy branch for panels without descriptors. Update `index.tsx` memo dependencies and any required translated labels in `i18n/en/panelSettings.ts` with existing translation fallback conventions. | Yes | 2026-10-08 |
| TASK-009 | In `PanelExtensionAdapter.tsx`, update `extensionSettingsActionHandler()` to parse output paths, resolve the exact converter's handler, and save only its override. For legacy handlers, pass a copy of the action with `["topics", topic, ...fieldPath]` while supplying the isolated config object; retain the new path for persistence. Preserve native panel-handler ordering. Apply no converter handler to Original data sections. | Yes | 2026-10-08 |
| TASK-010 | Implement lazy layout compatibility in `util/topicOutput.ts` and `PanelAPI/useConfigById.ts`: opening a layout performs no persistence writes; first output edit materializes an independent effective config snapshot. Retain overrides for unavailable converters so reinstall restores them. Do not remap missing explicit IDs to another converter. | Yes | 2026-10-08 |

### Implementation Phase 4

- **GOAL-004**: Make rendering state follow output identity in 3D and Image mode. Depends on Phase 3. Tasks are sequential in table order.
- Completion: Original and converted same-schema scene messages can display independently without overwriting entity state, and each visibility toggle affects only its output.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | In `panels/ThreeDeeRender/ThreeDeeRender.tsx`, build subscriptions per visible supported output, include explicit converter IDs, and include those IDs in subscription equality checks. Deduplicate shared source reads without deduplicating different converter outputs. Supply output descriptors to the settings tree. Preserve direct subscriptions for transforms and other panel-wide data. | Yes | 2026-10-08 |
| TASK-012 | Extend `panels/ThreeDeeRender/types.ts`, `Renderer.ts`, `IRenderer.ts`, `SettingsManager.ts`, and `SceneExtension.ts` with helpers for output config, settings paths, and runtime keys. Keep real topic strings for transport subscriptions and user-facing labels. Update `Renderer.addMessageEvent()`, output nodes, settings updates, picking, error attribution, seek clearing, and disposal to distinguish outputs. | Yes | 2026-10-08 |
| TASK-013 | Update topic-keyed rendering state and settings access in `panels/ThreeDeeRender/renderables/SceneEntities.ts`, `PointClouds.ts`, `Images.ts`, and the other scene extensions under `renderables/` that consume convertible schemas. Use output keys for storage and entity namespaces; entity deletion in output A cannot delete entities in output B. Include `SceneExtension.startFrame()` grouping and retention behavior. Audit every `renderables.get/set`, `config.topics`, and topic settings path in this directory; convert output-consuming sites only, and record the exact touched files. | Yes | 2026-10-08 |
| TASK-014 | Update `renderables/ImageMode/ImageMode.ts`, `MessageHandler.ts`, and `annotations/ImageAnnotations.ts` to carry selected output identities for images and annotations. Preserve real camera/frame relationships. Separate annotation state for same-topic converter outputs and expose corresponding settings nodes. | Yes | 2026-10-08 |

### Implementation Phase 5

- **GOAL-005**: Verify compatibility and independent behavior. Depends on Phase 4. Test-writing tasks may run independently; final validation follows all tests.
- Completion: Targeted tests and type checks pass, and both web and desktop show independent outputs using original MCAP/stream messages.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add the scenarios in Section 6 to the listed colocated test suites. Add synthetic fixtures; do not modify the untracked ASAM extension/decoder directories. | Yes | 2026-10-08 |
| TASK-016 | Run `yarn test --runInBand --runTestsByPath` with the modified/new test file paths, then `yarn run tsc --noEmit`. Run `yarn exec eslint` and `yarn exec biome format` in check mode on changed source files only. Fix only failures introduced by this feature; report unrelated failures. | Yes | 2026-10-08 |
| TASK-017 | Validate in web and desktop: load original MCAP data, display original and two converter outputs, change each output's visibility and settings, seek, save/reopen the layout, and reload the extension. Repeat with a live stream. Verify a legacy layout and extension without IDs. Record results and exact changed files. | Pending interactive validation | |

## 3. Alternatives

- **ALT-001**: Index settings by source/destination schema only. Rejected because different converters producing the same schema still collide.
- **ALT-002**: Rename converted messages to synthetic player topics. Rejected because this changes topic semantics, transport subscriptions, picking labels, and original-message references unnecessarily.
- **ALT-003**: Instantiate one converter object per topic. Rejected because registration identity and separate config/state solve the requirement without a new lifecycle API.
- **ALT-004**: Split settings nodes without changing renderer state. Rejected because same-topic entities and visibility would still interfere.
- **ALT-005**: Upgrade every panel in the initial implementation. Deferred; output-aware settings are opt-in, and this plan integrates the existing 3D/Image rendering path.

## 4. Dependencies

- **DEP-001**: Existing extension catalog, message conversion adapter, panel configuration persistence, and 3D scene extension infrastructure. No new package dependency is required.
- **DEP-002**: A data source must expose all source schemas in topic metadata to offer all outputs before messages arrive. This plan removes first/last-entry loss in the output-aware path but does not repair players that already discard schema information.
- **DEP-003**: Installed dependency tooling uses Yarn as specified in the repository; use the package manager version declared in `package.json`.
- **DEP-004**: Phase dependencies are 1 → 2 → 3 → 4 → 5. Do not expose the new UI before routing and renderable isolation are complete.

## 5. Files

- **FILE-001**: `packages/suite/src/index.ts` — public registration, event, subscription, and settings descriptors.
- **FILE-002**: `packages/suite-base/src/types/messageConverters.ts`; new `util/topicOutput.ts` and `util/topicOutput.test.ts` — stable identity and config helpers.
- **FILE-003**: `packages/suite-base/src/providers/helpers/buildContributionPoints.ts` and `.test.ts`; `providers/ExtensionCatalogProvider/ExtensionCatalogProvider.tsx` and `.test.tsx`; `context/ExtensionCatalogContext.ts` — catalog registration and lifecycle.
- **FILE-004**: `packages/suite-base/src/components/PanelExtensionAdapter/{messageProcessing.ts,renderState.ts,PanelExtensionAdapter.tsx,messageRangeIterator.ts,useSubscribeMessageRange.ts,types.ts}` and associated tests — selection and delivery.
- **FILE-005**: `packages/suite-base/src/PanelAPI/useConfigById.ts` and `.test.ts`; `components/PanelSettings/{settingsTree.ts,settingsTree.test.ts,index.tsx,types.ts}`; `context/PanelStateContext.ts`; `i18n/en/panelSettings.ts` — settings lookup and storage.
- **FILE-006**: `packages/suite-base/src/panels/ThreeDeeRender/{ThreeDeeRender.tsx,Renderer.ts,Renderer.test.ts,IRenderer.ts,types.ts,SettingsManager.ts,SceneExtension.ts}` and output-consuming files under `renderables/` — independent rendering state. TASK-013 requires an exact implementation change list.
- **FILE-007**: `plan/feature-converter-output-settings-1.md` — this plan; update task completion and validation evidence during authorized implementation.

## 6. Testing

- **TEST-001**: Identity helpers: delimiter-containing topic/schema/ID strings, original-versus-converted separation, reload stability, and duplicate registration diagnostics.
- **TEST-002**: Registration/provider suites: same source and destination schemas with distinct explicit IDs retain different callbacks/defaults; uninstall removes only the affected registry entries; reinstallation restores stable IDs.
- **TEST-003**: `messageProcessing`/`renderState` suites: original plus two same-schema converter outputs; exact ID selection; legacy preference; missing ID; duplicate topic names with distinct source schemas; isolated converter input config; null output; conversion exception; config-only cache invalidation.
- **TEST-004**: `messageRangeIterator` suite: identity/config parity with live delivery, preload, seek, and range paths.
- **TEST-005**: Settings tree and adapter suites: callback and handler target one output, legacy action-path translation, Original data receives no converter callback, unsupported outputs are excluded, and zero-message metadata still builds sections.
- **TEST-006**: `useConfigById`/helper suites: default precedence, no shared nested references, first-edit snapshot, no persistence on read, layout round trip, missing converter retention, and unchanged legacy panel behavior.
- **TEST-007**: Renderer/scene tests: equal entity IDs in two outputs coexist; visibility/color/retention differ; deletion/seek/disposal/picking/errors remain output-specific. Verify original messages lacking metadata.
- **TEST-008**: Image mode tests: independent annotation outputs, image output selection, and unchanged camera calibration/frame handling.
- **TEST-009**: Web/desktop acceptance: original MCAP and stream data, legacy layouts/extensions, save/reopen, converter reload, same-output-schema converters, and raw original subscriptions.

## 7. Risks & Assumptions

- **RISK-001**: Renderer topic assumptions are distributed across scene extensions. TASK-013's audit is required; estimates based solely on settings files would understate the change.
- **RISK-002**: Legacy schema-merged settings cannot reveal which converter originally owned a value. Inherit the legacy value for each converted output until independently edited; do not guess ownership.
- **RISK-003**: Converter IDs must remain stable across releases. Changing an explicit registration ID intentionally creates a new output; retain orphaned saved settings.
- **RISK-004**: Some handlers may inspect action paths or external state. Translate legacy paths and test representative existing handlers; do not promise isolation for state stored internally by extension code.
- **RISK-005**: Two raw channels with the same topic and identical schema cannot be distinguished by the existing event metadata. Channel-instance-specific settings require a separate player/API change and are outside this plan.
- **RISK-006**: Same-schema outputs may carry contradictory transforms. Output identity separates visual state, but global transform-tree arbitration is unchanged and must be documented in validation.
- **ASSUMPTION-001**: “Converter instance” means a stable converter registration applied to a topic/source schema, not one new converter instance per event or per returned entity.
- **ASSUMPTION-002**: Initial native panel coverage is 3D and Image mode. Shared metadata enables future panel integrations without silently changing existing panels.
- **ASSUMPTION-003**: The work is a substantial cross-cutting feature, best reviewed in the five dependent phases above; no implementation or calendar estimate is implied by this plan.

### Implementation evidence (2026-10-08)

- Follow-up UI request: removed the intermediate “Outputs” dropdown. Original data and converter sections appear directly under their topic; settings action/error paths now use `["topics", topic, outputKey]`. This supersedes TASK-008's original grouping path. Saved output config keys remain unchanged. Validation: all 139 tests in four targeted suites passed, along with package type checking, scoped lint, and formatting.
- Validation: 13 focused suites passed (292 tests): 12 suites/255 tests in the focused run and 37 catalog lifecycle tests in a separate run. Coverage includes identity/config helpers, exact converter selection, frame/range delivery, settings callbacks, legacy config, registration/lifecycle, scene isolation, and Image annotations. `corepack yarn exec tsc --noEmit -p packages/suite-base/tsconfig.json` passed. ESLint and Biome format check passed on all 52 changed/new source files; `git diff --check` passed. An initial command included a nonexistent `SettingsManager.test.ts`; the corrected run passed. Catalog registration assertions were updated for additive identity fields, and the catalog rerun passed.
- TASK-001 through TASK-016 are implemented. TASK-017 remains pending: interactive web/desktop checks with MCAP and a live stream were not performed. The web E2E server command uses POSIX environment assignment on this Windows workspace, and desktop validation requires a built application. Automated tests exercise the shared delivery, saved config, reload identity, and renderer paths.
- Real registrations always receive a stable ID. The installed type keeps that field optional for backward-compatible in-process fixtures; the shared helper derives a deterministic fallback.
- Converter-specific settings are looked up through retained `installedMessageConverters`, rather than maintaining a second mutable index. Existing catalog install/uninstall lifecycle remains sufficient. `PanelStateContext` already preserves the extended immutable settings tree, and renderer config lives in `IRenderer.ts`; neither needs a duplicate declaration.
- Converter object reference comparisons remain in conversion-map change detection so reloaded callbacks are replayed even when stable IDs are unchanged. Existing topic-level all-frames preload behavior is preserved.
- Saved output overrides are full independent snapshots. Once present, legacy topic config is no longer merged into that output; converter and native panel defaults still supply newly introduced fields.
- Initial native coverage is 3D and Image mode. Other panels retain legacy behavior. Global transform arbitration and channel identity for identical topic/schema channels remain unchanged.

Exact implementation files (excluding this plan):

- `packages/suite-base/src/PanelAPI/useConfigById.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/PanelExtensionAdapter.test.tsx`
- `packages/suite-base/src/components/PanelExtensionAdapter/PanelExtensionAdapter.tsx`
- `packages/suite-base/src/components/PanelExtensionAdapter/messageProcessing.test.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/messageProcessing.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/messageRangeIterator.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/renderState.test.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/renderState.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/topicOutputs.test.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/types.ts`
- `packages/suite-base/src/components/PanelExtensionAdapter/useSubscribeMessageRange.ts`
- `packages/suite-base/src/components/PanelSettings/index.tsx`
- `packages/suite-base/src/components/PanelSettings/settingsTree.ts`
- `packages/suite-base/src/components/PanelSettings/types.ts`
- `packages/suite-base/src/context/ExtensionCatalogContext.ts`
- `packages/suite-base/src/i18n/en/panelSettings.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/IRenderer.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/LayerErrors.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/Renderable.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/Renderer.test.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/Renderer.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/SceneExtension.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/SettingsManager.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/ThreeDeeRender.tsx`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Cameras.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/FoxgloveGrid.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/ImageMode/ImageMode.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/ImageMode/MessageHandler.test.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/ImageMode/MessageHandler.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/ImageMode/annotations/ImageAnnotations.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Images.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Images/filterCompressedVideoQueue.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/LaserScans.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Markers.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/OccupancyGrids.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/PointClouds.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Polygons.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/PoseArrays.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Poses.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/SceneEntities.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/TopicEntities.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/TopicMarkers.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Urdfs.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/VelodyneScans.ts`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/markers/RenderableMarker.ts`
- `packages/suite-base/src/providers/helpers/buildContributionPoints.test.ts`
- `packages/suite-base/src/providers/ExtensionCatalogProvider/ExtensionCatalogProvider.test.tsx`
- `packages/suite-base/src/providers/helpers/buildContributionPoints.ts`
- `packages/suite-base/src/types/messageConverters.ts`
- `packages/suite-base/src/util/topicOutput.test.ts`
- `packages/suite-base/src/util/topicOutput.ts`
- `packages/suite/src/index.ts`

## 8. Related Specifications / Further Reading

- [Repository agent instructions](../AGENTS.md)
- [Extension API and existing converter contract](../packages/suite/src/index.ts)
- [Converter registration and current settings merge](../packages/suite-base/src/providers/helpers/buildContributionPoints.ts)
- [Current converter selection and message creation](../packages/suite-base/src/components/PanelExtensionAdapter/messageProcessing.ts)
- [Current topic/schema settings lookup](../packages/suite-base/src/components/PanelSettings/settingsTree.ts)
- [Current default configuration merge](../packages/suite-base/src/PanelAPI/useConfigById.ts)
- [3D scene extension lifecycle and topic-keyed state](../packages/suite-base/src/panels/ThreeDeeRender/SceneExtension.ts)
