// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useState } from "react";

import { getLegendCount, setLegendCount, subscribeLegendCount } from "./legendCountStore";

export function useLegendCount(): {
  legendCount: number;
  setLegendCount: (newCount: number) => void;
  increment: () => void;
  decrement: () => void;
} {
  const [count, setCount] = useState(getLegendCount());

  useEffect(() => {
    const unsubscribe = subscribeLegendCount(setCount);
    return unsubscribe;
  }, []);

  return {
    legendCount: count,
    setLegendCount,
    increment: () => {
      setLegendCount(getLegendCount() + 1);
    },
    decrement: () => {
      setLegendCount(Math.max(1, getLegendCount() - 1));
    },
  };
}
