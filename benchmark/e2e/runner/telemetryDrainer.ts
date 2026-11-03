// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { DRAIN_BATCH_SIZE, MAX_DRAINS_PER_TICK, MAX_TELEMETRY_DRAIN_ITERATIONS } from "./constants";
import type { LichtblickTelemetryWindow } from "../../src/telemetry/types";
import type { TelemetryBatch, TelemetryRecord } from "../result/schemaV1";

/** Page monotonic clock (`performance.timeOrigin + performance.now()`, same as telemetry). */
export async function pageNow(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const api = (window as LichtblickTelemetryWindow).lichtblickTelemetry;
    return api != undefined ? api.now() : performance.timeOrigin + performance.now();
  });
}

/** Collects the page's telemetry records through `window.lichtblickTelemetry.drain()`. */
export class TelemetryDrainer {
  public readonly records: TelemetryRecord[] = [];
  public dropped = 0;
  public realm = "renderer";
  readonly #page: Page;

  public constructor(page: Page) {
    this.#page = page;
  }

  /** Drains up to `maxDrains` batches; returns the number of records received. */
  public async drain(maxDrains = MAX_DRAINS_PER_TICK): Promise<number> {
    let received = 0;
    for (let i = 0; i < maxDrains; i++) {
      const batch: TelemetryBatch | undefined = await this.#page.evaluate(
        (max) => (window as LichtblickTelemetryWindow).lichtblickTelemetry?.drain(max),
        DRAIN_BATCH_SIZE,
      );
      if (batch == undefined) {
        break;
      }
      this.realm = batch.realm;
      this.dropped += batch.dropped;
      for (const record of batch.records) {
        this.records.push(record);
      }
      received += batch.records.length;
      if (batch.records.length < DRAIN_BATCH_SIZE) {
        break;
      }
    }
    return received;
  }

  public hasEvent(name: string, phase: string): boolean {
    return this.records.some(
      (record) => record.kind === "event" && record.name === name && record.phase === phase,
    );
  }
}

/** Drains until no record is returned (bounded). */
export async function drainUntilEmpty(drainer: TelemetryDrainer): Promise<void> {
  for (let i = 0; i < MAX_TELEMETRY_DRAIN_ITERATIONS; i++) {
    if ((await drainer.drain()) === 0) {
      return;
    }
  }
}
