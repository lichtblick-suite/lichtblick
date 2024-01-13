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
import * as Comlink from "comlink";

import PlexMono from "@foxglove/studio-base/styles/assets/PlexMono.woff2";

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

// Explicitly load the "Plex Mono" font, since custom fonts from the main renderer are not inherited
// by web workers. This is required to draw "Plex Mono" on an OffscreenCanvas, and it also appears
// to fix a crash a large portion of Windows users were seeing where the rendering thread would
// crash in skia code related to DirectWrite font loading when the system display scaling is set
// >100%. For more info on this crash, see util/waitForFonts.ts.
async function loadDefaultFont(): Promise<FontFace> {
  // Passing a `url(data:...) format('woff2')` string does not work in Safari, which complains it
  // cannot load the data url due to it being cross-origin.
  // https://bugs.webkit.org/show_bug.cgi?id=265000
  const fontFace = new FontFace("IBM Plex Mono", await (await fetch(PlexMono)).arrayBuffer());
  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    (self as unknown as WorkerGlobalScope).fonts.add(fontFace);
  } else {
    document.fonts.add(fontFace);
  }
  return await fontFace.load();
}

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
