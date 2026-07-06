// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

function isValidPart(x: string | number): boolean {
  return /^\d+$/.test(String(x));
}

export default function compareVersions(v1: string, v2: string): number {
  let v1parts: (string | number)[] = v1.split("."),
    v2parts: (string | number)[] = v2.split(".");

  if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
    return Number.NaN;
  }

  while (v1parts.length < v2parts.length) {
    v1parts.push("0");
  }
  while (v2parts.length < v1parts.length) {
    v2parts.push("0");
  }

  v1parts = v1parts.map(Number);
  v2parts = v2parts.map(Number);

  for (let i = 0; i < v1parts.length; ++i) {
    const part1 = v1parts[i];
    const part2 = v2parts[i];

    if (part1 === part2) {
      continue;
    } else if (part1! > part2!) {
      return 1;
    } else {
      return -1;
    }
  }

  return 0;
}
