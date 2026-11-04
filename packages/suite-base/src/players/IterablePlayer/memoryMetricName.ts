// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MEMORY_METRIC_PREFIX } from "./constants";

const NON_ALPHANUMERIC = /[^A-Za-z0-9]+/;

/**
 * Converts a free-form label (e.g. a `progress.memoryInfo` key such as "Buffered messages") to
 * lowerCamelCase: split on runs of non-alphanumeric characters, lower-case every word, then
 * upper-case the first letter of every word but the first ("Buffered messages" → "bufferedMessages",
 * "MCAP read-ahead" → "mcapReadAhead"). Returns "" when the input has no alphanumeric characters.
 */
export function toLowerCamelCase(label: string): string {
  let result = "";
  for (const part of label.split(NON_ALPHANUMERIC)) {
    if (part.length === 0) {
      continue;
    }
    const word = part.toLowerCase();
    result += result.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1);
  }
  return result;
}

// memoryInfo keys are a small fixed set of constants, so the cache stays tiny. `undefined` caches
// keys that normalize to nothing.
const memoryMetricNames = new Map<string, string | undefined>();

/**
 * Returns the `pipeline.memory.<lowerCamelCaseKey>` metric name for a `progress.memoryInfo` key,
 * computed once per key. Returns undefined for keys without any alphanumeric character, which
 * have no meaningful metric name and are not exported.
 */
export function memoryMetricName(key: string): string | undefined {
  if (memoryMetricNames.has(key)) {
    return memoryMetricNames.get(key);
  }
  const suffix = toLowerCamelCase(key);
  const metric = suffix.length > 0 ? MEMORY_METRIC_PREFIX + suffix : undefined;
  memoryMetricNames.set(key, metric);
  return metric;
}
