// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
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
import { Chart } from "chart.js";
import DatalabelPlugin from "chartjs-plugin-datalabels";
import EventEmitter from "eventemitter3";
import { Zoom as ZoomPlugin } from "@lichtblick/chartjs-plugin-zoom";
import Logger from "@lichtblick/log";
import { addEventListener, removeEventListener, } from "@lichtblick/suite-base/components/Chart/worker/eventHandler";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";
import { fontMonospace } from "@lichtblick/theme";
import { lineSegmentLabelColor } from "./lineSegments";
import { proxyTyped } from "./proxy";
const log = Logger.getLogger(__filename);
/**
 * Chart.js WebWorkerマネージャー
 *
 * WebWorker内でChart.jsインスタンスを管理し、メインスレッドとの
 * RPC通信を通じてチャートの描画・更新・イベント処理を行います。
 *
 * ## 主な機能
 * - Chart.jsインスタンスの初期化・管理
 * - OffscreenCanvasでの描画
 * - マウス・タッチイベントの処理
 * - ズーム・パン操作の対応
 * - 高解像度ディスプレイ対応
 * - カスタムインタラクションモードの実装
 *
 * ## アーキテクチャ
 * - WebWorkerスレッドで実行
 * - RPC通信でメインスレッドと連携
 * - 偽のDOMイベントシステムを実装
 * - Chart.jsプラグインとの統合
 *
 * @example
 * ```typescript
 * // WebWorker内での使用例
 * const manager = new ChartJSManager({
 *   id: 'chart-1',
 *   node: { canvas: offscreenCanvas },
 *   type: 'scatter',
 *   data: chartData,
 *   options: chartOptions,
 *   devicePixelRatio: 2,
 *   fontLoaded: fontPromise
 * });
 * ```
 */
