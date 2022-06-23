// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import JSZip from "jszip";

import Log from "@foxglove/log";
import { ExtensionInfo, ExtensionLoader, IExtensionStorage } from "@foxglove/studio-base";
import { ExtensionNamespace } from "@foxglove/studio-base/context/ExtensionLoaderContext";

import { IdbExtensionStorage } from "./IdbExtensionStorage";

const log = Log.getLogger(__filename);

function qualifiedName(namespace: ExtensionNamespace, info: ExtensionInfo): string {
  switch (namespace) {
    case "local":
      // For local namespace we follow the legacy naming convention of using displayName
      // in order to stay compatible with existing layouts.
      return info.displayName;
    case "private":
      // For private registry we use namespace and package name.
      return [namespace, info.name].join(":");
  }
}

function validatePackageInfo(info: Partial<ExtensionInfo>): ExtensionInfo {
  if (info.publisher == undefined || info.publisher.length === 0) {
    throw new Error("Invalid extension: missing publisher");
  }
  if (info.name == undefined || info.name.length === 0) {
    throw new Error("Invalid extension: missing name");
  }

  return info as ExtensionInfo;
}

export class IdbExtensionLoader implements ExtensionLoader {
  readonly #storage: IExtensionStorage;
  readonly namespace: ExtensionNamespace;

  constructor(namespace: ExtensionNamespace) {
    this.namespace = namespace;
    this.#storage = new IdbExtensionStorage(namespace);
  }

  async getExtensions(): Promise<ExtensionInfo[]> {
    log.debug("Listing extensions");

    return await this.#storage.list();
  }

  async loadExtension(id: string): Promise<string> {
    log.debug("Loading extension", id);

    const extension = await this.#storage.get(id);
    const zip = new JSZip();

    if (extension?.content == undefined) {
      throw new Error("Extension is corrupted");
    }

    const content = await zip.loadAsync(extension.content);
    const srcText = await content.file("dist/extension.js")?.async("string");

    if (srcText == undefined) {
      throw new Error("Extension is corrupted");
    }

    return srcText;
  }

  async installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo> {
    log.debug("Installing extension");

    const zip = new JSZip();
    const content = await zip.loadAsync(foxeFileData);

    const pkgInfoText = await content.file("package.json")?.async("string");
    if (pkgInfoText == undefined) {
      throw new Error("Invalid extension: missing package.json");
    }

    const rawInfo = validatePackageInfo(JSON.parse(pkgInfoText) as Partial<ExtensionInfo>);
    const normalizedPublisher = rawInfo.publisher.toLowerCase().replace(/[\W_]+/g, "_");
    const info: ExtensionInfo = {
      ...rawInfo,
      id: `${normalizedPublisher}.${rawInfo.name}`,
      namespace: this.namespace,
      qualifiedName: qualifiedName(this.namespace, rawInfo),
    };
    await this.#storage.put({
      content: foxeFileData,
      info,
    });

    return info;
  }

  async uninstallExtension(id: string): Promise<boolean> {
    log.debug("Uninstalling extension", id);

    await this.#storage.delete(id);
    return true;
  }
}
