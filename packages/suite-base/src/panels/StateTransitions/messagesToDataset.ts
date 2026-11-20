// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import {
  MessageAndData,
  MessagePathDataItem,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDataset } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { expandedLineColors } from "@lichtblick/suite-base/util/plotColors";
import { getTimestampForMessageEvent } from "@lichtblick/suite-base/util/time";

import positiveModulo from "./positiveModulo";
import { MessageDatasetArgs, ValidQueriedDataValue } from "./types";

export const baseColors = [...expandedLineColors];
const baseColorsLength = Object.values(baseColors).length;

/**
 * Processes messages into datasets. For performance reasons all values are condensed into a single
 * dataset with different labels and colors applied per-point.
 */
export function messagesToDataset(args: MessageDatasetArgs): ChartDataset {
  const builder = new StateTransitionDatasetBuilder(args);
  for (const messages of args.blocks) {
    if (messages) {
      builder.append(messages);
    }
  }
  return builder.dataset();
}

type Datum = ChartDataset["data"][0];

/**
 * Builds the same dataset as messagesToDataset, but messages can be appended in several calls so
 * that data arriving in batches is only processed once.
 */
export class StateTransitionDatasetBuilder {
  readonly #path: MessageDatasetArgs["path"];
  readonly #startTime: MessageDatasetArgs["startTime"];
  readonly #y: number;
  readonly #showPoints: boolean;
  readonly #data: Datum[] = [];
  #lastValue: ValidQueriedDataValue | undefined = undefined;
  // Last datum of the current segment, only added to the output once the segment ends.
  #lastDatum: Datum | undefined = undefined;
  #segmentColor = "";

  public constructor({
    path,
    startTime,
    y,
    showPoints,
  }: Pick<MessageDatasetArgs, "path" | "startTime" | "y" | "showPoints">) {
    this.#path = path;
    this.#startTime = startTime;
    this.#y = y;
    this.#showPoints = showPoints;
  }

  /** Processes `messages` starting at index `from`. */
  public append(messages: readonly MessageAndData[], from = 0): void {
    const { timestampMethod } = this.#path;
    const startTime = this.#startTime;
    for (let i = from; i < messages.length; i++) {
      const itemByPath = messages[i]!;
      const timestamp = getTimestampForMessageEvent(itemByPath.messageEvent, timestampMethod);
      if (!timestamp) {
        continue;
      }

      const queriedData = extractQueriedData(itemByPath);
      if (!queriedData) {
        continue;
      }

      const { constantName, value } = queriedData;
      // Same as toSec(subtract(timestamp, startTime)) without allocating a Time per message.
      const x = timestamp.sec - startTime.sec + (timestamp.nsec - startTime.nsec) * 1e-9;

      // A null value marks a gap: break the line here and start a fresh segment once data resumes.
      // eslint-disable-next-line @lichtblick/strict-equality
      if (value === null) {
        if (this.#lastDatum != undefined) {
          this.#data.push(this.#lastDatum);
        }
        this.#data.push({ x, y: Number.NaN });
        this.#lastValue = undefined;
        this.#lastDatum = undefined;
        continue;
      }

      if (!isValidValue(value)) {
        continue;
      }

      const isNewSegment = this.#lastValue !== value;
      if (isNewSegment) {
        this.#segmentColor = getColor(value);
      }

      this.#lastValue = value;
      this.#lastDatum = {
        x,
        y: this.#y,
        label: isNewSegment ? createLabel(constantName, value) : undefined,
        labelColor: this.#segmentColor,
        value,
        constantName,
      };

      if (isNewSegment || this.#showPoints) {
        this.#data.push(this.#lastDatum);

        // after we add a datum we clear the last datum so we don't try to add it again at the end
        this.#lastDatum = undefined;
      }
    }
  }

  /** Returns a new dataset with everything appended so far. */
  public dataset(): ChartDataset {
    const data = this.#data.slice();
    // If we never added the last datum (maybe because it was the same state as before), we add
    // it to the data so the user sees the state going until this point.
    if (this.#lastDatum != undefined) {
      data.push(this.#lastDatum);
    }
    return {
      borderWidth: 10,
      data,
      label: this.#path.label ?? this.#path.value,
      pointBackgroundColor: "rgba(0, 0, 0, 0.4)",
      pointBorderColor: "transparent",
      pointHoverRadius: 3,
      pointRadius: this.#showPoints ? 1.25 : 0,
      pointStyle: "circle",
      showLine: true,
    };
  }
}

export function extractQueriedData(itemByPath: MessageAndData): MessagePathDataItem | undefined {
  if (itemByPath.queriedData.length === 1) {
    return itemByPath.queriedData[0];
  }
  return undefined;
}

export function isValidValue(value: unknown): value is number | string | bigint | boolean {
  // Check if the type of `value` is one of the desired types and that it's not `NaN`
  // null is handled separately by the caller as a gap marker, not a valid state value.
  return (
    (typeof value === "number" && !Number.isNaN(value)) ||
    typeof value === "string" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  );
}

export function getColor(value: ValidQueriedDataValue): string {
  const valueForColor = typeof value === "string" ? stringHash(value) : Math.round(Number(value));
  return baseColors[positiveModulo(valueForColor, baseColorsLength)]!;
}

export function createLabel(
  constantName: string | undefined,
  value: ValidQueriedDataValue,
): string {
  return constantName != undefined ? `${constantName} (${String(value)})` : String(value);
}
