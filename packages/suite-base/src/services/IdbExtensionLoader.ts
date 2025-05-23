// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import JSZip from "jszip";

import Log from "@lichtblick/log";
import { ExtensionLoader } from "@lichtblick/suite-base/services/ExtensionLoader";
import {
  IExtensionStorage,
  StoredExtension,
} from "@lichtblick/suite-base/services/IExtensionStorage";
import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

import { IdbExtensionStorage } from "./IdbExtensionStorage";

const log = Log.getLogger(__filename);

export enum ALLOWED_FILES {
  EXTENSION = "dist/extension.js",
  PACKAGE = "package.json",
  README = "README.md",
  CHANGELOG = "CHANGELOG.md",
}

function parsePackageName(name: string): { publisher?: string; name: string } {
  const match = new RegExp(/^@([^/]+)\/(.+)/).exec(name);
  if (!match) {
    return { name };
  }

  return { publisher: match[1], name: match[2]! };
}

function qualifiedName(
  namespace: ExtensionNamespace,
  publisher: string,
  info: ExtensionInfo,
): string {
  switch (namespace) {
    case "local":
      // For local namespace we follow the legacy naming convention of using displayName
      // in order to stay compatible with existing layouts.
      return info.displayName;
    case "org":
      // For private registry we use namespace and package name.
      return [namespace, publisher, info.name].join(":");
  }
}

export function validatePackageInfo(info: Partial<ExtensionInfo>): ExtensionInfo {
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

async function getFileContent(
  foxeFileData: Uint8Array,
  allowedFile: ALLOWED_FILES,
): Promise<string | undefined> {
  const zip = new JSZip();
  const content = await zip.loadAsync(foxeFileData);
  const extractedContent = await content.file(allowedFile)?.async("string");

  return extractedContent;
}

export class IdbExtensionLoader implements ExtensionLoader {
  readonly #storage: IExtensionStorage;
  public readonly namespace: ExtensionNamespace;

  public constructor(namespace: ExtensionNamespace) {
    this.namespace = namespace;
    this.#storage = new IdbExtensionStorage(namespace);
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    log.debug("Get extension", id);

    const storedExtension = await this.#storage.get(id);
    return storedExtension?.info;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    log.debug("Listing extensions");

    return await this.#storage.list();
  }

  public async loadExtension(id: string): Promise<string> {
    log.debug("Loading extension", id);

    const extension: StoredExtension | undefined = await this.#storage.get(id);
    if (!extension) {
      throw new Error("Extension not found");
    }

    const content = await new JSZip().loadAsync(extension.content);
    const rawContent = await content.file(ALLOWED_FILES.EXTENSION)?.async("string");
    if (!rawContent) {
      throw new Error(`Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`);
    }

    return rawContent;
  }

  public async installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo> {
    log.debug("Installing extension");

    const pkgInfoText = await getFileContent(foxeFileData, ALLOWED_FILES.PACKAGE);
    if (!pkgInfoText) {
      throw new Error(
        `Corrupted extension. File "${ALLOWED_FILES.PACKAGE}" is missing in the extension source.`,
      );
    }
    const readme = (await getFileContent(foxeFileData, ALLOWED_FILES.README)) ?? "";
    const changelog = (await getFileContent(foxeFileData, ALLOWED_FILES.CHANGELOG)) ?? "";

    const rawInfo = validatePackageInfo(JSON.parse(pkgInfoText) as Partial<ExtensionInfo>);
    const normalizedPublisher = rawInfo.publisher.replace(/[^A-Za-z0-9_\s]+/g, "");

    const info: ExtensionInfo = {
      ...rawInfo,
      id: `${normalizedPublisher}.${rawInfo.name}`,
      namespace: this.namespace,
      qualifiedName: qualifiedName(this.namespace, normalizedPublisher, rawInfo),
      readme,
      changelog,
    };
    await this.#storage.put({
      content: foxeFileData,
      info,
    });

    return info;
  }

  public async uninstallExtension(id: string): Promise<void> {
    log.debug("Uninstalling extension", id);

    await this.#storage.delete(id);
  }
}
