// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
} from "chart.js";
import AnnotationPlugin from "chartjs-plugin-annotation";

import * as Comlink from "@lichtblick/comlink";
import { loadDefaultFont } from "@lichtblick/suite-base/panels/shared/loadFont";

import { ChartRenderer } from "./ChartRenderer";

type InitArgs = {
  canvas: OffscreenCanvas;
  devicePixelRatio: number;
  gridColor: string;
  tickColor: string;
};

export type Service<T> = {
  init(args: InitArgs): Promise<T>;
};

// Immediately start font loading in the Worker thread. Each ChartJSManager we instantiate will
// wait on this promise before instantiating a new Chart instance, which kicks off rendering
const fontLoaded = loadDefaultFont();

// Register the features we support globally on our chartjs instance
// Note: Annotation plugin must be registered, it does not work _inline_ (i.e. per instance)
Chart.register(
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  Filler,
  Tooltip,
  AnnotationPlugin,
);

Comlink.expose({
  async init(args) {
    await fontLoaded;
    return Comlink.proxy(new ChartRenderer(args));
  },
} satisfies Service<Comlink.LocalObject<ChartRenderer>>);
