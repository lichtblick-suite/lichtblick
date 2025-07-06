// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { ComlinkWrap } from "@lichtblick/den/worker";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { extendBounds1D, unionBounds1D } from "@lichtblick/suite-base/types/Bounds";
import { BlockTopicCursor } from "./BlockTopicCursor";
import { getChartValue, isChartValue } from "../utils/datum";
import { mathFunctions } from "../utils/mathFunctions";
// If the datasets builder is garbage collected we also need to cleanup the worker
// This registry ensures the worker is cleaned up when the builder is garbage collected
const registry = new FinalizationRegistry((dispose) => {
    dispose();
});
export class CustomDatasetsBuilder {
    #xParsedPath;
    #xValuesCursor;
    #datasetsBuilderRemote;
    #pendingDispatch = [];
    #lastSeekTime = 0;
    #series = [];
    #xCurrentBounds;
    #xFullBounds;
    constructor() {
        const worker = new Worker(
        // foxglove-depcheck-used: babel-plugin-transform-import-meta
        new URL("./CustomDatasetsBuilderImpl.worker", import.meta.url));
        const { remote, dispose } = ComlinkWrap(worker);
        this.#datasetsBuilderRemote = remote;
        registry.register(this, dispose);
    }
    handlePlayerState(state) {
        const activeData = state.activeData;
        if (!activeData) {
            return;
        }
        const didSeek = activeData.lastSeekTime !== this.#lastSeekTime;
        this.#lastSeekTime = activeData.lastSeekTime;
        let datasetsChanged = false;
        const msgEvents = activeData.messages;
        if (msgEvents.length > 0) {
            if (didSeek) {
                this.#pendingDispatch.push({
                    type: "reset-current-x",
                });
                this.#xCurrentBounds = undefined;
            }
            // Read the x-axis values
            if (this.#xParsedPath) {
                const mathFn = this.#xParsedPath.modifier
                    ? mathFunctions[this.#xParsedPath.modifier]
                    : undefined;
                const pathItems = readMessagePathItems(msgEvents, this.#xParsedPath, mathFn);
                this.#pendingDispatch.push({
                    type: "append-current-x",
                    items: pathItems,
                });
                if (pathItems.length > 0) {
                    datasetsChanged = true;
                    this.#xCurrentBounds = computeBounds(this.#xCurrentBounds, pathItems);
                }
            }
            for (const series of this.#series) {
                const mathFn = series.config.parsed.modifier
                    ? mathFunctions[series.config.parsed.modifier]
                    : undefined;
                if (didSeek) {
                    this.#pendingDispatch.push({
                        type: "reset-current",
                        series: series.config.key,
                    });
                }
                const pathItems = readMessagePathItems(msgEvents, series.config.parsed, mathFn);
                datasetsChanged ||= pathItems.length > 0;
                this.#pendingDispatch.push({
                    type: "append-current",
                    series: series.config.key,
                    items: pathItems,
                });
            }
        }
        const blocks = state.progress.messageCache?.blocks;
        if (blocks) {
            if (this.#xValuesCursor && this.#xParsedPath) {
                const mathFn = this.#xParsedPath.modifier
                    ? mathFunctions[this.#xParsedPath.modifier]
                    : undefined;
                if (this.#xValuesCursor.nextWillReset(blocks)) {
                    this.#pendingDispatch.push({
                        type: "reset-full-x",
                    });
                }
                let messageEvents = undefined;
                while ((messageEvents = this.#xValuesCursor.next(blocks)) != undefined) {
                    const pathItems = readMessagePathItems(messageEvents, this.#xParsedPath, mathFn);
                    this.#pendingDispatch.push({
                        type: "append-full-x",
                        items: pathItems,
                    });
                    if (pathItems.length > 0) {
                        datasetsChanged = true;
                        this.#xFullBounds = computeBounds(this.#xFullBounds, pathItems);
                    }
                }
            }
            for (const series of this.#series) {
                const mathFn = series.config.parsed.modifier
                    ? mathFunctions[series.config.parsed.modifier]
                    : undefined;
                if (series.blockCursor.nextWillReset(blocks)) {
                    this.#pendingDispatch.push({
                        type: "reset-full",
                        series: series.config.key,
                    });
                }
                let messageEvents = undefined;
                while ((messageEvents = series.blockCursor.next(blocks)) != undefined) {
                    const pathItems = readMessagePathItems(messageEvents, series.config.parsed, mathFn);
                    datasetsChanged ||= pathItems.length > 0;
                    this.#pendingDispatch.push({
                        type: "append-full",
                        series: series.config.key,
                        items: pathItems,
                    });
                }
            }
        }
        if (!this.#xCurrentBounds) {
            return {
                range: this.#xFullBounds ?? { min: 0, max: 1 },
                datasetsChanged,
            };
        }
        if (!this.#xFullBounds) {
            return {
                range: this.#xCurrentBounds,
                datasetsChanged,
            };
        }
        return {
            range: unionBounds1D(this.#xCurrentBounds, this.#xFullBounds),
            datasetsChanged,
        };
    }
    setXPath(path) {
        if (JSON.stringify(path) === JSON.stringify(this.#xParsedPath)) {
            return;
        }
        this.#xParsedPath = path;
        if (this.#xParsedPath) {
            this.#xValuesCursor = new BlockTopicCursor(this.#xParsedPath.topicName);
        }
        else {
            this.#xValuesCursor = undefined;
        }
        this.#pendingDispatch.push({
            type: "reset-current-x",
        });
        this.#pendingDispatch.push({
            type: "reset-full-x",
        });
    }
    setSeries(series) {
        this.#series = series.map((item) => {
            const existing = this.#series.find((existingItem) => existingItem.config.key === item.key);
            return {
                config: item,
                blockCursor: existing?.blockCursor ?? new BlockTopicCursor(item.parsed.topicName),
            };
        });
        this.#pendingDispatch.push({
            type: "update-series-config",
            seriesItems: series,
        });
    }
    async getViewportDatasets(viewport) {
        const dispatch = this.#pendingDispatch;
        if (dispatch.length > 0) {
            this.#pendingDispatch = [];
            await this.#datasetsBuilderRemote.updateData(dispatch);
        }
        return await this.#datasetsBuilderRemote.getViewportDatasets(viewport);
    }
    async getCsvData() {
        return await this.#datasetsBuilderRemote.getCsvData();
    }
}
function readMessagePathItems(events, path, mathFunction) {
    const out = [];
    for (const event of events) {
        if (event.topic !== path.topicName) {
            continue;
        }
        const items = simpleGetMessagePathDataItems(event, path);
        for (const item of items) {
            if (!isChartValue(item)) {
                continue;
            }
            const chartValue = getChartValue(item);
            if (chartValue == undefined) {
                continue;
            }
            const mathModified = mathFunction ? mathFunction(chartValue) : chartValue;
            out.push({
                value: mathModified,
                originalValue: mathFunction ? mathModified : item,
                receiveTime: event.receiveTime,
            });
        }
    }
    return out;
}
function accumulateBounds(acc, item) {
    extendBounds1D(acc, item.value);
    return acc;
}
function computeBounds(currentBounds, items) {
    const itemBounds = items.reduce(accumulateBounds, {
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
    });
    return unionBounds1D(currentBounds ?? { min: Number.MAX_VALUE, max: Number.MIN_VALUE }, itemBounds);
}
