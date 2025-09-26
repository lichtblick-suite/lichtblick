// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import Log from "@lichtblick/log";
import ExtensionsAPI from "@lichtblick/suite-base/api/extensions/ExtensionsAPI";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import {
  ExtensionLoader,
  LoadedExtension,
} from "@lichtblick/suite-base/services/extension/ExtensionLoader";
import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";
import getFileContent from "@lichtblick/suite-base/services/extension/utils/getFileContent";
import qualifiedName from "@lichtblick/suite-base/services/extension/utils/qualifiedName";
import validatePackageInfo from "@lichtblick/suite-base/services/extension/utils/validatePackageInfo";
import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

const log = Log.getLogger(__filename);

export class RemoteExtensionLoader implements ExtensionLoader {
  #remote: ExtensionsAPI;
  public readonly namespace: ExtensionNamespace;
  public remoteNamespace: string;

  public constructor(namespace: ExtensionNamespace, slug: string) {
    this.namespace = namespace;
    this.remoteNamespace = slug;

    this.#remote = new ExtensionsAPI(slug);
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

    const rawExtensionFile = await this.extractFile(foxeFileData, ALLOWED_FILES.EXTENSION);
    if (!rawExtensionFile) {
      throw new Error(`Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`);
    }

    return {
      buffer: foxeFileData,
      raw: rawExtensionFile,
    };
  }

  public async installExtension(foxeFileData: Uint8Array, file: File): Promise<ExtensionInfo> {
    log.debug("[Remote] Installing extension", foxeFileData, file);

    const rawPackageFile = await this.extractFile(foxeFileData, ALLOWED_FILES.PACKAGE);
    if (!rawPackageFile) {
      throw new Error(`Extension is corrupted: missing ${ALLOWED_FILES.PACKAGE}`);
    }

    const rawInfo = validatePackageInfo(JSON.parse(rawPackageFile) as Partial<ExtensionInfo>);
    const normalizedPublisher = rawInfo.publisher.replace(/[^A-Za-z0-9_\s]+/g, "");

    const info: ExtensionInfo = {
      ...rawInfo,
      id: `${normalizedPublisher}.${rawInfo.name}`,
      namespace: this.namespace,
      qualifiedName: qualifiedName(this.namespace, normalizedPublisher, rawInfo),
      readme: (await getFileContent(foxeFileData, ALLOWED_FILES.README)) ?? "",
      changelog: (await getFileContent(foxeFileData, ALLOWED_FILES.CHANGELOG)) ?? "",
    };

    const storedExtension: StoredExtension = await this.#remote.createOrUpdate(
      {
        info,
        remoteNamespace: this.remoteNamespace,
      },
      file,
    );

    return storedExtension.info;
  }

  public async uninstallExtension(id: string): Promise<void> {
    log.debug("[Remote] Uninstalling extension", id);

    await this.#remote.remove(id);
  }

  private async extractFile(
    foxeFileData: Uint8Array,
    file: ALLOWED_FILES,
  ): Promise<string | undefined> {
    const zip = new JSZip();
    const unzippedData = await zip.loadAsync(foxeFileData);

    return await this.extractFileContent(unzippedData, file);
  }

  private async extractFileContent(zip: JSZip, file: ALLOWED_FILES): Promise<string | undefined> {
    const fileEntry = zip.file(file);
    if (!fileEntry) {
      throw new Error(`File not found in zip: ${file}`);
    }
    return await fileEntry.async("string");
  }
}
