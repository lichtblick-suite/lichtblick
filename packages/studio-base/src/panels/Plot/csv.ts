// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { downloadFiles } from "@foxglove/studio-base/util/download";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { DataSet, Datum } from "./internalTypes";
import { PlotXAxisVal } from "./types";

function getCSVRow(label: string | undefined, data: Datum) {
  const { x, y, receiveTime, headerStamp } = data;
  const receiveTimeFloat = formatTimeRaw(receiveTime);
  const stampTime = headerStamp ? formatTimeRaw(headerStamp) : "";
  return [x, receiveTimeFloat, stampTime, label, y];
}

const getCVSColName = (xAxisVal: PlotXAxisVal): string => {
  return {
    timestamp: "elapsed time",
    index: "index",
    custom: "x value",
    currentCustom: "x value",
  }[xAxisVal];
};

function getCSVData(datasets: DataSet[], xAxisVal: PlotXAxisVal): string {
  const headLine = [getCVSColName(xAxisVal), "receive time", "header.stamp", "topic", "value"];
  const combinedLines = [];
  combinedLines.push(headLine);
  for (const dataset of datasets) {
    for (const datum of dataset.data) {
      combinedLines.push(getCSVRow(dataset.label, datum));
    }
  }
  return combinedLines.join("\n");
}

function downloadCSV(datasets: DataSet[], xAxisVal: PlotXAxisVal): void {
  const csvData = getCSVData(datasets, xAxisVal);
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  downloadFiles([{ blob, fileName: `plot_data.csv` }]);
}

export { downloadCSV };
