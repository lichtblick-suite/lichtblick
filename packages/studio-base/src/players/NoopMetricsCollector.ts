// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { Time } from "@foxglove/rostime";
import {
  PlayerMetricsCollectorInterface,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

export default class NoopMetricsCollector implements PlayerMetricsCollectorInterface {
  public setProperty(_key: string, _value: string | number | boolean): void {
    // no-op
  }
  public playerConstructed(): void {
    // no-op
  }
  public initialized(_args?: { isSampleDataSource: boolean }): void {
    // no-op
  }
  public play(_speed: number): void {
    // no-op
  }
  public seek(_time: Time): void {
    // no-op
  }
  public setSpeed(_speed: number): void {
    // no-op
  }
  public pause(): void {
    // no-op
  }
  public close(): void {
    // no-op
  }
  public setSubscriptions(_subscriptions: SubscribePayload[]): void {
    // no-op
  }
  public recordPlaybackTime(_time: Time): void {
    // no-op
  }
  public recordBytesReceived(_bytes: number): void {
    // no-op
  }
  public recordDataProviderPerformance(): void {
    // no-op
  }
  public recordUncachedRangeRequest(): void {
    // no-op
  }
  public recordTimeToFirstMsgs(): void {
    // no-op
  }
  public recordDataProviderInitializePerformance(): void {
    // no-op
  }
  public recordDataProviderStall(): void {
    // no-op
  }
}
