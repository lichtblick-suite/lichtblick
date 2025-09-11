// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionInfoSlug, IExtensionAPI } from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

class ExtensionsAPI implements IExtensionAPI {
  public readonly slug: string;
  private readonly extensionEndpoint = "/extensions";

  public constructor(slug: string) {
    this.slug = slug;
  }

  public async list(): Promise<ExtensionInfo[]> {
    return await HttpService.get<ExtensionInfo[]>(this.extensionEndpoint, { slug: this.slug });
  }

  public async get(id: string): Promise<StoredExtension | undefined> {
    return await HttpService.get<StoredExtension | undefined>(
      `${this.extensionEndpoint}/${this.slug}/${id}`,
    );
  }

  public async createOrUpdate(extension: ExtensionInfoSlug, file: File): Promise<StoredExtension> {
    const extensionStr = JSON.stringify({
      info: extension.info,
      slug: extension.slug,
    });

    const formData = new FormData();
    formData.append("file", file);
    if (extensionStr != undefined) {
      formData.append("extension", extensionStr);
    }

    return await HttpService.post<StoredExtension>(
      `${this.extensionEndpoint}/${this.slug}`,
      formData,
    );
  }

  public async remove(id: string): Promise<boolean> {
    return await HttpService.delete<boolean>(`${this.extensionEndpoint}/${id}`);
  }

  public async loadContent(fileId: string): Promise<Uint8Array | undefined> {
    return await HttpService.get<Uint8Array>(`${this.extensionEndpoint}/file/download/${fileId}`);
  }
}

export default ExtensionsAPI;
