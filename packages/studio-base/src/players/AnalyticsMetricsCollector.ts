// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import { Time } from "@foxglove/rostime";
import {
  PlayerMetricsCollectorInterface,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import IAnalytics, { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

const log = Log.getLogger(__filename);

type EventData = { [key: string]: string | number | boolean };

export default class AnalyticsMetricsCollector implements PlayerMetricsCollectorInterface {
  #metadata: EventData = {};
  #analytics: IAnalytics;

  public constructor(analytics: IAnalytics) {
    log.debug("New AnalyticsMetricsCollector");
    this.#analytics = analytics;
  }

  public setProperty(key: string, value: string | number | boolean): void {
    this.#metadata[key] = value;
  }

  public logEvent(event: AppEvent, data?: EventData): void {
    void this.#analytics.logEvent(event, { ...this.#metadata, ...data });
  }

  public playerConstructed(): void {
    this.logEvent(AppEvent.PLAYER_CONSTRUCTED);
  }

  public play(speed: number): void {
    this.logEvent(AppEvent.PLAYER_PLAY, { speed });
  }

  public seek(_time: Time): void {
    // NOTE: This event fires in more cases than user interaction
  }

  public setSpeed(_speed: number): void {
    // NOTE: This event fires in more cases than user interaction
  }

  public pause(): void {
    this.logEvent(AppEvent.PLAYER_PAUSE);
  }

  public close(): void {
    this.logEvent(AppEvent.PLAYER_CLOSE);
  }

  public setSubscriptions(_subscriptions: SubscribePayload[]): void {}

  public recordBytesReceived(_bytes: number): void {}

  public recordPlaybackTime(_time: Time, _params: { stillLoadingData: boolean }): void {}

  public recordDataProviderPerformance(
    _metadata: Readonly<{
      type: "average_throughput";
      totalSizeOfMessages: number;
      numberOfMessages: number;
      requestedRangeDuration: Time;
      receivedRangeDuration: Time;
      topics: readonly string[];
      totalTransferTime: Time;
    }>,
  ): void {}

  public recordUncachedRangeRequest(): void {}

  public recordTimeToFirstMsgs(): void {}

  public recordDataProviderInitializePerformance(
    _metadata: Readonly<{
      type: "initializationPerformance";
      dataProviderType: string;
      metrics: { [metricName: string]: string | number };
    }>,
  ): void {}

  public recordDataProviderStall(
    _metadata: Readonly<{
      type: "data_provider_stall";
      stallDuration: Time;
      requestTimeUntilStall: Time;
      transferTimeUntilStall: Time;
      bytesReceivedBeforeStall: number;
    }>,
  ): void {}
}