export default class ChartJSManager {
    #chartInstance;
    #fakeNodeEvents = new EventEmitter();
    #fakeDocumentEvents = new EventEmitter();
    #lastDatalabelClickContext;
    constructor(initOpts) {
        log.info(`new ChartJSManager(id=${initOpts.id})`);
        void this.init(initOpts);
    }
    async init({ id, node, type, data, options, devicePixelRatio, fontLoaded, }) {
        const font = await fontLoaded;
        log.debug(`ChartJSManager(${id}) init, default font "${font.family}" status=${font.status}`);
        if (data != undefined) {
            for (const ds of data.datasets) {
                ds.segment = {
                    borderColor: lineSegmentLabelColor,
                };
            }
        }
        const fakeNode = {
            addEventListener: addEventListener(this.#fakeNodeEvents),
            removeEventListener: removeEventListener(this.#fakeNodeEvents),
            ownerDocument: {
                addEventListener: addEventListener(this.#fakeDocumentEvents),
                removeEventListener: removeEventListener(this.#fakeDocumentEvents),
            },
        };
        const origZoomStart = ZoomPlugin.start?.bind(ZoomPlugin);
        ZoomPlugin.start = (chartInstance, args, pluginOptions) => {
            // swap the canvas with our fake dom node canvas to support zoom plugin addEventListener
            const ctx = chartInstance.ctx;
            // @ts-expect-error - WebWorker環境でのChart.js互換性のため
            chartInstance.ctx = {
                canvas: fakeNode,
            };
            // @ts-expect-error - ZoomPlugin型定義の不整合のため
            const res = origZoomStart?.(chartInstance, args, pluginOptions);
            // @ts-expect-error - WebWorker環境でのChart.js互換性のため
            chartInstance.ctx = ctx;
            return res;
        };
        const fullOptions = {
            ...this.#addFunctionsToConfig(options ?? {}),
            devicePixelRatio,
            font: { family: fontMonospace },
            // we force responsive off since we manually trigger width/height updates on the chart
            // responsive mode does not work properly with offscreen canvases and retina device pixel ratios
            // it results in a run-away canvas that keeps doubling in size!
            responsive: false,
        };
        const chartInstance = new Chart(node.canvas, {
            type,
            data: data ?? { datasets: [] },
            options: fullOptions,
            plugins: [DatalabelPlugin, ZoomPlugin],
        });
        ZoomPlugin.start = origZoomStart;
        this.#chartInstance = chartInstance;
    }
    wheel(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        this.#fakeNodeEvents.emit("wheel", event);
        return this.getScales();
    }
    mousedown(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        this.#fakeNodeEvents.emit("mousedown", event);
        return this.getScales();
    }
    mousemove(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        this.#fakeNodeEvents.emit("mousemove", event);
        return this.getScales();
    }
    mouseup(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        this.#fakeDocumentEvents.emit("mouseup", event);
        return this.getScales();
    }
    panstart(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        maybeCast(this.#chartInstance)?.$zoom.panStartHandler(event);
        return this.getScales();
    }
    panmove(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        maybeCast(this.#chartInstance)?.$zoom.panHandler(event);
        return this.getScales();
    }
    panend(event) {
        const target = event.target;
        target.getBoundingClientRect = () => target.boundingClientRect;
        maybeCast(this.#chartInstance)?.$zoom.panEndHandler(event);
        return this.getScales();
    }
    update({ options, width, height, isBoundsReset, data, typedData, }) {
        const instance = this.#chartInstance;
        if (instance == undefined) {
            return {};
        }
        for (const ds of data?.datasets ?? []) {
            // Apply a line segment coloring function, if the label color is present in the data points.
            // This has to happen here because functions can't be serialized to the chart worker. The
            // state transition panel uses this to apply different colors to each segment of a single
            // line.
            ds.segment = {
                borderColor: lineSegmentLabelColor,
            };
        }
        if (options != undefined) {
            instance.options.plugins = this.#addFunctionsToConfig(options).plugins;
            // Let the chart manage its own scales unless we've been told to reset or if an explicit
            // min and max have been specified.
            const scales = options.scales ?? {};
            if ((isBoundsReset || (scales.x?.min != undefined && scales.x.max != undefined)) &&
                instance.options.scales) {
                instance.options.scales.x = scales.x;
            }
            if ((isBoundsReset || (scales.y?.min != undefined && scales.y.max != undefined)) &&
                instance.options.scales) {
                instance.options.scales.y = scales.y;
            }
        }
        if (width != undefined || height != undefined) {
            let shouldResize = false;
            const wholeWidth = Math.floor(width ?? instance.width);
            const wholeHeight = Math.floor(height ?? instance.height);
            // Internally chartjs rounds width and height before updating the instance.
            // If our update has decimal width and height that will cause a resize on every update.
            // To avoid this we truncate the decimal from the width and height to present chartjs with whole
            // numbers.
            if (width != undefined) {
                if (Math.abs(instance.width - wholeWidth) > Number.EPSILON) {
                    instance.canvas.width = wholeWidth;
                    shouldResize = true;
                }
            }
            if (height != undefined) {
                if (Math.abs(instance.height - wholeHeight) > Number.EPSILON) {
                    instance.canvas.height = wholeHeight;
                    shouldResize = true;
                }
            }
            if (shouldResize) {
                instance.resize(wholeWidth, wholeHeight);
            }
        }
        if (data != undefined) {
            instance.data = data;
        }
        else if (typedData != undefined) {
            instance.data = proxyTyped(typedData);
        }
        // While the chartjs API doesn't indicate update should be called after resize, in practice
        // we've found that performing a resize after an update sometimes results in a blank chart.
        //
        // NOTE: "none" disables animations - this is important for chart performance because we update
        // the entire data set which does not preserve history for the chart animations
        instance.update("none");
        return this.getScales();
    }
    destroy() {
        this.#chartInstance?.destroy();
    }
    getElementsAtEvent({ event }) {
        const ev = {
            native: true,
            x: event.clientX,
            y: event.clientY,
        };
        // ev is cast to any because the typings for getElementsAtEventForMode are wrong
        // ev is specified as a dom Event - but the implementation does not require it for the basic platform
        const elements = this.#chartInstance?.getElementsAtEventForMode(ev, this.#chartInstance.options.interaction?.mode ?? "intersect", this.#chartInstance.options.interaction ?? {}, false) ?? [];
        const out = new Array();
        for (const element of elements) {
            const data = this.#chartInstance?.data?.datasets[element.datasetIndex]?.data[element.index];
            if (data == undefined || typeof data === "number") {
                continue;
            }
            // turn into an object we can send over the rpc
            out.push({
                data,
                datasetIndex: element.datasetIndex,
                index: element.index,
                view: {
                    x: element.element.x,
                    y: element.element.y,
                },
            });
        }
        // sort elements by proximity to the cursor
        out.sort((itemA, itemB) => {
            const dxA = event.clientX - itemA.view.x;
            const dyA = event.clientY - itemA.view.y;
            const dxB = event.clientX - itemB.view.x;
            const dyB = event.clientY - itemB.view.y;
            const distSquaredA = dxA * dxA + dyA * dyA;
            const distSquaredB = dxB * dxB + dyB * dyB;
            return distSquaredA - distSquaredB;
        });
        return out;
    }
    getDatalabelAtEvent({ event }) {
        this.#chartInstance?.notifyPlugins("beforeEvent", { event });
        // clear the stored click context - we have consumed it
        const context = this.#lastDatalabelClickContext;
        this.#lastDatalabelClickContext = undefined;
        return context?.dataset.data[context.dataIndex];
    }
    // get the current chart scales in an rpc friendly format
    // all rpc methods return the current chart scale since that is the main thing that could change automatically
    getScales() {
        const scales = {};
        // fill our rpc scales - we only support x and y scales for now
        const xScale = this.#chartInstance?.scales.x;
        if (xScale) {
            scales.x = {
                pixelMin: xScale.left,
                pixelMax: xScale.right,
                min: xScale.min,
                max: xScale.max,
            };
        }
        const yScale = this.#chartInstance?.scales.y;
        if (yScale) {
            scales.y = {
                pixelMin: yScale.bottom,
                pixelMax: yScale.top,
                min: yScale.min,
                max: yScale.max,
            };
        }
        return scales;
    }
    // We cannot serialize functions over rpc, we add options that require functions here
    #addFunctionsToConfig(config) {
        const datalabelsOptions = config.plugins?.datalabels;
        if (datalabelsOptions) {
            // process _click_ events to get the label we clicked on
            // this is because datalabels does not export any public methods to lookup the clicked label
            // maybe we contribute a patch upstream with the explanation for web-worker use
            datalabelsOptions.listeners = {
                click: (context) => {
                    this.#lastDatalabelClickContext = context;
                },
            };
            // Only display labels for datapoints that include a "label" property
            datalabelsOptions.formatter = (value, _context) => {
                // Return "null" if we don't want this label to be displayed.
                // Returning "undefined" falls back to the default formatting and will display
                // eslint-disable-next-line no-restricted-syntax
                return value.label ?? null;
            };
            // Override color so that it can be set per-dataset.
            const staticColor = datalabelsOptions.color ?? "white";
            datalabelsOptions.color = (context) => {
                const value = context.dataset.data[context.dataIndex];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return value?.labelColor ?? staticColor;
            };
        }
        return config;
    }
}
