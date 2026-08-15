// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable } from "@lichtblick/suite";
import { Topic } from "@lichtblick/suite-base/players/types";
import type { AgentSafeLayoutData } from "@lichtblick/suite-base/services/agent/layoutSchema";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

import { sanitizePlotPaths } from "./sanitizePlotPaths";

function makeLayoutData(paths: unknown[]): AgentSafeLayoutData {
  return {
    configById: {
      "Plot!agent": { paths },
    },
    globalVariables: {},
    layout: "Plot!agent",
    playbackConfig: { speed: 1 },
    userNodes: {},
  } as unknown as AgentSafeLayoutData;
}

function makeDatatypes(): Immutable<RosDatatypes> {
  return new Map([
    [
      "sensor_msgs/PointCloud2",
      {
        definitions: [
          { name: "header", type: "std_msgs/Header" },
          { name: "x", type: "float64" },
          { name: "data", type: "uint8", isArray: true },
          { name: "channels", type: "sensor_msgs/ChannelFloat32", isArray: true },
        ],
      },
    ],
    [
      "std_msgs/Header",
      {
        definitions: [
          { name: "seq", type: "uint32" },
          { name: "stamp", type: "time" },
          { name: "frame_id", type: "string" },
        ],
      },
    ],
    [
      "sensor_msgs/ChannelFloat32",
      {
        definitions: [
          { name: "name", type: "string" },
          { name: "values", type: "float32", isArray: true },
        ],
      },
    ],
  ]);
}

const topics: readonly Topic[] = [
  { name: "/points", schemaName: "sensor_msgs/PointCloud2" },
  { name: "/no_schema_topic", schemaName: undefined },
];

describe("sanitizePlotPaths", () => {
  it("keeps valid paths and drops invalid topics/fields", () => {
    const data = makeLayoutData([
      { value: "/points.x", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
      { value: "/points.nonexistent", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(2);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths).toEqual([
      { value: "/points.x", enabled: true, timestampMethod: "receiveTime" },
    ]);
  });

  it("drops paths terminating at a message or an unsliced array even when the field exists", () => {
    const data = makeLayoutData([
      { value: "/points.header", enabled: true, timestampMethod: "receiveTime" },
      // /points.header.stamp 终止于 time（PLOTABLE_ROS_TYPES 含 time），可绘制，保留。
      { value: "/points.header.stamp", enabled: true, timestampMethod: "receiveTime" },
      { value: "/points.data", enabled: true, timestampMethod: "receiveTime" },
      { value: "/points.channels", enabled: true, timestampMethod: "receiveTime" },
      { value: "/points.data[0]", enabled: true, timestampMethod: "receiveTime" },
      { value: "/points.channels[0].values[0]", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(3);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths.map((path) => path.value)).toEqual([
      "/points.header.stamp",
      "/points.data[0]",
      "/points.channels[0].values[0]",
    ]);
  });

  it("keeps numeric-string reference lines without validating them", () => {
    const data = makeLayoutData([
      { value: "5", enabled: true, timestampMethod: "receiveTime" },
      { value: "3.14", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(1);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths.map((path) => path.value)).toEqual(["5", "3.14"]);
  });

  it("preserves slice/filter/modifier expressions on otherwise valid paths", () => {
    const data = makeLayoutData([
      {
        value: "/points.channels[:]{name==\"x\"}.values[0]",
        enabled: true,
        timestampMethod: "receiveTime",
      },
      { value: "/points.x.@derivative", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(0);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths.map((path) => path.value)).toEqual([
      "/points.channels[:]{name==\"x\"}.values[0]",
      "/points.x.@derivative",
    ]);
  });

  it("keeps paths whose topic exists but whose schema is missing or incomplete", () => {
    // /no_schema_topic 在 topics 中存在但 schemaName 为 undefined（schema 缺失）。
    const data = makeLayoutData([
      { value: "/no_schema_topic.anything", enabled: true, timestampMethod: "receiveTime" },
      { value: "/missing_schema_topic.anything", enabled: true, timestampMethod: "receiveTime" },
    ]);
    const datatypesWithoutTopicSchema = makeDatatypes();

    const { data: result, droppedCount } = sanitizePlotPaths(
      data,
      [
        ...topics,
        { name: "/missing_schema_topic", schemaName: "unknown/NotInDatatypes" },
      ],
      datatypesWithoutTopicSchema,
    );

    expect(droppedCount).toBe(0);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths.map((path) => path.value)).toEqual([
      "/no_schema_topic.anything",
      "/missing_schema_topic.anything",
    ]);
  });

  it("skips the whole filter without error when a referenced sub-datatype is missing", () => {
    // root schema sensor_msgs/PointCloud2 存在，但其引用的 std_msgs/Header 缺失 →
    // messagePathStructures 抛异常 → 保守跳过整个过滤（全部保留），不报错。
    const datatypesWithBrokenReference = new Map([
      [
        "sensor_msgs/PointCloud2",
        {
          definitions: [{ name: "header", type: "std_msgs/Header" }],
        },
      ],
    ]) as unknown as Immutable<RosDatatypes>;
    const data = makeLayoutData([
      { value: "/points.header.seq", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
    ]);

    expect(() =>
      sanitizePlotPaths(data, topics, datatypesWithBrokenReference),
    ).not.toThrow();
    const { data: result, droppedCount } = sanitizePlotPaths(
      data,
      topics,
      datatypesWithBrokenReference,
    );

    expect(droppedCount).toBe(0);
    const paths = (result.configById["Plot!agent"] as { paths: Array<{ value: string }> }).paths;
    expect(paths.map((path) => path.value)).toEqual([
      "/points.header.seq",
      "/nonexistent.x",
    ]);
  });

  it("does not filter when no data source is loaded", () => {
    const data = makeLayoutData([
      { value: "/points.x", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, [], makeDatatypes());

    expect(droppedCount).toBe(0);
    expect(result.configById["Plot!agent"]).toEqual({
      paths: [
        { value: "/points.x", enabled: true, timestampMethod: "receiveTime" },
        { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
      ],
    });
  });

  it("sets autoSeeded when every path of a Plot panel is dropped, preventing auto-seed", () => {
    const data = makeLayoutData([
      { value: "/nonexistent.a", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.b", enabled: true, timestampMethod: "receiveTime" },
    ]);

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(2);
    expect(result.configById["Plot!agent"]).toEqual({
      paths: [],
      autoSeeded: true,
    });
  });

  it("keeps autoSeeded unchanged when a partial drop still leaves paths", () => {
    const data = makeLayoutData([
      { value: "/points.x", enabled: true, timestampMethod: "receiveTime" },
      { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
    ]);
    const plotConfig = data.configById["Plot!agent"];
    if (plotConfig != undefined) {
      plotConfig.autoSeeded = false;
    }

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(1);
    expect(result.configById["Plot!agent"]).toEqual({
      paths: [{ value: "/points.x", enabled: true, timestampMethod: "receiveTime" }],
      autoSeeded: false,
    });
  });

  it("leaves non-Plot panels untouched", () => {
    const data = {
      configById: {
        "3D!main": { cameraState: { x: 1 } },
        "Plot!agent": {
          paths: [{ value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" }],
        },
      },
      globalVariables: {},
      layout: "Plot!agent",
      playbackConfig: { speed: 1 },
      userNodes: {},
    } as unknown as AgentSafeLayoutData;

    const { data: result, droppedCount } = sanitizePlotPaths(data, topics, makeDatatypes());

    expect(droppedCount).toBe(1);
    expect(result.configById["3D!main"]).toEqual({ cameraState: { x: 1 } });
  });
});
