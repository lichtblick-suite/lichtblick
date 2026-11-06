# @lichtblick/suite-base &nbsp;

[![npm version](https://img.shields.io/npm/v/%40lichtblick%2Fsuite)](https://www.npmjs.com/package/@lichtblick/suite)
![GitHub License](https://img.shields.io/github/license/lichtblick-suite/lichtblick)

This package contains core components used in [Lichtblick](https://github.com/foxglove/suite).

## Quick start

When contributing to the [Lichtblick](https://github.com/lichtblick-suite/lichtblick) codebase, you can import from `@lichtblick/suite-base` at its top-level or from lower in its directory:

```plain
import { ExtensionInfo, ExtensionLoaderContext, IExtensionLoader } from "@lichtblick/suite-base";
import fuzzyFilter from "@lichtblick/suite-base/util/fuzzyFilter";
```

For a full list of the package's exports, reference its [`index.ts` file](https://github.com/lichtblick-suite/lichtblick/suite/blob/main/packages/suite-base/src/index.ts).

## Telemetry

`@lichtblick/suite-base` includes an OpenTelemetry-backed implementation of the app's
`IAnalytics` abstraction (see [`services/telemetry/`](src/services/telemetry)), wired in via
[`AnalyticsProvider`](src/providers/AnalyticsProvider.tsx), and a generic
[`useInteractionCapture`](src/hooks/useInteractionCapture.ts) hook for wiring new UI click
sources into it without hand-writing a `logEvent()` call at every handler. See the root
repository README's Telemetry section for the user-facing opt-in model and privacy details.

## Channel-based message access

Extension panels can watch `RenderState.channels` to discover native streams and virtual
message-converter outputs. Subscribe with `{ topic: channel.topic, channelId: channel.id }`
to select exactly that stream. The same selector works with `unstable_subscribeMessageRange`.
Converted events carry the virtual channel ID and retain their input in `originalMessageEvent`.
Unknown or unavailable channel IDs deliver no messages. Topic-only subscriptions retain their
existing behavior, including `convertTo` and `converterId` selection.

Internal pipeline consumers select native inputs using `SubscribePayload.channelIds`. Omitting
the list selects all channels on the topic; an empty list selects none. `getBatchIterator` accepts
`options.channelId`, and `getMessageAtTime` accepts a native channel ID as its third argument.
Virtual selections are resolved by the panel adapter, where converter configuration remains
scoped to the consuming panel. Conversion results are not shared between panels.

MCAP readers preserve every channel's identity and decoder, even when topic and schema names
coincide. Combined recordings qualify channel IDs by their source index. WebSocket subscriptions
also distinguish advertised channels sharing a topic. IDs identify streams within the current
data source; they are not durable references across reordered recordings or reconnects that
assign different channel numbers. Sources without explicit channels expose a logical native
channel for each topic/schema pair.

The Channels inspector lists native and converted streams and opens the selected channel in
Raw Messages. Both Raw Messages implementations persist channel selections, including independent
comparison channels. Other panels still need channel-aware pickers. The legacy global datatype
registry is not yet scoped to each channel, so conflicting same-name schema definitions still
require that subsequent schema-registry change for accurate field metadata.

Raw Messages combines channel selection with the message-path editor: topic completions identify
each native or converted channel, and an inline badge switches channels while preserving the field
suffix. A topic with one available channel is selected automatically; ambiguous topics require an
explicit choice. Channel identity is saved separately from the existing message-path syntax.
