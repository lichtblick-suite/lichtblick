// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionInfoWorkspace } from "@lichtblick/suite-base/api/extensions/types";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class ExtensionBuilder {
  public static extensionInfo(props: Partial<ExtensionInfo> = {}): ExtensionInfo {
    return defaults<ExtensionInfo>(props, {
      description: BasicBuilder.string(),
      displayName: BasicBuilder.string(),
      homepage: BasicBuilder.string(),
      id: BasicBuilder.string(),
      keywords: BasicBuilder.strings(),
      license: BasicBuilder.string(),
      name: BasicBuilder.string(),
      namespace: BasicBuilder.sample(["local", "org"] as Namespace[]),
      publisher: BasicBuilder.string(),
      qualifiedName: BasicBuilder.string(),
      version: BasicBuilder.string(),
      readme: BasicBuilder.string(),
      changelog: BasicBuilder.string(),
    });
  }

  public static extensionsInfo(count = 3): ExtensionInfo[] {
    return BasicBuilder.multiple(ExtensionBuilder.extensionInfo, count);
  }

  public static extensionMarketplaceDetail(
    props: Partial<ExtensionMarketplaceDetail> = {},
  ): ExtensionMarketplaceDetail {
    return defaults<ExtensionMarketplaceDetail>(props, {
      ...this.extensionInfo(props),
      foxe: BasicBuilder.string(),
      sha256sum: BasicBuilder.string(),
      time: BasicBuilder.genericDictionary(String),
    });
  }

  public static storedExtension(props: Partial<StoredExtension> = {}): StoredExtension {
    return defaults<StoredExtension>(props, {
      content: new Uint8Array(BasicBuilder.numbers()),
      info: ExtensionBuilder.extensionInfo(),
    });
  }

  public static extensionInfoWorkspace(
    props: Partial<ExtensionInfoWorkspace> = {},
  ): ExtensionInfoWorkspace {
    return defaults<ExtensionInfoWorkspace>(props, {
      workspace: BasicBuilder.string(),
      info: ExtensionBuilder.extensionInfo(),
    });
  }
}
