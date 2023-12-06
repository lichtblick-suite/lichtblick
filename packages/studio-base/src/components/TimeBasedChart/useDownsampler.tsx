// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import React, { useMemo, useCallback, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

import type { ObjectData, RpcScales } from "@foxglove/studio-base/components/Chart/types";

import { Downsampler } from "./Downsampler";
import { PlotDataProvider, ProviderStateSetter, PlotViewport, ChartDataset } from "./types";
import { getBounds } from "./useProvider";

/**
 * useDownsampler downsamples the given datasets before providing them to the
 * TimeBasedChart. This is used primarily for downsampling data passed into the
 * TimeBasedChart component without using a PlotDataProvider.
 */
export default function useDownsampler(datasets: ChartDataset[]): {
  downsampler: PlotDataProvider<ObjectData>;
  setScales: (scales: RpcScales) => void;
} {
  const [view, setView] = React.useState<PlotViewport | undefined>();
  const [setter, setSetter] = React.useState<ProviderStateSetter<ObjectData> | undefined>();

  const downsampler = useMemo(() => new Downsampler(), []);

  // Stable callback to run the downsampler and update the latest copy of the downsampled datasets
  const applyDownsample = useCallback(() => {
    if (setter == undefined) {
      return;
    }

    const downsampled = downsampler.downsample();
    if (downsampled == undefined) {
      return;
    }

    const bounds = getBounds(downsampled);
    if (bounds == undefined) {
      return;
    }

    setter({
      bounds,
      data: {
        datasets: downsampled,
      },
    });
  }, [setter, downsampler]);

  // Debounce calls to invoke the downsampler
  const queueDownsample = useDebouncedCallback(
    applyDownsample,
    100,
    // maxWait equal to debounce timeout makes the debounce act like a throttle
    // Without a maxWait - invocations of the debounced invalidate reset the countdown
    // resulting in no invalidation when scales are constantly changing (playback)
    { leading: false, maxWait: 100 },
  );

  const setScales = useCallback(
    (scales: RpcScales) => {
      downsampler.update({ scales });
      queueDownsample();
    },
    [downsampler, queueDownsample],
  );

  // Updates to the dataset bounds do not need to queue a downsample
  useEffect(() => {
    downsampler.update({ datasetBounds: view });
  }, [view, downsampler]);

  // Updates to the viewport or the datasets queue a downsample
  useEffect(() => {
    downsampler.update({ datasets });
    queueDownsample();
  }, [downsampler, datasets, queueDownsample]);

  return React.useMemo(() => {
    return {
      downsampler: {
        setView,
        // setSetter cannot take two arguments, so we can't just write
        // `register: setSetter`
        register: (newSetter) => {
          setSetter(() => newSetter);
        },
      },
      setScales,
    };
  }, [setScales]);
}
