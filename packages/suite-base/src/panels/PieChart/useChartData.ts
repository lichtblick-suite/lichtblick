// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0
import { useMemo } from "react";

import type { PieChartConfig, PieChartDatum } from "./types";

export function useChartData(rawValue: Float32Array, config: PieChartConfig): PieChartDatum[] {
  return useMemo(() => {
    if (rawValue.length === 0) {
      return [];
    }

    const rawArray = Array.from(rawValue);
    const total = rawArray.reduce((sum, val) => sum + val, 0);

    return rawArray.map((value, index) => {
      const percentage = (value / total) * 100;
      const legendKey = `legend${index + 1}` as keyof PieChartConfig;
      const rawName = config[legendKey];
      const name = rawName && rawName.trim() !== "" ? rawName : `Data ${index + 1}`;

      return {
        name,
        value: percentage,
        color: `hsl(${(index / rawArray.length) * 40 + 200}, 20%, ${50 - index * 5}%)`,
      };
    });
  }, [rawValue, config]);
}
