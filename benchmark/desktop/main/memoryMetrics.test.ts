// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ProcessMetric } from "electron";

import { registerMemoryMetricsHandler } from "./memoryMetrics";
import { GET_MEMORY_METRICS_CHANNEL } from "../common/types";

describe("registerMemoryMetricsHandler", () => {
  it("registers a handler on the memory metrics channel that returns app.getAppMetrics()", async () => {
    // Given
    const metrics = [{ type: "Browser", pid: 123 }] as unknown as ProcessMetric[];
    const getAppMetrics = jest.fn().mockReturnValue(metrics);
    const handle = jest.fn();

    // When
    registerMemoryMetricsHandler({ handle }, { getAppMetrics });

    // Then
    expect(handle).toHaveBeenCalledTimes(1);
    const [channel, handler] = handle.mock.calls[0] as [string, () => ProcessMetric[]];
    expect(channel).toBe(GET_MEMORY_METRICS_CHANNEL);
    expect(handler()).toBe(metrics);
    expect(getAppMetrics).toHaveBeenCalledTimes(1);
  });
});
