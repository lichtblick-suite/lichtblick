// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { ComlinkWrap } from "@lichtblick/den/worker";
import { Immutable } from "@lichtblick/suite";

import { CsvDataset } from "./IDatasetsBuilder";

// If the datasets builder is garbage collected we also need to cleanup the worker.
// This shared registry ensures the worker is cleaned up when the builder is garbage collected.
const registry = new FinalizationRegistry<() => void>((dispose) => {
  dispose();
});

/**
 * Abstract base class for datasets builders that delegate work to a Comlink worker.
 *
 * Centralizes shared boilerplate:
 *  - Worker construction and FinalizationRegistry cleanup
 *  - The remote field and protected accessor
 *  - The pendingDispatch queue and drain helper
 *  - The getCsvData implementation
 */
export abstract class BaseWorkerDatasetsBuilder<
  TImpl extends { getCsvData(): CsvDataset[] },
  TAction,
> {
  protected readonly remote: Comlink.Remote<Comlink.RemoteObject<TImpl>>;

  protected pendingDispatch: Immutable<TAction>[] = [];

  protected constructor(worker: Worker) {
    const { remote, dispose } = ComlinkWrap<Comlink.RemoteObject<TImpl>>(worker);
    this.remote = remote;
    registry.register(this, dispose);
  }

  /**
   * Atomically swaps out the current pending dispatch list and returns it.
   * Call this at the start of getViewportDatasets before flushing to the remote.
   */
  protected drainPendingDispatch(): Immutable<TAction>[] {
    const dispatch = this.pendingDispatch;
    this.pendingDispatch = [];
    return dispatch;
  }

  public async getCsvData(): Promise<CsvDataset[]> {
    return await this.remote.getCsvData();
  }
}
