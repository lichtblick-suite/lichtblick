// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { toSec, subtract as subtractTime } from "@lichtblick/rostime";
import { Immutable, Time } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { UseSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter/useSubscribeMessageRange";
import { OffscreenCanvasRenderer } from "@lichtblick/suite-base/panels/Plot/OffscreenCanvasRenderer";
import { PlotCoordinator as BasePlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import {
  IDatasetsBuilder,
  SeriesConfigKey,
} from "@lichtblick/suite-base/panels/Plot/builders/IDatasetsBuilder";
import { PlayerState } from "@lichtblick/suite-base/players/types";

import { pathToSubscribePayload } from "../Plot/utils/subscription";

export class PlotCoordinatorTwo extends BasePlotCoordinator {
  private subscribeMessageRange: UseSubscribeMessageRange;
  private rangeSubscriptionCancels = new Map<
    string,
    { cancel: () => void; seriesKeys: ReadonlySet<SeriesConfigKey> }
  >();
  private startTime: Immutable<Time> | undefined;

  public constructor(
    renderer: OffscreenCanvasRenderer,
    builder: IDatasetsBuilder,
    subscribeMessageRange: UseSubscribeMessageRange,
  ) {
    super(renderer, builder);
    this.subscribeMessageRange = subscribeMessageRange;
  }

  public override destroy(): void {
    for (const { cancel } of this.rangeSubscriptionCancels.values()) {
      cancel();
    }
    this.rangeSubscriptionCancels.clear();
    super.destroy();
  }

  public override handlePlayerState(state: Immutable<PlayerState>): void {
    if (this.isDestroyed()) {
      return;
    }

    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const { messages, lastSeekTime, currentTime, startTime } = activeData;
    this.startTime = startTime;

    const seriesKeysByTopic = new Map<string, Set<SeriesConfigKey>>();
    for (const s of this.series) {
      if (pathToSubscribePayload(s.parsed, "full") == undefined) {
        continue;
      }
      const keys = seriesKeysByTopic.get(s.parsed.topicName) ?? new Set<SeriesConfigKey>();
      keys.add(s.key);
      seriesKeysByTopic.set(s.parsed.topicName, keys);
    }

    // If the builder uses a separate x-axis topic (e.g. custom x-axis), subscribe to it too.
    // The builder identifies it internally via handleMessageRange by comparing the topic name.
    const xTopic = this.datasetsBuilder.getXTopic?.();
    if (xTopic && !seriesKeysByTopic.has(xTopic)) {
      seriesKeysByTopic.set(xTopic, new Set<SeriesConfigKey>());
    }

    this.subscribeTopicRanges(seriesKeysByTopic);

    if (this.isTimeseriesPlot) {
      const secondsSinceStart = toSec(subtractTime(currentTime, startTime));
      this.currentSeconds = secondsSinceStart;
    }

    if (lastSeekTime !== this.lastSeekTime) {
      this.currentValuesByConfigIndex = [];
      this.lastSeekTime = lastSeekTime;
    }

    for (const seriesItem of this.series) {
      if (seriesItem.timestampMethod === "headerStamp") {
        // We currently do not support showing current values in the legend for header.stamp mode,
        // which would require keeping a buffer of messages to sort (currently done in
        // TimestampDatasetsBuilderImpl)
        continue;
      }
      for (let i = messages.length - 1; i >= 0; --i) {
        const msgEvent = messages[i]!;
        if (msgEvent.topic !== seriesItem.parsed.topicName) {
          continue;
        }
        const items = simpleGetMessagePathDataItems(msgEvent, seriesItem.parsed);
        if (items.length > 0) {
          this.currentValuesByConfigIndex[seriesItem.configIndex] = items[items.length - 1];
          break;
        }
      }
    }

    this.emit("currentValuesChanged", this.currentValuesByConfigIndex);

    const handlePlayerStateResult = this.datasetsBuilder.handlePlayerState(state);

    // There's no result from the builder so we clear dataset range and trigger a render so
    // we can fall back to other ranges
    if (!handlePlayerStateResult) {
      this.datasetRange = undefined;
      this.queueDispatchRender();
      return;
    }

    const newRange = handlePlayerStateResult.range;

    // If the range has changed we will trigger a render to incorporate the new range into the chart
    // axis
    if (!_.isEqual(this.datasetRange, newRange)) {
      this.datasetRange = handlePlayerStateResult.range;
      this.queueDispatchRender();
    }

    if (handlePlayerStateResult.datasetsChanged) {
      this.queueDispatchDownsample();
    }
  }

  private cancelTopicSubscription(topic: string): void {
    this.rangeSubscriptionCancels.get(topic)?.cancel();
    this.rangeSubscriptionCancels.delete(topic);
  }

  private subscribeTopicRanges(seriesKeysByTopic: Map<string, Set<SeriesConfigKey>>): void {
    const builder = this.datasetsBuilder;
    if (!builder.handleMessageRange) {
      return;
    }

    // Cancel subscriptions for topics that are no longer needed
    for (const topic of this.rangeSubscriptionCancels.keys()) {
      if (!seriesKeysByTopic.has(topic)) {
        this.cancelTopicSubscription(topic);
      }
    }

    // Start subscriptions only for new topics that the player knows about
    for (const [topic, currentKeys] of seriesKeysByTopic) {
      const existing = this.rangeSubscriptionCancels.get(topic);

      if (existing) {
        const keysChanged =
          existing.seriesKeys.size !== currentKeys.size ||
          [...currentKeys].some((k) => !existing.seriesKeys.has(k));
        if (!keysChanged) {
          continue;
        }
        this.cancelTopicSubscription(topic);
      }

      const cancel = this.subscribeMessageRange({
        topic,
        onNewRangeIterator: async (batchIterator) => {
          let isReset = true;
          for await (const batch of batchIterator) {
            if (this.destroyed) {
              return;
            }

            const startTime = this.startTime;

            if (!startTime) {
              continue;
            }
            builder.handleMessageRange!(batch, { isReset }, startTime);
            isReset = false;
            this.queueDispatchDownsample();
          }
        },
      });
      this.rangeSubscriptionCancels.set(topic, { cancel, seriesKeys: new Set(currentKeys) });
    }
  }
}
