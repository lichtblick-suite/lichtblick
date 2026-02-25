// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export class RequestQueue {
  #maxConcurrent: number;
  #activeCount = 0;
  #queue: Array<() => void> = [];

  public constructor(maxConcurrent: number = 2) {
    this.#maxConcurrent = maxConcurrent;
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.#activeCount >= this.#maxConcurrent) {
      await new Promise<void>((resolve) => this.#queue.push(resolve));
    }

    this.#activeCount++;
    try {
      return await fn();
    } finally {
      this.#activeCount--;
      const next = this.#queue.shift();
      if (next) {
        next();
      }
    }
  }
}

// Global queue for all HTTP requests
export const globalRequestQueue = new RequestQueue(2);
