// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionAdapter } from "@lichtblick/suite-base/api/extensions/ExtensionAdapter";
import {
  CreateOrUpdateBody,
  CreateOrUpdateResponse,
  ExtensionInfoWorkspace,
  IExtensionAPI,
  IExtensionApiResponse,
} from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { HttpError } from "@lichtblick/suite-base/services/http/HttpError";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

class ExtensionsAPI implements IExtensionAPI {
  public readonly workspace: string;
  private readonly workspacePath = "workspaces";
  private readonly extensionPath = "extensions";

  public constructor(workspace: string) {
    this.workspace = workspace;
  }

  public async list(): Promise<ExtensionInfo[]> {
    const { data } = await HttpService.get<IExtensionApiResponse[]>(
      `${this.workspacePath}/${this.workspace}/${this.extensionPath}`,
    );

    return ExtensionAdapter.toExtensionInfoList(data);
  }

  public async get(id: string): Promise<StoredExtension | undefined> {
    const { data } = await HttpService.get<IExtensionApiResponse | undefined>(
      `${this.extensionPath}/${id}`,
    );

    if (!data) {
      return undefined;
    }

    return ExtensionAdapter.toStoredExtension(data, this.workspace);
  }

  public async createOrUpdate(
    extension: ExtensionInfoWorkspace,
    file: File,
  ): Promise<StoredExtension> {
    const formData = new FormData();
    formData.append("file", file);

    const body: CreateOrUpdateBody = {
      // changelog: extension.info.changelog,
      description: extension.info.description,
      displayName: extension.info.displayName,
      extensionId: extension.info.id,
      homepage: extension.info.homepage,
      keywords: extension.info.keywords,
      license: extension.info.license,
      name: extension.info.name,
      publisher: extension.info.publisher,
      qualifiedName: extension.info.qualifiedName,
      // readme: extension.info.readme,
      scope: "org",
      version: extension.info.version,
    } as CreateOrUpdateBody;

    Object.entries(body).forEach(([key, value]) => {
      if (typeof value === "object") {
        formData.append(key, JSON.stringify(value) ?? "");
      } else if (typeof value === "string" && value.length > 0) {
        formData.append(key, value);
      }
    });

    const { data } = await HttpService.post<CreateOrUpdateResponse>(
      `${this.workspacePath}/${this.workspace}/extension`,
      formData,
    );

    return ExtensionAdapter.toStoredExtension(data.extension, this.workspace);
  }

  public async remove(id: string): Promise<boolean> {
    try {
      await HttpService.delete<IExtensionApiResponse>(
        `${this.workspacePath}/${this.workspace}/extension/${id}`,
      );
      return true;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  public async loadContent(id: string): Promise<Uint8Array | undefined> {
    try {
      const { data } = await HttpService.get<ArrayBuffer>(
        `${this.extensionPath}/${id}/download`,
        undefined,
        { responseType: "arraybuffer" },
      );

      return new Uint8Array(data);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }
}

export default ExtensionsAPI;
