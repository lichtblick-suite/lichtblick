// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartDataset } from "chart.js";

import { MessagePath } from "@lichtblick/message-path";
import { Time } from "@lichtblick/rostime";
import { Immutable } from "@lichtblick/suite";
import { Datum } from "@lichtblick/suite-base/panels/Plot/utils/datum";

type DatumWithReceiveTime = Datum & {
  receiveTime: Time;
};

/**
 * Series item type shared by builders that work only with the current frame (no accumulation).
 * Used by IndexDatasetsBuilder and CurrentCustomDatasetsBuilder.
 */
export type CurrentFrameSeriesItem = {
  configIndex: number;
  enabled: boolean;
  messagePath: string;
  parsed: Immutable<MessagePath>;
  dataset: ChartDataset<"scatter", DatumWithReceiveTime[]>;
};
