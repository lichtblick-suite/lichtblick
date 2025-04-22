// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { CurrentCustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CustomDatasetsBuilder";
import { UsePlotDataHandling } from "@lichtblick/suite-base/panels/Plot/types";
import { PIDPlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { getLineColor } from "@lichtblick/suite-base/util/plotColors";

import { IndexDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/IndexDatasetsBuilder";
import { TimestampDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/TimestampDatasetsBuilder";

const usePIDPlotDataHandling = (
  config: PIDPlotConfig,
  globalVariables: GlobalVariables,
): UsePlotDataHandling => {
  const { xAxisVal, xAxisPath } = config;

  const datasetsBuilder = useMemo(() => {
    switch (xAxisVal) {
      case "timestamp":
        return new TimestampDatasetsBuilder();
      case "index":
        return new IndexDatasetsBuilder();
      case "custom":
        return new CustomDatasetsBuilder();
      case "currentCustom":
        return new CurrentCustomDatasetsBuilder();
      default:
        throw new Error(`unsupported mode: ${xAxisVal}`);
    }
  }, [xAxisVal]);

  useEffect(() => {
    if (
      datasetsBuilder instanceof CurrentCustomDatasetsBuilder ||
      datasetsBuilder instanceof CustomDatasetsBuilder
    ) {
      if (!xAxisPath?.value) {
        datasetsBuilder.setXPath(undefined);
        return;
      }

      const parsed = parseMessagePath(xAxisPath.value);
      if (!parsed) {
        datasetsBuilder.setXPath(undefined);
        return;
      }

      datasetsBuilder.setXPath(fillInGlobalVariablesInPath(parsed, globalVariables));
    }
  }, [datasetsBuilder, globalVariables, xAxisPath]);

  const { colorsByDatasetIndex, labelsByDatasetIndex } = useMemo(() => {
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    for (let idx = 0; idx < config.paths.length; ++idx) {
      // console.log(config.paths[idx]);
      const item = config.paths[idx]!;
      labels[idx] = item.label ?? item.value;
      colors[idx] = getLineColor(item.color, idx);
    }
    for(let idx = 0; idx < config.pidline.length; ++idx){
      // console.log(config.pidline[idx])
      const item = config.pidline[idx];
      //@ts-ignore
      labels[idx+config.paths.length] = item.label ?? item.value;
      //@ts-ignore
      colors[idx+config.paths.length] = getLineColor(item.color, idx+config.paths.length);
    }

    return {
      colorsByDatasetIndex: colors,
      labelsByDatasetIndex: labels,
    };
  }, [config.paths,config.pidline]);


  return {
    colorsByDatasetIndex,
    labelsByDatasetIndex,
    datasetsBuilder,
  };
};

export default usePIDPlotDataHandling;
