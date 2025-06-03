// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Returns true if the input string can be parsed as a float or an integer using
// parseFloat(). Hex and octal numbers will return false.
export function isFloatOrInteger(n: string): boolean {
  if (n.startsWith("0") && n.length > 1) {
    if (n[1] === "x" || n[1] === "X" || n[1] === "o" || n[1] === "O") {
      return false;
    }
  }
  return !isNaN(parseFloat(n)) && isFinite(Number(n));
}
