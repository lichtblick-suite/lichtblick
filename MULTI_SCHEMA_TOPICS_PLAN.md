# Multi-schema topics: status quo and architectural plan

## Goal

Allow a topic's schema outputs to have independent visibility and schema-specific settings. Prioritize message converter outputs. Support MCAP channels with different native schemas under one topic name in a later step. Keep transport subscriptions by topic where possible; introduce output identity where a panel selects, configures, or renders a schema.

## Status quo on `main`

### Topic and message model

- The player topic model has one `name` and one `schemaName` (`packages/suite-base/src/players/types.ts`). The extension-facing `Topic` likewise has one primary `schemaName`, with optional `convertibleTo` names (`packages/suite/src/index.ts`). A `MessageEvent` already has its own topic and schema, so delivered messages can express a different schema from the primary topic.
- Panels subscribe by topic name, optionally with `convertTo`. The adapter advertises converter destinations in `Topic.convertibleTo`, matching converters to the primary schema. Converted outputs are not independent advertised topic entries (`PanelExtensionAdapter/renderState.ts`).
- Converter matching already uses incoming topic and schema, and converted events carry the destination schema (`PanelExtensionAdapter/messageProcessing.ts`). The message path has much of the required information; discovery and configuration lack a common output identity.

### Where topic-name identity takes over

- The settings merger gets one schema per topic from `getTopicToSchemaNameMap`, then calls that schema's settings provider with `config.topics[topicName]` (`PanelSettings/settingsTree.ts`, `MessagePipeline/selectors.ts`). The adapter's settings action handler uses the same lookup and topic-level config (`PanelExtensionAdapter/PanelExtensionAdapter.tsx`). A converter destination cannot independently own settings through this path.
- In 3D, `RendererConfig.topics` is keyed by topic name and contains both `visible` and rendering options (`ThreeDeeRender/IRenderer.ts`). Settings nodes, actions, subscription decisions, and renderable settings reads use that key (`Renderer.ts`, `ThreeDeeRender.tsx`, and renderables). Different schema outputs therefore consult the same visibility and options.
- 3D already registers handlers by schema and topic. Its subscription builder walks the primary schema and `convertibleTo`, requesting conversion with `convertTo` where applicable. But its default subscribe decision checks `config.topics[topic.name]?.visible`; enabling one schema output can enable another (`ThreeDeeRender.tsx`).
- The adapter builds a topic-to-one-schema map, tracks the last message by topic, and maintains an unconverted-subscription set by topic (`PanelExtensionAdapter/renderState.ts`). These assumptions warrant review for output-specific delivery, including current-frame and message-range paths.

### Data flow and uniqueness keys at each boundary

| Boundary | Current identity or lookup key | Information lost or merged |
| --- | --- | --- |
| MCAP channel to player | Channel ID identifies the channel for decoding; indexed topic discovery groups channels by topic name. Live sources have their own stream identity, then expose a topic name. | Indexed discovery retains only the first advertised schema for channels sharing a topic name, although decoding remains channel-specific. |
| Player to message pipeline | A message event carries topic name and schema name. Transport subscriptions primarily select by topic name. | Topic-only subscription intent cannot select one native schema variant; the event itself still carries its schema name. |
| 3D panel to panel adapter | A subscription specifies topic name and optionally a destination `convertTo` schema. On `main`, it cannot select an individual converter registration. | Two converters with the same destination cannot be requested independently. |
| Adapter to converter | Incoming topic name and schema name locate applicable conversions; `convertTo` selects the destination schema, after which the adapter chooses a matching registration. | Other matching registrations are not separately selected; advertised `convertibleTo` values contain schema names, not converter identities. |
| Adapter to 3D panel | The converted event retains the source topic name and carries the destination schema name. Its original event remains available through `originalMessageEvent`. | The event does not explicitly identify which converter registration produced it. |
| 3D panel to render handler | Schema name selects schema handlers; topic-specific handlers can also receive the event. | Handler selection can distinguish schemas, but not producers sharing a schema. |
| 3D panel to saved visibility and settings | Topic name indexes `config.topics[topicName]`. Distinct outputs collide at this boundary. | Visibility and settings for every output of that topic merge under one key; topic-to-schema settings lookup also selects only one schema per topic. |

For example, one source message on `/points` may be converted into multiple 3D-compatible schemas. The adapter can produce separate message events for those requested conversions, and 3D can dispatch them by destination schema. The saved 3D controls still converge on `/points`. Even changing the settings key to `(topic, destination schema)` would leave two distinct converter registrations with the same destination coupled; full control requires the producer identity described below.

### Native MCAP limitation

- The indexed MCAP source decodes channels individually but builds advertised topics in a map keyed by `channel.topic`. The first channel with a name supplies the advertised schema; later channels with that name add no topic entry (`players/IterablePlayer/Mcap/McapIndexedIterableSource.ts`). The unindexed source also builds discovery from channels and needs equivalent review (`McapUnindexedIterableSource.ts`).
- Events can retain channel-specific schema information while discovery, schema lookup, and subscriptions remain topic-oriented. Converter-only work should therefore avoid assuming that one advertised native schema is a universal truth. The MCAP step must expose all native variants, including schemas with the same name but different data.

### Current branch as reference

The feature branch introduces output descriptors and `topicOutputs` configuration across the adapter, extension API, 3D renderer, and many renderables. Its tests provide useful scenarios. Establish a shared identity and narrow renderer boundary first, then change individual renderables only where necessary.

