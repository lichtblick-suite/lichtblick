// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryLabels, TelemetryScope, TelemetryUnit } from "./types";

export type GaugeSeries = {
  metric: string;
  unit: TelemetryUnit;
  scope: TelemetryScope;
  labels: TelemetryLabels | undefined;
  value: number;
};

export type CounterSeries = {
  metric: string;
  unit: TelemetryUnit;
  scope: TelemetryScope;
  labels: TelemetryLabels | undefined;
  /** cumulative total since sink creation */
  total: number;
  /** `total` at the previous publish */
  lastPublishedTotal: number;
  publishedOnce: boolean;
};

/** Histogram-lite series fed by `observe()`. Derived metric names are built once at creation. */
export type ObservationSeries = {
  countMetric: string;
  sumMetric: string;
  maxMetric: string;
  unit: TelemetryUnit;
  scope: TelemetryScope;
  labels: TelemetryLabels | undefined;
  /** observations in the current publish window */
  windowCount: number;
  windowSum: number;
  windowMax: number;
  /** cumulative totals of all published windows */
  totalCount: number;
  totalSum: number;
};
