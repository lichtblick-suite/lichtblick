// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CLIFlags } from "../common/types";

/**
 * Parses CLI flags from the process arguments and returns a readonly record.
 * Flags are expected to start with '--'.
 *
 * @param argv - The process arguments to parse (e.g., process.argv).
 * @returns A readonly record containing the flag names as keys and their corresponding values as strings.
 */
export function parseCLIFlags(argv: string[]): CLIFlags {
  const flags = argv.reduce<Record<string, string>>((prev, curr) => {
    if (curr.startsWith("--")) {
      const [key, value] = curr.slice(2).split("=");
      if (key && value) {
        prev[key] = value;
      }
    }
    return prev;
  }, {});

  return Object.freeze(flags);
}
