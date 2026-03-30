// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SeriesConfigKey } from "@lichtblick/suite-base/panels/Plot/builders/IDatasetsBuilder";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";

export class PlotCoordinatorBuilder {
  /**
   * Builds a `Map<topic, Set<SeriesConfigKey>>` from a compact array of `[topic, paths]` pairs.
   *
   * Config indices are assigned sequentially across all topics (matching PlotCoordinator behaviour).
   * The default `timestampMethod` is `"receiveTime"`.
   *
   * @example
   * plotCoordinator["seriesKeysByTopic"] = PlotCoordinatorBuilder.seriesKeysByTopic([
   *   ["/foo", ["/foo.x", "/foo.y"]],
   * ]);
   */
  public static seriesKeysByTopic(
    entries: [topic: string, paths: string[]][],
    timestampMethod: TimestampMethod = "receiveTime",
  ): Map<string, Set<SeriesConfigKey>> {
    const map = new Map<string, Set<SeriesConfigKey>>();
    let configIndex = 0;
    for (const [topic, paths] of entries) {
      const startIndex = configIndex;
      const keys = new Set<SeriesConfigKey>(
        paths.map((path, i) => `${startIndex + i}:${timestampMethod}:${path}` as SeriesConfigKey),
      );
      configIndex += paths.length;
      map.set(topic, keys);
    }
    return map;
  }
}
