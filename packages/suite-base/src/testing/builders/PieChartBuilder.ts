// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { PieChartConfig, PieChartState } from "@lichtblick/suite-base/panels/PieChart/types";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class PieChartBuilder {
  public static float32Array(length = 3): Float32Array {
    const numbers = BasicBuilder.multiple(() => BasicBuilder.float(0, 100), length);
    return new Float32Array(numbers);
  }

  public static pieChartConfig(props: Partial<PieChartConfig> = {}): PieChartConfig {
    return defaults<PieChartConfig>(props, {
      path: BasicBuilder.string(),
      title: BasicBuilder.string(),
      legend1: String(BasicBuilder.number()),
      legend2: String(BasicBuilder.number()),
      legend3: String(BasicBuilder.number()),
      legend4: String(BasicBuilder.number()),
      legend5: String(BasicBuilder.number()),
      legend6: String(BasicBuilder.number()),
      legend7: String(BasicBuilder.number()),
      legend8: String(BasicBuilder.number()),
      legend9: String(BasicBuilder.number()),
      legend10: String(BasicBuilder.number()),
    });
  }

  public static pieChartState(props: Partial<PieChartState> = {}): PieChartState {
    return defaults<PieChartState>(props, {
      path: BasicBuilder.string(),
      parsedPath: undefined,
      latestMessage: undefined,
      latestMatchingQueriedData: this.float32Array(),
      error: undefined,
      pathParseError: undefined,
    });
  }
}
