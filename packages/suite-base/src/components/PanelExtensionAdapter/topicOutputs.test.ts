// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent, SettingsTree } from "@lichtblick/suite";
import { buildSettingsTree } from "@lichtblick/suite-base/components/PanelSettings/settingsTree";
import { InstalledMessageConverter } from "@lichtblick/suite-base/types/messageConverters";
import { topicOutputKey } from "@lichtblick/suite-base/util/topicOutput";

import { collateTopicSchemaConversions, convertMessage } from "./messageProcessing";
import { createMessageRangeIterator } from "./messageRangeIterator";
import { initRenderStateBuilder, BuilderRenderStateInput } from "./renderState";
import { onlyLastByTopicMessage } from "../../panels/ThreeDeeRender/SceneExtension";

const original: MessageEvent = {
  topic: "/objects",
  schemaName: "Objects",
  message: {},
  receiveTime: { sec: 0, nsec: 0 },
  sizeInBytes: 1,
  topicConfig: { legacy: true },
};
const sortedTopics = [{ name: original.topic, schemaName: original.schemaName }];
function converter(id: string): InstalledMessageConverter {
  return {
    converterId: id,
    fromSchemaName: "Objects",
    toSchemaName: "SceneUpdate",
    converter: jest.fn((_message, event) => event.topicConfig),
    panelSettings: {
      "3D": {
        defaultConfig: { size: 1 },
        settings: jest.fn((config) => ({
          fields: {
            size: { input: "number", label: id, value: (config as { size: number }).size },
          },
        })),
        handler: jest.fn(),
      },
    },
  };
}

