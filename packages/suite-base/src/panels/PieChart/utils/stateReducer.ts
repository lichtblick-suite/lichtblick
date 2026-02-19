// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { handleFrame } from "./handleFrame";
import { handlePath } from "./handlePath";
import { handleSeek } from "./handleSeek";
import type { PieChartState, PieChartAction } from "../types";

export function stateReducer(state: PieChartState, action: PieChartAction): PieChartState {
  switch (action.type) {
    case "frame":
      return handleFrame({ state, action });
    case "path":
      return handlePath({ state, action });
    case "seek":
      return handleSeek(state);
    default:
      return state;
  }
}
