// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { fillInGlobalVariablesInPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";

import { PlotParams, Messages, MetadataEnums, PlotDataItem, BasePlotPath } from "../internalTypes";
import { PlotData, EmptyPlotData, appendPlotData, buildPlotData, resolvePath } from "../plotData";

export type Accumulated = {
  data: PlotData;
};

export function getPathData(
  metadata: MetadataEnums,
  globalVariables: GlobalVariables,
  messages: Messages,
  path: BasePlotPath,
): PlotDataItem[] | undefined {
  const parsed = parseRosPath(path.value);
  if (parsed == undefined) {
    return [];
  }

  return resolvePath(
    metadata,
    messages[parsed.topicName] ?? [],
    fillInGlobalVariablesInPath(parsed, globalVariables),
  );
}

export function buildPlot(
  metadata: MetadataEnums,
  globalVariables: GlobalVariables,
  params: PlotParams,
  messages: Messages,
): PlotData {
  const { paths, invertedTheme, startTime, xAxisPath, xAxisVal } = params;
  return buildPlotData({
    invertedTheme,
    paths: paths.map((path) => [path, getPathData(metadata, globalVariables, messages, path)]),
    startTime,
    xAxisPath,
    xAxisData:
      xAxisPath != undefined
        ? getPathData(metadata, globalVariables, messages, xAxisPath)
        : undefined,
    xAxisVal,
  });
}

export function initAccumulated(): Accumulated {
  return {
    data: EmptyPlotData,
  };
}

export function accumulate(
  metadata: MetadataEnums,
  globalVariables: GlobalVariables,
  previous: Accumulated,
  params: PlotParams,
  messages: Messages,
): Accumulated {
  const { data: oldData } = previous;

  return {
    data: appendPlotData(oldData, buildPlot(metadata, globalVariables, params, messages)),
  };
}
