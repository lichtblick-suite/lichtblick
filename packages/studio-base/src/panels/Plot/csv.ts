// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { iterateTyped } from "@foxglove/studio-base/components/Chart/datasets";
import { downloadFiles } from "@foxglove/studio-base/util/download";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { TypedDataSet, Datum, PlotXAxisVal } from "./internalTypes";

function getCSVRow(label: string | undefined, data: Datum) {
  const { x, value, receiveTime, headerStamp } = data;
  const receiveTimeFloat = formatTimeRaw(receiveTime);
  const stampTime = headerStamp ? formatTimeRaw(headerStamp) : "";
  return [x, receiveTimeFloat, stampTime, label, value];
}

const getCVSColName = (xAxisVal: PlotXAxisVal): string => {
  return {
    timestamp: "elapsed time",
    index: "index",
    custom: "x value",
    currentCustom: "x value",
  }[xAxisVal];
};

function generateCSV(datasets: TypedDataSet[], xAxisVal: PlotXAxisVal): string {
  const headLine = [getCVSColName(xAxisVal), "receive time", "header.stamp", "topic", "value"];
  const combinedLines = [];
  combinedLines.push(headLine);
  for (const dataset of datasets) {
    for (const datum of iterateTyped(dataset.data)) {
      combinedLines.push(getCSVRow(dataset.label, datum));
    }
  }
  return combinedLines.join("\n");
}

function downloadCSV(datasets: TypedDataSet[], xAxisVal: PlotXAxisVal): void {
  const csvData = generateCSV(datasets, xAxisVal);
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  downloadFiles([{ blob, fileName: `plot_data.csv` }]);
}

export { downloadCSV, generateCSV };
