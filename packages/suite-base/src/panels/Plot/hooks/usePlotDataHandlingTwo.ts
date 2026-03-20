// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { CurrentCustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CurrentCustomDatasetsBuilder";
import { CustomDatasetsBuilder } from "@lichtblick/suite-base/panels/Plot/builders/CustomDatasetsBuilder";
import { TimestampDatasetsBuilderV2 } from "@lichtblick/suite-base/panels/Plot/builders/TimestampDatasetsBuilderV2";
import { UsePlotDataHandling } from "@lichtblick/suite-base/panels/Plot/types";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { getLineColor } from "@lichtblick/suite-base/util/plotColors";

import { IndexDatasetsBuilder } from "../builders/IndexDatasetsBuilder";

/**
 * Like usePlotDataHandling, but uses TimestampDatasetsBuilderV2 for the "timestamp" x-axis mode.
 * TimestampDatasetsBuilderV2 uses subscribeMessageRange instead of the block loader.
 */
const usePlotDataHandlingTwo = (
  config: PlotConfig,
  globalVariables: GlobalVariables,
): UsePlotDataHandling => {
  const { xAxisVal, xAxisPath } = config;

  const datasetsBuilder = useMemo(() => {
    switch (xAxisVal) {
      case "timestamp":
        return new TimestampDatasetsBuilderV2();
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

export default usePlotDataHandlingTwo;
