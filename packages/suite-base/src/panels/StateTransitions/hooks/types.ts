// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { PathState } from "@lichtblick/suite-base/panels/StateTransitions/types";

export type UseStateTransitionsData = {
  pathState: PathState[];
  data: {
    datasets: ChartDatasets;
  };
  minY: number | undefined;
};
