// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { unwrap } from "@lichtblick/den/monads";
import { parseMessagePath } from "@lichtblick/message-path";
import {
  MessageBlock,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
} from "@lichtblick/suite-base/players/types";

import { CurrentCustomDatasetsBuilder } from "./CurrentCustomDatasetsBuilder";
import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { PlotPath } from "../utils/config";

function buildSeriesItems(
  paths: (Partial<PlotPath> & { key?: string; value: string })[],
): SeriesItem[] {
  return paths.map((item, idx) => {
    const parsed = unwrap(parseMessagePath(item.value));
    const key = (item.key ?? String(idx)) as SeriesConfigKey;

    return {
      configIndex: idx,
      parsed,
      color: "red",
      contrastColor: "blue",
      enabled: item.enabled ?? true,
      timestampMethod: item.timestampMethod ?? "receiveTime",
      key,
      lineSize: 1,
      messagePath: item.value,
      showLine: true,
    } satisfies SeriesItem;
  });
}

function buildPlayerState(
  activeDataOverride?: Partial<PlayerStateActiveData>,
  blocks?: readonly (MessageBlock | undefined)[],
): PlayerState {
  return {
    activeData: {
      messages: [],
      currentTime: { sec: 0, nsec: 0 },
      endTime: { sec: 0, nsec: 0 },
      lastSeekTime: 1,
      topics: [],
      speed: 1,
      isPlaying: false,
      topicStats: new Map(),
      startTime: { sec: 0, nsec: 0 },
      datatypes: new Map(),
      totalBytesReceived: 0,
      ...activeDataOverride,
    },
    capabilities: [],
    presence: PlayerPresence.PRESENT,
    profile: undefined,
    playerId: "1",
    progress: {
      fullyLoadedFractionRanges: [],
      messageCache: {
        blocks: blocks ?? [],
        startTime: { sec: 0, nsec: 0 },
      },
    },
  };
}

describe("CurrentCustomDatasetsBuilder", () => {
  it("should apply a math function", async () => {
    const builder = new CurrentCustomDatasetsBuilder();

    builder.setXPath(parseMessagePath("/foo.val.@negative"));
    builder.setSeries(
      buildSeriesItems([
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/bar.val.@abs",
        },
      ]),
    );

    builder.handlePlayerState(
      buildPlayerState({
        messages: [
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 4,
            },
          },
          {
            topic: "/bar",
            schemaName: "foo",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: -3,
            },
          },
        ],
      }),
    );

    const result = await builder.getViewportDatasets();

    expect(result).toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [{ x: -4, y: 3, value: 3, receiveTime: { sec: 0, nsec: 0 } }],
          showLine: true,
          pointRadius: 1.2,
          fill: false,
        }),
      ],
    });
  });

  it("supports toggling series enabled state", async () => {
    const builder = new CurrentCustomDatasetsBuilder();

    builder.setXPath(parseMessagePath("/foo.val"));
    builder.setSeries(
      buildSeriesItems([
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/foo.val",
        },
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/bar.val",
        },
      ]),
    );

    builder.handlePlayerState(
      buildPlayerState({
        messages: [
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1,
            },
          },
          {
            topic: "/bar",
            schemaName: "bar",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 2,
            },
          },
        ],
      }),
    );

    await expect(builder.getViewportDatasets()).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [{ x: 1, y: 1, value: 1, receiveTime: { sec: 0, nsec: 0 } }],
        }),
        expect.objectContaining({
          data: [{ x: 1, y: 2, value: 2, receiveTime: { sec: 0, nsec: 0 } }],
        }),
      ],
    });

    builder.setSeries(
      buildSeriesItems([
        {
          enabled: false,
          timestampMethod: "receiveTime",
          value: "/foo.val",
        },
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/bar.val",
        },
      ]),
    );

    await expect(builder.getViewportDatasets()).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        undefined,
        expect.objectContaining({
          data: [{ x: 1, y: 2, value: 2, receiveTime: { sec: 0, nsec: 0 } }],
        }),
      ],
    });
  });

  it("leaves gaps in datasetsByConfigIndex for missing series", async () => {
    const builder = new CurrentCustomDatasetsBuilder();

    builder.setXPath(parseMessagePath("/foo.val"));
    builder.setSeries([
      {
        configIndex: 3,
        parsed: parseMessagePath("/foo.val")!,
        color: "red",
        contrastColor: "blue",
        enabled: true,
        timestampMethod: "receiveTime",
        key: "x" as SeriesConfigKey,
        lineSize: 1,
        messagePath: "/foo.val",
        showLine: true,
      },
    ]);

    builder.handlePlayerState(
      buildPlayerState({
        messages: [
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1,
            },
          },
        ],
      }),
    );

    await expect(builder.getViewportDatasets()).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        undefined,
        undefined,
        undefined,
        expect.objectContaining({
          data: [{ x: 1, y: 1, value: 1, receiveTime: { sec: 0, nsec: 0 } }],
        }),
      ],
    });
  });
});
