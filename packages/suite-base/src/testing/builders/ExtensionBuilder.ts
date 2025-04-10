// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

export default class ExtensionBuilder {
  public static extension(props: Partial<ExtensionInfo> = {}): ExtensionInfo {
    return defaults<ExtensionInfo>(props, {
      description: BasicBuilder.string(),
      displayName: BasicBuilder.string(),
      homepage: BasicBuilder.string(),
      id: BasicBuilder.string(),
      keywords: BasicBuilder.strings(),
      license: BasicBuilder.string(),
      name: BasicBuilder.string(),
      namespace: BasicBuilder.sample(["local", "org"] as ExtensionNamespace[]),
      publisher: BasicBuilder.string(),
      qualifiedName: BasicBuilder.string(),
      version: BasicBuilder.string(),
    });
  }
}