## Target: one control set per producer

Give every native variant and converter registration independent visibility and settings, including producers with the same topic and effective schema. This matches how users configure converters: each registration defines a transformation and may expose settings specific to its output. Two registrations can declare the same `(fromSchema, toSchema)` pair yet produce different results. Sharing their controls would make one producer's setting or visibility change affect the other.

Represent an output by its source topic and source schema identity, plus native origin or a stable converter registration ID. The effective schema selects the renderer and settings provider; it is not a unique settings key. In step 1, source schema identity is the single advertised source schema, so a converted output key is **source topic + source schema + converter registration ID**. Step 2 extends source schema identity to distinguish native MCAP variants. Keep display labels and catalog order out of saved keys.

Carry the output identity through selection, message delivery, and configuration. An optional converter selector alongside `topic` and `convertTo` permits exact registration selection; existing subscriptions retain their current selection behavior. The player can still subscribe by topic. Resolve effective settings near the panel or renderer boundary instead of duplicating lookup rules across renderables.

Persist output settings separately from legacy `topics[topicName]`. Preserve single-output layouts and define a deterministic fallback when more outputs appear. Apply the same legacy visibility rule to both the settings UI and subscription logic.

### Desired data flow and identity at each boundary

| Boundary | Desired selection or uniqueness key | Information retained downstream |
| --- | --- | --- |
| MCAP channel or live source to player | Source channel or stream ID for decoding; stable native schema identity for distinct native variants | Topic name, source schema name and identity, decoded message; channel ID may remain transient metadata. |
| Player to message pipeline | Topic name for transport subscription; native variant identity where the source exposes several schemas under that name | Topic name, actual source schema identity, message, and source metadata needed for decoding and conversion. |
| 3D panel to panel adapter | Output selector: topic plus native variant, optionally plus a stable converter registration ID. Keep `convertTo` as the requested destination schema and add an optional converter selector for exact selection. | Requested producer identity and effective schema; legacy `{ topic, convertTo }` requests retain their current selection behavior. |
| Adapter to converter | Exact converter registration ID, checked against the incoming source schema identity | Source topic and schema, chosen converter ID, converter-specific config, destination schema, and original message. |
| Adapter to 3D panel | Stable output identity: source topic and native variant, plus converter registration ID for converted output | Output identity, effective schema name, converted or native message, and original message link where conversion occurred. |
| 3D panel to render handler | Effective schema name chooses the handler; output identity distinguishes state within a handler | Output-specific settings and visibility, source topic for labels and topic-wide behavior, and message data. |
| 3D panel to saved visibility and settings | Stable output identity, independent of display name and channel ordering | Separate configuration for each native variant and converter registration. |

This keeps topic-based player transport while carrying producer identity through the adapter and 3D control path.

## Step 1: Topic-to-multi-schema converters (priority)

This step assumes one native schema per topic, as advertised by the current player model. It can work with existing players without changing MCAP channel discovery.

1. **Discover and select converter outputs.** Derive one descriptor per converter registration alongside the native output. Keep `convertibleTo` usable for legacy consumers. Let output-aware panels request a specific registration while preserving existing `{ topic, convertTo }` behavior.
2. **Make core 3D controls output-specific.** Build a settings node per output, use its visibility to derive subscriptions, and persist its schema-specific settings independently. Supply each converter with its own config and let 3D resolve the corresponding settings for delivered messages.
3. **Preserve existing layouts.** Continue reading `topics[topicName]`, define the fallback when multiple outputs appear, and write output-specific entries when edited. Keep legacy extension panels and subscriptions working.
4. **Cover specialized 3D paths.** Audit image mode, annotations, calibration, preloading, and topic-specific handlers for places that still use topic name as output identity. Adapt the paths needed for the promised independent controls; keep unrelated behavior out of the first change.
5. **Verify behavior.** Check independent controls and delivery for distinct destination schemas, two converters to the same schema, and a converter to the native schema. Include current-frame and range delivery, persistence, legacy layouts, and desktop/web rendering.

This stage can land independently while native MCAP discovery still advertises one schema per topic name.

## Step 2: MCAP files with multi-schema topics

Extend the same descriptor, settings, and rendering model to multiple native variants of one topic name.

1. **Expose every native variant.** Update indexed and unindexed MCAP discovery and the message pipeline so channels with one topic name are not reduced to one advertised schema. Retain channel-specific decoding. Choose a durable identity for schemas with identical names but different data; channel IDs alone may change between files.
2. **Select variants after topic-level transport.** If player subscriptions remain topic-only, route or filter events by native output identity before panel dispatch. Revisit the adapter's topic-to-one-schema map, last-message cache, unconverted-subscription set, converter source selection, and range path. Run converters only for the matching native input variant.
3. **Reuse output settings and compatibility rules.** Step 1's settings nodes and persistence scheme should also serve native variants. Validate indexed and unindexed files, channel order, duplicate schema names, seeking, and reloads.

## Decisions before implementation

- Which output receives legacy `topics[topicName]` settings when several appear, particularly `visible`?
- What constitutes a stable converter registration ID across extension updates and reinstalls?
- For MCAP, which stable schema identity should saved settings follow when channel IDs or schema data change across files?

These choices affect keys and fallback behavior. They do not require MCAP discovery work to precede the converter step.