describe("independent converter outputs", () => {
  it("preserves per-panel output settings identity so stateful converters emit deletions", () => {
    const histories = new WeakMap<object, string[]>();
    const entry = converter("A");
    entry.converter = jest.fn((message, event) => {
      const settings = event.topicConfig as object;
      const ids = message as string[];
      const previousIds = histories.get(settings) ?? [];
      histories.set(settings, ids);
      return { entities: ids, deletions: previousIds.filter((id) => !ids.includes(id)) };
    });
    const input: BuilderRenderStateInput = {
      appSettings: undefined,
      colorScheme: undefined,
      currentFrame: [{ ...original, message: ["vehicle"] }],
      globalVariables: {},
      hoverValue: undefined,
      playerState: undefined,
      sharedPanelState: undefined,
      sortedTopics,
      subscriptions: [{ topic: original.topic, convertTo: "SceneUpdate", converterId: "A" }],
      messageConverters: [entry, converter("B")],
      watchedFields: new Set(["currentFrame"]),
      forceConversion: new Set(),
      config: { topics: {} },
      panelType: "3D",
    };
    const panel = initRenderStateBuilder();
    const otherPanel = initRenderStateBuilder();
    const firstSettings = panel(input)?.currentFrame?.[0]?.topicConfig;
    expect(otherPanel(input)?.currentFrame?.[0]?.topicConfig).not.toBe(firstSettings);
    const next = panel({
      ...input,
      currentFrame: [{ ...original, message: [] }],
      config: { topics: {} },
    });
    expect(next?.currentFrame?.[0]?.topicConfig).toBe(firstSettings);
    expect(next?.currentFrame?.[0]?.message).toEqual({ entities: [], deletions: ["vehicle"] });
    const withBoth = panel({
      ...input,
      subscriptions: [
        ...input.subscriptions,
        { topic: original.topic, convertTo: "SceneUpdate", converterId: "B" },
      ],
      currentFrame: [{ ...original, message: [] }],
    });
    expect(withBoth?.currentFrame?.[0]?.topicConfig).toBe(firstSettings);
    expect(withBoth?.currentFrame?.[1]?.topicConfig).not.toBe(firstSettings);
    const changed = panel({
      ...input,
      currentFrame: [{ ...original, message: [] }],
      config: { topics: { [original.topic]: { size: 2 } } },
    });
    expect(changed?.currentFrame?.[0]?.topicConfig).not.toBe(firstSettings);
    expect(changed?.currentFrame?.[0]?.topicConfig).toEqual({ size: 2 });
  });

  it("runs two identical schema pairs with distinct configs without mutating the original event", () => {
    const converters = [converter("A"), converter("B")];
    const { topicSchemaConverters } = collateTopicSchemaConversions(
      converters.map((entry) => ({
        topic: original.topic,
        convertTo: "SceneUpdate",
        converterId: entry.converterId,
      })),
      sortedTopics,
      converters,
    );
    const keyA = topicOutputKey(original.topic, {
      kind: "converted",
      sourceSchemaName: "Objects",
      converterId: "A",
    });
    const config = {
      topics: { [original.topic]: original.topicConfig },
      topicOutputs: { [original.topic]: { [keyA]: { size: 7 } } },
    };
    const outputs: MessageEvent[] = [];
    convertMessage(original, topicSchemaConverters, outputs, undefined, {
      config,
      panelType: "3D",
    });
    expect(outputs).toHaveLength(2);
    expect(outputs[0]).toMatchObject({
      topic: original.topic,
      output: { converterId: "A" },
      message: { size: 7 },
      topicConfig: { size: 7 },
    });
    expect(outputs[1]).toMatchObject({
      topic: original.topic,
      output: { converterId: "B" },
      message: { legacy: true, size: 1 },
    });
    expect(outputs[0]?.originalMessageEvent).toBe(original);
    expect(original.topicConfig).toEqual({ legacy: true });
    expect(onlyLastByTopicMessage([original, ...outputs, ...outputs])).toHaveLength(3);
  });

  it("does not substitute an unavailable explicit converter, including same-schema conversions", () => {
    const entry = { ...converter("A"), toSchemaName: "Objects" };
    const unavailable = collateTopicSchemaConversions(
      [{ topic: original.topic, convertTo: "Objects", converterId: "missing" }],
      sortedTopics,
      [entry],
    );
    expect(unavailable.topicSchemaConverters.size).toBe(0);
    expect(unavailable.unconvertedSubscriptionTopics.size).toBe(0);
    expect(
      collateTopicSchemaConversions(
        [{ topic: original.topic, convertTo: "Objects", converterId: "A" }],
        sortedTopics,
        [entry],
      ).topicSchemaConverters.size,
    ).toBe(1);
  });

  it("matches all source schemas exposed on one topic", () => {
    const a = converter("A");
    const b = { ...converter("B"), fromSchemaName: "OtherObjects" };
    const result = collateTopicSchemaConversions(
      [{ topic: original.topic, convertTo: "SceneUpdate" }],
      [...sortedTopics, { name: original.topic, schemaName: "OtherObjects" }],
      [a, b],
    );
    expect(result.topicSchemaConverters.size).toBe(2);
  });

  it("preserves identity and configuration during range iteration", async () => {
    const entry = converter("A");
    async function* raw() {
      yield { type: "message-event" as const, msgEvent: original };
    }
    const { iterable } = createMessageRangeIterator({
      topic: original.topic,
      convertTo: "SceneUpdate",
      converterId: "A",
      rawBatchIterator: raw(),
      sortedTopics,
      messageConverters: [entry],
      config: { topics: { [original.topic]: { size: 5 } } },
      panelType: "3D",
    });
    const messages: MessageEvent[] = [];
    for await (const batch of iterable) {
      messages.push(...batch);
    }
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ output: { converterId: "A" }, topicConfig: { size: 5 } });
  });

  it("builds settings only from the corresponding converter registration", () => {
    const converters = [converter("A"), converter("B")];
    const descriptors = converters.map((entry) => ({
      topic: original.topic,
      schemaName: entry.toSchemaName,
      output: {
        kind: "converted" as const,
        sourceSchemaName: entry.fromSchemaName,
        converterId: entry.converterId!,
      },
    }));
    const tree: SettingsTree = {
      actionHandler: jest.fn(),
      topicOutputs: descriptors,
      nodes: {
        topics: {
          children: {
            [original.topic]: {
              children: Object.fromEntries(
                descriptors.map((entry) => [
                  topicOutputKey(entry.topic, entry.output),
                  { fields: {} },
                ]),
              ),
            },
          },
        },
      },
    };
    const result = buildSettingsTree({
      settingsTree: tree,
      panelType: "3D",
      config: { topics: { [original.topic]: { size: 6 } } },
      extensionSettings: {},
      messageConverters: converters,
      messagePipelineState: jest.fn(),
    });
    const outputs = result?.nodes.topics?.children?.[original.topic]?.children;
    expect(
      outputs?.[topicOutputKey(original.topic, descriptors[0]!.output)]?.fields?.size,
    ).toMatchObject({ label: "A", value: 6 });
    expect(
      outputs?.[topicOutputKey(original.topic, descriptors[1]!.output)]?.fields?.size,
    ).toMatchObject({ label: "B", value: 6 });
    expect(
      tree.nodes.topics?.children?.[original.topic]?.children?.[
        topicOutputKey(original.topic, descriptors[0]!.output)
      ]?.fields,
    ).toEqual({});
  });
});
