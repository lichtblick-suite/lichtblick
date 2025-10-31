// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Log from "@lichtblick/log";
import ExtensionsAPI from "@lichtblick/suite-base/api/extensions/ExtensionsAPI";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
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

const log = Log.getLogger(__filename);

export class RemoteExtensionLoader implements IExtensionLoader {
  #remote: ExtensionsAPI;
  public readonly namespace: Namespace;
  public readonly type: TypeExtensionLoader = "server";
  public workspace: string;

  public constructor(namespace: Namespace, workspace: string) {
    this.namespace = namespace;
    this.workspace = workspace;

    this.#remote = new ExtensionsAPI(workspace);
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    log.debug("[Remote] Get extension", id);

    const storedExtension = await this.#remote.get(id);
    return storedExtension?.info;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    log.debug("[Remote] Listing extensions");
    return await this.#remote.list();
  }

  public async loadExtension(id: string): Promise<LoadedExtension> {
    log.debug("[Remote] Loading extension", id);

    const foxeFileData = await this.#remote.loadContent(id);
    if (!foxeFileData) {
      throw new Error("Extension is corrupted or does not exist in the file system.");
    }

    const decompressedData = await decompressFile(foxeFileData);
    const rawExtensionFile = await extractFoxeFileContent(
      decompressedData,
      ALLOWED_FILES.EXTENSION,
    );
    if (!rawExtensionFile) {
      throw new Error(`Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`);
    }

    return {
      buffer: foxeFileData,
      raw: rawExtensionFile,
    };
  }

  public async installExtension({
    foxeFileData,
    file,
  }: InstallExtensionProps): Promise<ExtensionInfo> {
    log.debug("[Remote] Installing extension", foxeFileData, file);

    if (!file) {
      throw new Error("File is required to install extension in server.");
    }

    const decompressedData = await decompressFile(foxeFileData);
    const rawPackageFile = await extractFoxeFileContent(decompressedData, ALLOWED_FILES.PACKAGE);
    if (!rawPackageFile) {
      throw new Error(
        `Corrupted extension. File "${ALLOWED_FILES.PACKAGE}" is missing in the extension source.`,
      );
    }

    const rawInfo = validatePackageInfo(JSON.parse(rawPackageFile) as Partial<ExtensionInfo>);
    const normalizedPublisher = rawInfo.publisher.replace(/[^A-Za-z0-9_\s]+/g, "");

    const newExtension: StoredExtension = {
      content: foxeFileData,
      info: {
        ...rawInfo,
        id: `${normalizedPublisher}.${rawInfo.name}`,
        namespace: rawInfo.namespace,
        qualifiedName: rawInfo.displayName || rawInfo.name,
        readme: (await extractFoxeFileContent(decompressedData, ALLOWED_FILES.README)) ?? "",
        changelog: (await extractFoxeFileContent(decompressedData, ALLOWED_FILES.CHANGELOG)) ?? "",
      },
      workspace: this.workspace,
    };

    const storedExtension = await this.#remote.createOrUpdate(newExtension, file);
    return storedExtension.info;
  }

  public async uninstallExtension(id: string): Promise<void> {
    log.debug("[Remote] Uninstalling extension", id);

    await this.#remote.remove(id);
  }
}
