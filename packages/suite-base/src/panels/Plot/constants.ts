// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AnnotationOptions } from "chartjs-plugin-annotation";

import {

  PIDLinePlotPath,
  PIDPlotPath,
  PlotConfig,
  PlotPath
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import { MathFunction } from "@lichtblick/suite-base/panels/Plot/utils/mathFunctions";
import { PanelConfig } from "@lichtblick/suite-base/types/panels";
import { nanoid } from "nanoid";


export const MATH_FUNCTIONS: { [fn: string]: MathFunction } = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  log: Math.log,
  log1p: Math.log1p,
  log2: Math.log2,
  log10: Math.log10,
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
  trunc: Math.trunc,
};

export const DEFAULT_SIDEBAR_DIMENSION = 240;

export const DEFAULT_ANNOTATION: AnnotationOptions = {
  type: "line",
  display: true,
  drawTime: "beforeDatasetsDraw",
  scaleID: "y",
  borderWidth: 1,
  borderDash: [5, 5],
};

// @ts-ignore
export const DEFAULT_PLOT_CONFIG: PlotConfig = {
  paths: [],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: DEFAULT_SIDEBAR_DIMENSION,
};

export interface TriplePlotConfig extends PanelConfig {
  plot1: PlotConfig;
  plot2: PlotConfig;
  plot3: PlotConfig;
}


export const DEFAULT_PLOT_PATH: PlotPath = Object.freeze({
  timestampMethod: "receiveTime",
  value: "",
  enabled: true,

});

export const DEFAULT_PIDPLOT_PATH: PIDPlotPath = Object.freeze({
  id: nanoid(),
  timestampMethod: "receiveTime",
  value: "",
  enabled: true,
  pidtype: "pnumber",
});



export const DEFAULT_PIDLINEPLOT_PATH: PIDLinePlotPath = Object.freeze({
  id:nanoid(),
  label:"预定轨迹绘制",
  timestampMethod: "receiveTime",
  value: "",
  enabled: true,
  pidtype: "pnumber",
  kp: 0.1,
  ki: 0.1,
  kd: 0.1,
});
export const DEFAULT_PLOT_CONFIG1: PlotConfig = {
  paths: [],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: DEFAULT_SIDEBAR_DIMENSION,
};
export const DEFAULT_PLOT_CONFIG2: PlotConfig = {
  paths: [],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: DEFAULT_SIDEBAR_DIMENSION,
};
export const DEFAULT_PLOT_CONFIG3: PlotConfig = {
  paths: [],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: DEFAULT_SIDEBAR_DIMENSION,
};
export const DEFAULT_TRIPLE_PLOT_CONFIG: TriplePlotConfig = {
  plot1: DEFAULT_PLOT_CONFIG1,
  plot2: DEFAULT_PLOT_CONFIG2,
  plot3: DEFAULT_PLOT_CONFIG3,
};