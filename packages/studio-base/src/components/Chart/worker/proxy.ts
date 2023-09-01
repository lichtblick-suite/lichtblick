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

import { ChartData } from "chart.js";
import * as R from "ramda";

import { findIndices } from "../datasets";
import { TypedChartData, TypedData } from "../types";

type TypedDataSet = TypedChartData["datasets"][0];
type NormalDataSet = ChartData<"scatter">["datasets"][0];

function proxyDataset(dataset: TypedDataSet): NormalDataSet {
  const { data } = dataset;

  const length = R.pipe(
    R.map((v: TypedData) => v.x.length),
    R.sum,
  )(data);

  return {
    ...dataset,
    data: new Proxy(Object.seal([]), {
      isExtensible() {
        return false;
      },
      get(target, prop, __) {
        if (prop === "_chartjs") {
          return undefined;
        }

        if (prop === "length") {
          return length;
        }

        if (typeof prop !== "string") {
          // dangerous, but required for ChartJS to function properly
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return target[prop as any];
        }

        const index = parseInt(prop);
        if (index < 0 || index >= length) {
          return undefined;
        }

        const indices = findIndices(data, index);
        if (indices == undefined) {
          return undefined;
        }

        const [sliceIndex, offset] = indices;
        const slice = data[sliceIndex];
        if (slice == undefined) {
          return undefined;
        }

        const point: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(slice)) {
          point[key] = value[offset];
        }

        return point;
      },
    }),
  } as NormalDataSet;
}

export function proxyTyped(data: TypedChartData): ChartData<"scatter"> {
  return {
    ...data,
    datasets: R.map(proxyDataset, data.datasets),
  };
}
