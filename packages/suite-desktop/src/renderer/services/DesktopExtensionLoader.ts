// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import {
  ExtensionInfo,
  IExtensionLoader,
  Namespace,
  TypeExtensionLoader,
  InstallExtensionProps,
} from "@lichtblick/suite-base";

import { Desktop, DesktopExtension, LoadedExtension } from "../../common/types";

const log = Logger.getLogger(__filename);

export class DesktopExtensionLoader implements IExtensionLoader {
  #bridge?: Desktop;
  public readonly namespace: Namespace = "local";
  public readonly type: TypeExtensionLoader = "filesystem";

  public constructor(bridge: Desktop) {
    this.#bridge = bridge;
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    const storedExtension = (await this.getExtensions()).find((extension) => extension.id === id);
    return storedExtension;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    const extensionList = (await this.#bridge?.getExtensions()) ?? [];
    log.debug(`Loaded ${extensionList.length} extension(s)`);

    const extensions = extensionList.map((extension: DesktopExtension): ExtensionInfo => {
      const pkgInfo = extension.packageJson as ExtensionInfo;
      return {
        ...pkgInfo,
        id: extension.id,
        name: pkgInfo.displayName,
        namespace: this.namespace,
        // Qualified name is display name for backwards compatibility with existing layouts.
        qualifiedName: pkgInfo.displayName,
        readme: extension.readme,
        changelog: extension.changelog,
      };
    });

    return extensions;
  }

  public async loadExtension(id: string): Promise<LoadedExtension> {
    if (!this.#bridge) {
      throw new Error("Cannot load extension without a desktopBridge");
    }
    return await this.#bridge.loadExtension(id);
  }

  public async installExtension({ foxeFileData }: InstallExtensionProps): Promise<ExtensionInfo> {
    if (this.#bridge == undefined) {
      throw new Error(`Cannot install extension without a desktopBridge`);
    }

    const extension: DesktopExtension = await this.#bridge.installExtension(foxeFileData);
    const pkgInfo = extension.packageJson as ExtensionInfo;

    return {
      ...pkgInfo,
      id: extension.id,
      name: pkgInfo.displayName,
      namespace: this.namespace,
      // Qualified name is display name for backwards compatibility with existing layouts.
      qualifiedName: pkgInfo.displayName,
      readme: extension.readme,
      changelog: extension.changelog,
    };
  }

  public async uninstallExtension(id: string): Promise<void> {
    await this.#bridge?.uninstallExtension(id);
  }
}
