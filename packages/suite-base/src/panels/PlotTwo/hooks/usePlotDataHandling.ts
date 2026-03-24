// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { CurrentCustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilderTwo } from "@lichtblick/suite-base/panels/Plot/builders/CustomDatasetsBuilderTwo";
import { IndexDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/IndexDatasetsBuilder";
import { TimestampDatasetsBuilderTwo } from "@lichtblick/suite-base/panels/Plot/builders/TimestampDatasetsBuilderTwo";
import { UsePlotDataHandling } from "@lichtblick/suite-base/panels/Plot/types";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { getLineColor } from "@lichtblick/suite-base/util/plotColors";

const usePlotDataHandling = (
  config: PlotConfig,
  globalVariables: GlobalVariables,
): UsePlotDataHandling => {
  const { xAxisVal, xAxisPath } = config;

  const datasetsBuilder = useMemo(() => {
    switch (xAxisVal) {
      case "timestamp":
        return new TimestampDatasetsBuilderTwo();
      case "index":
        return new IndexDatasetsBuilder();
      case "custom":
        return new CustomDatasetsBuilderTwo();
      case "currentCustom":
        return new CurrentCustomDatasetsBuilder();
      default:
        throw new Error(`unsupported mode: ${xAxisVal}`);
    }
  }, [xAxisVal]);

  useEffect(() => {
    if (
      datasetsBuilder instanceof CurrentCustomDatasetsBuilder ||
      datasetsBuilder instanceof CustomDatasetsBuilderTwo
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
      const item = config.paths[idx]!;
      labels[idx] = item.label ?? item.value;
      colors[idx] = getLineColor(item.color, idx);
    }

    return {
      colorsByDatasetIndex: colors,
      labelsByDatasetIndex: labels,
    };
  }, [config.paths]);

  return {
    colorsByDatasetIndex,
    labelsByDatasetIndex,
    datasetsBuilder,
  };
};

export default usePlotDataHandling;
