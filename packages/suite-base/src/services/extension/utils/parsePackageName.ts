// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export default function parsePackageName(name: string): { publisher?: string; name: string } {
  const match = new RegExp(/^@([^/]+)\/(.+)/).exec(name);
  if (!match) {
    return { name };
  }

  return { publisher: match[1], name: match[2]! };
}
