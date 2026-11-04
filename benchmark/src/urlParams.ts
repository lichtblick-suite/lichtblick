// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Value of the `?<name>=<number>` page URL param; undefined when absent, blank or not a positive
 * finite number.
 */
export function parsePositiveNumberParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw == undefined || raw.trim() === "") {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
