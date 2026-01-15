// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@lichtblick/log";
import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";
import IAnalytics, { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

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
}
