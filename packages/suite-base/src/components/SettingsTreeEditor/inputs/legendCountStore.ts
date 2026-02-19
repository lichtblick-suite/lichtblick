// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

let legendCount = 10;
let listeners: ((count: number) => void)[] = [];

export function getLegendCount(): number {
  return legendCount;
}

export function setLegendCount(newCount: number): void {
  legendCount = newCount;
  listeners.forEach((cb) => {
    cb(legendCount);
  });
}

export function subscribeLegendCount(cb: (count: number) => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((listener) => listener !== cb);
  };
}
