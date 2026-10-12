// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent, TopicOutputDescriptor } from "@lichtblick/suite";

import {
  getConverterId,
  messageOutputKey,
  renderTopics,
  resolveOutputConfig,
  topicOutputKey,
} from "./topicOutput";

const output: TopicOutputDescriptor = {
  topic: "/objects",
  schemaName: "SceneUpdate",
  output: { kind: "converted", sourceSchemaName: "Objects", converterId: "A" },
};

describe("topic output identity and saved settings", () => {
  it("retains stable registration identity across reloads and distinguishes same-schema registrations", () => {
    const registration = {
      extensionId: "extension",
      id: "a",
      fromSchemaName: "Objects",
      toSchemaName: "SceneUpdate",
      converter: () => ({}),
    };
    expect(getConverterId(registration)).toBe(
      getConverterId({ ...registration, converter: () => ({}) }),
    );
    expect(getConverterId(registration)).not.toBe(getConverterId({ ...registration, id: "b" }));
  });

  it("uses unambiguous keys and separates original data from every converter", () => {
    expect(topicOutputKey("a\nb", output.output)).not.toBe(
      topicOutputKey("a", { ...output.output, sourceSchemaName: "b\nObjects" }),
    );
    expect(topicOutputKey(output.topic, output.output)).not.toBe(
      topicOutputKey(output.topic, { kind: "original", sourceSchemaName: "Objects" }),
    );
    expect(topicOutputKey(output.topic, output.output)).not.toBe(
      topicOutputKey(output.topic, { ...output.output, kind: "converted", converterId: "B" }),
    );
  });

  it("inherits legacy settings on read, clones nested values, and isolates a saved output snapshot", () => {
    const config = {
      topics: { "/objects": { visible: true, nested: { color: "red" } } },
      topicOutputs: {} as Record<string, Record<string, unknown>>,
    };
    const settings = resolveOutputConfig(config, output, { nested: { size: 3 } });
    expect(settings).toEqual({ visible: true, nested: { color: "red", size: 3 } });
    expect(config.topicOutputs).toEqual({});
    config.topicOutputs[output.topic] = { [topicOutputKey(output.topic, output.output)]: settings };
    config.topics["/objects"].nested.color = "blue";
    config.topics["/objects"].visible = false;
    expect(resolveOutputConfig(config, output)).toEqual({
      visible: true,
      nested: { color: "red", size: 3 },
    });
    expect(
      resolveOutputConfig(config, {
        ...output,
        output: { ...output.output, kind: "converted", converterId: "B" },
      }),
    ).toEqual({ visible: false, nested: { color: "blue" } });
  });

  it("enumerates same-schema converters and distinct original source schemas before messages arrive", () => {
    const topics = renderTopics([
      {
        name: "/objects",
        schemaName: "Objects",
        conversionOutputs: [
          { converterId: "A", schemaName: "SceneUpdate" },
          { converterId: "B", schemaName: "SceneUpdate" },
        ],
      },
      { name: "/objects", schemaName: "OtherObjects" },
    ]);
    expect(topics).toHaveLength(4);
    expect(new Set(topics.map((topic) => topic.name)).size).toBe(4);
    expect(topics.map((topic) => topic.topic)).toEqual(Array(4).fill("/objects"));
    const event: MessageEvent = {
      topic: "/objects",
      schemaName: "OtherObjects",
      message: {},
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
    };
    expect(messageOutputKey(event)).toBe(
      topicOutputKey(event.topic, { kind: "original", sourceSchemaName: event.schemaName }),
    );
  });
});
