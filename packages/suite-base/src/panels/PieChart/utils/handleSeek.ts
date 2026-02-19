// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import type { PieChartState } from "../types";

export function handleSeek(state: PieChartState): PieChartState {
  return {
    ...state,
    latestMessage: undefined,
    latestMatchingQueriedData: undefined,
    error: undefined,
  };
}
