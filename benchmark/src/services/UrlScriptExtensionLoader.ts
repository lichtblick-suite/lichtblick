// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  ExtensionInfo,
  IExtensionLoader,
  Namespace,
  TypeExtensionLoader,
} from "@lichtblick/suite-base";
import { LoadedExtension } from "@lichtblick/suite-base/services/extension/IExtensionLoader";

/**
 * Read-only loader serving a single prebuilt extension script (`dist/extension.js`) from a URL, so
 * benchmark runs can include an extension panel without going through the install flow.
 */
export class UrlScriptExtensionLoader implements IExtensionLoader {
  public readonly namespace: Namespace = "local";
  public readonly type: TypeExtensionLoader = "browser";
  readonly #url: string;
  readonly #info: ExtensionInfo;

  public constructor(url: string, info: Omit<ExtensionInfo, "namespace">) {
    this.#url = url;
    this.#info = { ...info, namespace: this.namespace };
  }

  public async getExtension(id: string): Promise<ExtensionInfo | undefined> {
    return id === this.#info.id ? this.#info : undefined;
  }

  public async getExtensions(): Promise<ExtensionInfo[]> {
    return [this.#info];
  }

  public async loadExtension(id: string): Promise<LoadedExtension> {
    if (id !== this.#info.id) {
      throw new Error(`Extension ${id} not found`);
    }
    const response = await fetch(this.#url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${this.#url}: ${response.status} ${response.statusText}`);
    }
    return { raw: await response.text() };
  }

  public async installExtension(): Promise<ExtensionInfo> {
    throw new Error("UrlScriptExtensionLoader is read-only");
  }

  public async uninstallExtension(): Promise<void> {
    throw new Error("UrlScriptExtensionLoader is read-only");
  }
}

/** The lichtblick-stress Perf HUD extension; its panel type is `<qualifiedName>.perf-hud`. */
export const PERF_HUD_EXTENSION_INFO: Omit<ExtensionInfo, "namespace"> = {
  id: "lichtblick-stress.lichtblick-perf-hud",
  name: "lichtblick-perf-hud",
  qualifiedName: "lichtblick-perf-hud",
  displayName: "Perf HUD",
  description: "Live performance metrics panel from lichtblick-stress",
  publisher: "lichtblick-stress",
  homepage: "",
  keywords: [],
  license: "MPL-2.0",
  version: "0.1.0",
};
