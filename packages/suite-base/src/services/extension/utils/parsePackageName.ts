// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PackageName } from "@lichtblick/suite-base/services/extension/types";

export default function parsePackageName(name: string): PackageName {
  const match = new RegExp(/^@([^/]+)\/(.+)/).exec(name);
  if (!match) {
    return { name };
  }

  return {
    name: match[2]!,
    publisher: match[1],
  };
}
