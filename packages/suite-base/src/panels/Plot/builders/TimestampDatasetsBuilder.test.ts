// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { unwrap } from "@lichtblick/den/monads";
import { makeComlinkWorkerMock } from "@lichtblick/den/testing";
import { parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import {
  MessageBlock,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
} from "@lichtblick/suite-base/players/types";

import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { TimestampDatasetsBuilder } from "./TimestampDatasetsBuilder";
import { TimestampDatasetsBuilderImpl } from "./TimestampDatasetsBuilderImpl";
import { PlotPath } from "../utils/config";

Object.defineProperty(global, "Worker", {
  writable: true,
  value: makeComlinkWorkerMock(() => new TimestampDatasetsBuilderImpl()),
});

function groupByTopic(events: MessageEvent[]): Record<string, MessageEvent[]> {
  return _.groupBy(events, (item) => item.topic);
}

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
      showLine: item.showLine ?? true,
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

describe("TimestampDatasetsBuilder", () => {
  it("should process current messages into a dataset", async () => {
    const builder = new TimestampDatasetsBuilder();

    builder.setSeries(
      buildSeriesItems([
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/foo.val",
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
              val: 0,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 0.5, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 1, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1.5,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 2, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 2.5,
            },
          },
        ],
      }),
    );

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 0, y: 0, value: 0 },
            { x: 0.5, y: 1, value: 1 },
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
      ],
    });
  });

  it("should create a discontinuity between current and full", async () => {
    const builder = new TimestampDatasetsBuilder();

    builder.setSeries(
      buildSeriesItems([
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/foo.val",
        },
      ]),
    );

    const block = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 0,
          },
        },
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0.5, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 1,
          },
        },
      ]),
    };

    const playerState = buildPlayerState(
      {
        messages: [
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 1, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1.5,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 2, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 2.5,
            },
          },
        ],
      },
      [block],
    );

    builder.handlePlayerState(playerState);
    await builder.handleBlocks(
      unwrap(playerState.activeData?.startTime),
      unwrap(playerState.progress.messageCache?.blocks),
      async () => await Promise.resolve(false),
    );

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 0, y: 0, value: 0 },
            { x: 0.5, y: 1, value: 1 },
            { x: NaN, y: NaN, value: NaN },
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
      ],
    });
  });

  it("computes derivative inside and outside of viewport", async () => {
    const builder = new TimestampDatasetsBuilder();

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
          value: "/foo.val.@derivative",
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
              val: 0,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 0.5, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 1, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 1.5,
            },
          },
          {
            topic: "/foo",
            schemaName: "foo",
            receiveTime: { sec: 2, nsec: 0 },
            sizeInBytes: 0,
            message: {
              val: 2.5,
            },
          },
        ],
      }),
    );

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 0, y: 0, value: 0 },
            { x: 0.5, y: 1, value: 1 },
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
        expect.objectContaining({
          data: [
            { x: 0.5, y: 2, value: 2 },
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 1, value: 1 },
          ],
        }),
      ],
    });

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {
          x: { min: 0.2 },
        },
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 0, y: 0, value: 0 },
            { x: 0.5, y: 1, value: 1 },
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
        expect.objectContaining({
          data: [
            { x: 0.5, y: 2, value: 2 },
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 1, value: 1 },
          ],
        }),
      ],
    });

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {
          x: { min: 0.75 },
        },
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 0.5, y: 1, value: 1 },
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
        expect.objectContaining({
          data: [
            { x: 0.5, y: 2, value: 2 },
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 1, value: 1 },
          ],
        }),
      ],
    });

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {
          x: { min: 1.2 },
        },
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [
            { x: 1, y: 1.5, value: 1.5 },
            { x: 2, y: 2.5, value: 2.5 },
          ],
        }),
        expect.objectContaining({
          data: [
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 1, value: 1 },
          ],
        }),
      ],
    });
  });

  it("should cull current messages after threshold is reached", async () => {
    const builder = new TimestampDatasetsBuilder();

    builder.setSeries(
      buildSeriesItems([
        {
          enabled: true,
          timestampMethod: "receiveTime",
          value: "/foo.val",
          showLine: false,
        },
      ]),
    );

    const messages = new Array(60_000).fill(1).map((_val, idx) => {
      return {
        topic: "/foo",
        schemaName: "foo",
        receiveTime: { sec: idx, nsec: 0 },
        sizeInBytes: 0,
        message: {
          val: idx,
        },
      };
    });

    // first batch of messages is under the limit
    {
      builder.handlePlayerState(
        buildPlayerState({
          messages: messages.slice(0, 40_000),
        }),
      );

      const result = await builder.getViewportDatasets({
        size: { width: 100_000, height: 100_000 },
        bounds: {},
      });

      expect(result.datasetsByConfigIndex[0]!.data.length).toEqual(40_000);
      expect(result.datasetsByConfigIndex[0]!.data[0]).toEqual({ x: 0, y: 0, value: 0 });
      expect(result.datasetsByConfigIndex[0]!.data[39_999]).toEqual({
        x: 39_999,
        y: 39_999,
        value: 39_999,
      });
    }

    // Next batch goes over the limit so some of the previous will be culled
    {
      builder.handlePlayerState(
        buildPlayerState({
          messages: messages.slice(40_000, 60_000),
        }),
      );

      const result = await builder.getViewportDatasets({
        size: { width: 100_000, height: 100_000 },
        bounds: {},
      });

      expect(result.datasetsByConfigIndex[0]!.data.length).toEqual(37500);
      expect(result.datasetsByConfigIndex[0]!.data[0]).toEqual({
        x: 22_500,
        y: 22_500,
        value: 22_500,
      });
      expect(result.datasetsByConfigIndex[0]!.data[37_499]).toEqual({
        x: 59_999,
        y: 59_999,
        value: 59_999,
      });
    }
  });

  it("supports toggling series enabled state", async () => {
    const builder = new TimestampDatasetsBuilder();

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

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        expect.objectContaining({
          data: [{ x: 0, y: 1, value: 1 }],
        }),
        expect.objectContaining({
          data: [{ x: 0, y: 2, value: 2 }],
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

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        undefined,
        expect.objectContaining({
          data: [{ x: 0, y: 2, value: 2 }],
        }),
      ],
    });
  });

  it("leaves gaps in datasetsByConfigIndex for missing series", async () => {
    const builder = new TimestampDatasetsBuilder();

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

    await expect(
      builder.getViewportDatasets({
        size: { width: 1_000, height: 1_000 },
        bounds: {},
      }),
    ).resolves.toEqual({
      pathsWithMismatchedDataLengths: new Set(),
      datasetsByConfigIndex: [
        undefined,
        undefined,
        undefined,
        expect.objectContaining({
          data: [{ x: 0, y: 1, value: 1 }],
        }),
      ],
    });
  });
});
