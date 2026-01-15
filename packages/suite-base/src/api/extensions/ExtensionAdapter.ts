// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IExtensionApiResponse } from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ExtensionAdapter {
  /**
   * Convert IExtensionApiResponse to ExtensionInfo
   */
  public static toExtensionInfo(apiResponse: IExtensionApiResponse): ExtensionInfo {
    return {
      ...apiResponse,
      id: apiResponse.extensionId,
      externalId: apiResponse.id,
      namespace: apiResponse.scope,
    };
  }

  /**
   * Convert IExtensionApiResponse to StoredExtension
   */
  public static toStoredExtension(
    apiResponse: IExtensionApiResponse,
    workspace: string,
    content: Uint8Array = new Uint8Array(),
  ): StoredExtension {
    return {
      info: this.toExtensionInfo(apiResponse),
      content,
      workspace,
      fileId: apiResponse.fileId,
      externalId: apiResponse.id,
    };
  }

  /**
   * Convert IExtensionApiResponse to array of ExtensionInfo
   */
  public static toExtensionInfoList(apiResponse: IExtensionApiResponse[]): ExtensionInfo[] {
    return apiResponse.map(this.toExtensionInfo);
  }
}
