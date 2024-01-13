// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { unwrap } from "@foxglove/den/monads";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  MessageBlock,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
} from "@foxglove/studio-base/players/types";

import { SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { IndexDatasetsBuilder } from "./IndexDatasetsBuilder";
import { PlotPath } from "../config";

function buildSeriesItems(
  paths: (Partial<PlotPath> & { key?: string; value: string })[],
): SeriesItem[] {
  return paths.map((item, idx) => {
    const parsed = unwrap(parseRosPath(item.value));
    const key = (item.key ?? String(idx)) as SeriesConfigKey;

    return {
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

describe("IndexDatasetsBuilder", () => {
  it("should apply a math function", async () => {
    const builder = new IndexDatasetsBuilder();

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
      datasets: [
        expect.objectContaining({
          data: [{ x: 0, y: 3, value: 3, receiveTime: { sec: 0, nsec: 0 } }],
          showLine: true,
          pointRadius: 1.2,
          fill: false,
        }),
      ],
    });
  });
});
