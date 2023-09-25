// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as R from "ramda";

import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";

import { PlotParams, BasePlotPath, PlotPath } from "./internalTypes";

export function getPaths(paths: readonly PlotPath[], xAxisPath?: BasePlotPath): string[] {
  return R.chain(
    (path: BasePlotPath | undefined): string[] => {
      if (path == undefined) {
        return [];
      }

      return [path.value];
    },
    [xAxisPath, ...paths],
  );
}

export function isSingleMessage(params: PlotParams): boolean {
  const { xAxisVal } = params;
  return xAxisVal === "currentCustom" || xAxisVal === "index";
}

export function getParamPaths(params: PlotParams): readonly string[] {
  return getPaths(params.paths, params.xAxisPath);
}

type ParsedPath = {
  parsed: RosPath;
  value: string;
};

export function getParamTopics(params: PlotParams): readonly string[] {
  return R.pipe(
    R.chain((path: string): ParsedPath[] => {
      const parsed = parseRosPath(path);
      if (parsed == undefined) {
        return [];
      }

      return [
        {
          parsed,
          value: path,
        },
      ];
    }),
    R.map((v: ParsedPath) => v.parsed.topicName),
    R.uniq,
  )(getParamPaths(params));
}
