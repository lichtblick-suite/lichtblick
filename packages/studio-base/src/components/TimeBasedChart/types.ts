// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ChartData } from "@foxglove/studio-base/components/Chart/types";

// alias types for convenience
type ChartDatasets = ChartData["datasets"];
type ChartDataset = ChartDatasets[0];
type ChartDatum = ChartDataset["data"][0];

export type { ChartData, ChartDatasets, ChartDataset, ChartDatum };
