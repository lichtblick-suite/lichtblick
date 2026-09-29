// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BenchmarkPipelineKind } from "../dataSources/types";
import { LAYOUTS } from "../layouts";

/**
 * Identifies a registered `IDataSourceFactory` (by its `id` field) plus the params it needs to
 * initialize without user interaction. Kept generic so scenarios don't hard-code assumptions
 * about which factories are registered in `Root.tsx`.
 */
export type ScenarioDataSource = {
  factoryId: string;
  params?: Record<string, string>;
};

export type Scenario = {
  id: string;
  /** Key into `LAYOUTS` selecting the layout to install and select automatically. */
  layout: keyof typeof LAYOUTS;
  dataSource: ScenarioDataSource;
  pipeline: BenchmarkPipelineKind;
  /** Start playback automatically once the data source becomes present. */
  autoStart?: boolean;
  /** If set alongside `autoStart`, playback is paused this many milliseconds after starting. */
  durationMs?: number;
};
