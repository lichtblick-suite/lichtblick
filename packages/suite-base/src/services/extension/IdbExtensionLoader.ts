// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@lichtblick/log";
import {
  IExtensionStorage,
  StoredExtension,
} from "@lichtblick/suite-base/services/IExtensionStorage";
import {
  IExtensionLoader,
  InstallExtensionProps,
  LoadedExtension,
  TypeExtensionLoader,
} from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";
import decompressFile from "@lichtblick/suite-base/services/extension/utils/decompressFile";
import extractFoxeFileContent from "@lichtblick/suite-base/services/extension/utils/extractFoxeFileContent";
import validatePackageInfo from "@lichtblick/suite-base/services/extension/utils/validatePackageInfo";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

import { IdbExtensionStorage } from "./IdbExtensionStorage";

const log = Log.getLogger(__filename);

export class IdbExtensionLoader implements IExtensionLoader {
  readonly #storage: IExtensionStorage;
  public readonly namespace: Namespace;
  public readonly type: TypeExtensionLoader = "browser";

  public constructor(namespace: Namespace) {
    this.namespace = namespace;
    this.#storage = new IdbExtensionStorage(namespace);
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    log.debug("[IndexedDB] Get extension", id);

    const storedExtension = await this.#storage.get(id);
    return storedExtension?.info;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    log.debug("[IndexedDB] Listing extensions");

    return await this.#storage.list();
  }

  public async loadExtension(id: string): Promise<LoadedExtension> {
    log.debug("[IndexedDB] Loading extension", id);

    const extension: StoredExtension | undefined = await this.#storage.get(id);
    if (!extension) {
      throw new Error("Extension not found");
    }

    const decompressedData = await decompressFile(extension.content);
    const rawExtensionFile = await extractFoxeFileContent(
      decompressedData,
      ALLOWED_FILES.EXTENSION,
    );
    if (!rawExtensionFile) {
      throw new Error(`Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`);
    }

    return {
      raw: rawExtensionFile,
    };
  }

  public async installExtension({
    foxeFileData,
    externalId,
  }: InstallExtensionProps): Promise<ExtensionInfo> {
    log.debug("[IndexedDB] Installing extension");

    const decompressedData = await decompressFile(foxeFileData);
    const rawPackageFile = await extractFoxeFileContent(decompressedData, ALLOWED_FILES.PACKAGE);
    if (!rawPackageFile) {
      throw new Error(
        `Corrupted extension. File "${ALLOWED_FILES.PACKAGE}" is missing in the extension source.`,
      );
    }
    const readme = (await extractFoxeFileContent(decompressedData, ALLOWED_FILES.README)) ?? "";
    const changelog =
      (await extractFoxeFileContent(decompressedData, ALLOWED_FILES.CHANGELOG)) ?? "";

    const rawInfo = validatePackageInfo(JSON.parse(rawPackageFile) as Partial<ExtensionInfo>);
    const normalizedPublisher = rawInfo.publisher.replace(/[^A-Za-z0-9_\s]+/g, "");

    const newExtension: StoredExtension = {
      content: foxeFileData,
      info: {
        ...rawInfo,
        id: `${normalizedPublisher}.${rawInfo.name}`,
        namespace: this.namespace,
        qualifiedName: rawInfo.displayName || rawInfo.name,
        readme,
        changelog,
        externalId,
      },
    };
    const storedExtension = await this.#storage.put(newExtension);

    return storedExtension.info;
  }

  public async uninstallExtension(id: string): Promise<void> {
    log.debug("[IndexedDB] Uninstalling extension", id);

    await this.#storage.delete(id);
  }
}
