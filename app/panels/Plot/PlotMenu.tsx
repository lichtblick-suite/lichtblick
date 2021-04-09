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

import cx from "classnames";
import { useMemo, useRef } from "react";
import styled from "styled-components";

import Item from "@foxglove-studio/app/components/Menu/Item";
import PanelToolbarInput from "@foxglove-studio/app/components/PanelToolbarInput";
import { TimeBasedChartTooltipData } from "@foxglove-studio/app/components/TimeBasedChart";
import { PlotConfig, PlotXAxisVal } from "@foxglove-studio/app/panels/Plot";
import { DataSet, PlotChartPoint } from "@foxglove-studio/app/panels/Plot/PlotChart";
import { downloadFiles } from "@foxglove-studio/app/util";
import { formatTimeRaw } from "@foxglove-studio/app/util/time";

import styles from "./PlotMenu.module.scss";

const SLabel = styled.div`
  flex-grow: 1;
`;

const SFlexRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const SButton = styled.button`
  width: calc(100% - 0.2em);
`;

function isValidInput(value: string) {
  return value === "" || !isNaN(parseFloat(value));
}

function isValidWidth(value: string) {
  return value === "" || parseFloat(value) > 0;
}

function formatData(
  data: PlotChartPoint,
  dataIndex: number,
  label: string,
  datasetKey: string,
  tooltips: TimeBasedChartTooltipData[],
) {
  const { x, y } = data;
  const tooltip = tooltips.find((_tooltip) => _tooltip.datasetKey === datasetKey);
  if (!tooltip) {
    throw new Error("Cannot find tooltip for dataset: this should never happen");
  }
  const { receiveTime, headerStamp } = tooltip.item;
  const receiveTimeFloat = formatTimeRaw(receiveTime);
  const stampTime = headerStamp ? formatTimeRaw(headerStamp) : "";
  return [x, receiveTimeFloat, stampTime, label, y];
}

const xAxisCsvColumnName = (xAxisVal: PlotXAxisVal): string =>
  ({
    timestamp: "elapsed time",
    index: "index",
    custom: "x value",
    currentCustom: "x value",
  }[xAxisVal]);

export function getCSVData(
  datasets: DataSet[],
  tooltips: TimeBasedChartTooltipData[],
  xAxisVal: PlotXAxisVal,
): string {
  const headLine = [xAxisCsvColumnName(xAxisVal), "receive time", "header.stamp", "topic", "value"];
  const combinedLines = [];
  combinedLines.push(headLine);
  datasets.forEach((dataset) => {
    dataset.data.forEach((data, dataIndex) => {
      combinedLines.push(formatData(data, dataIndex, dataset.label, dataset.key, tooltips));
    });
  });
  return combinedLines.join("\n");
}

function downloadCsvFile(
  datasets: DataSet[],
  tooltips: TimeBasedChartTooltipData[],
  xAxisVal: PlotXAxisVal,
) {
  const csv = getCSVData(datasets, tooltips, xAxisVal);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadFiles([{ blob, fileName: `plot_data_export.csv` }]);
}

export default function PlotMenu({
  displayWidth,
  minYValue,
  maxYValue,
  saveConfig,
  setMinMax,
  setWidth,
  datasets,
  xAxisVal,
  tooltips,
}: {
  displayWidth: string;
  minYValue: string;
  maxYValue: string;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  setMinMax: (arg0: Partial<PlotConfig>) => void;
  setWidth: (arg0: Partial<PlotConfig>) => void;
  datasets: DataSet[];
  xAxisVal: PlotXAxisVal;
  tooltips: TimeBasedChartTooltipData[];
}) {
  // We want to avoid rerendering every frame, but datasets and tooltips change frequently. Create
  // stable refs (with values updated every frame) for the callbacks that need the data.
  const stableDatasets = useRef<DataSet[]>(datasets);
  stableDatasets.current = datasets;
  const stableTooltips = useRef<TimeBasedChartTooltipData[]>(tooltips);
  stableTooltips.current = tooltips;
  return useMemo(() => {
    const followWidthItem =
      xAxisVal === "timestamp" ? (
        <>
          <Item onClick={() => saveConfig({ followingViewWidth: "" })} tooltip="Plot width in sec">
            <SFlexRow>
              <SLabel>X range</SLabel>
              <PanelToolbarInput
                type="number"
                className={cx(styles.input, { [styles.inputError!]: !isValidWidth(displayWidth) })}
                value={displayWidth}
                onChange={({ target: { value } }) => {
                  const isZero = parseFloat(value) === 0;
                  saveConfig({ followingViewWidth: isZero ? "" : value });
                }}
                min="0"
                onClick={(event) => event.stopPropagation()}
                placeholder="auto"
              />
            </SFlexRow>
          </Item>
          <Item>
            <SButton onClick={setWidth as any}>Set to current view</SButton>
          </Item>
        </>
      ) : undefined;
    return (
      <>
        <Item
          onClick={() => downloadCsvFile(stableDatasets.current, stableTooltips.current, xAxisVal)}
        >
          Download plot data (csv)
        </Item>
        <hr />
        <Item isHeader>Zoom extents</Item>
        <Item
          onClick={() => saveConfig({ maxYValue: maxYValue === "" ? "10" : "" })}
          tooltip="Maximum y-axis value"
        >
          <SFlexRow>
            <SLabel>Y max</SLabel>
            <PanelToolbarInput
              type="number"
              className={cx(styles.input, { [styles.inputError!]: !isValidInput(maxYValue) })}
              value={maxYValue}
              onChange={(event) => {
                saveConfig({ maxYValue: event.target.value });
              }}
              onClick={(event) => event.stopPropagation()}
              placeholder="auto"
            />
          </SFlexRow>
        </Item>
        <Item
          onClick={() => saveConfig({ minYValue: minYValue === "" ? "-10" : "" })}
          tooltip="Minimum y-axis value"
        >
          <SFlexRow>
            <SLabel>Y min</SLabel>
            <PanelToolbarInput
              type="number"
              className={cx(styles.input, { [styles.inputError!]: !isValidInput(minYValue) })}
              value={minYValue}
              onChange={(event) => {
                saveConfig({ minYValue: event.target.value });
              }}
              onClick={(event) => event.stopPropagation()}
              placeholder="auto"
            />
          </SFlexRow>
        </Item>
        <Item>
          <SButton onClick={setMinMax as any}>Set to current view</SButton>
        </Item>
        {followWidthItem}
      </>
    );
  }, [xAxisVal, displayWidth, setWidth, maxYValue, minYValue, setMinMax, saveConfig]);
}
