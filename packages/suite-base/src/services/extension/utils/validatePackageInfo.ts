// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import parsePackageName from "@lichtblick/suite-base/services/extension/utils/parsePackageName";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export default function validatePackageInfo(info: Partial<ExtensionInfo>): ExtensionInfo {
  if (!info.name || info.name.length === 0) {
    throw new Error("Invalid extension: missing name");
  }
  const { publisher: parsedPublisher, name } = parsePackageName(info.name);
  const publisher = info.publisher ?? parsedPublisher;
  if (!publisher || publisher.length === 0) {
    throw new Error("Invalid extension: missing publisher");
  }

  return { ...info, publisher, name: name.toLowerCase() } as ExtensionInfo;
}
