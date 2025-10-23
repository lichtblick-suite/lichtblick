// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IExtensionApiResponse } from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { Namespace } from "@lichtblick/suite-base/types";

import { ExtensionAdapter } from "./ExtensionAdapter";

describe("ExtensionAdapter", () => {
  const createMockApiResponse = (): IExtensionApiResponse => ({
    id: BasicBuilder.string(),
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    scope: "org" as Namespace,
    changelog: BasicBuilder.string(),
    description: BasicBuilder.string(),
    displayName: BasicBuilder.string(),
    extensionId: BasicBuilder.string(),
    fileId: BasicBuilder.string(),
    homepage: BasicBuilder.string(),
    keywords: [BasicBuilder.string(), BasicBuilder.string()],
    license: BasicBuilder.string(),
    name: BasicBuilder.string(),
    publisher: BasicBuilder.string(),
    qualifiedName: BasicBuilder.string(),
    readme: BasicBuilder.string(),
    version: BasicBuilder.string(),
  });

  describe("toExtensionInfo", () => {
    it("should convert IExtensionApiResponse to ExtensionInfo", () => {
      // Given
      const apiResponse = createMockApiResponse();

      // When
      const result = ExtensionAdapter.toExtensionInfo(apiResponse);

      // Then
      expect(result).toEqual({
        ...apiResponse,
        id: apiResponse.extensionId,
        externalId: apiResponse.id,
        namespace: apiResponse.scope,
      });
    });
  });

  describe("toStoredExtension", () => {
    it("should convert IExtensionApiResponse to StoredExtension with default content", () => {
      // Given
      const apiResponse = createMockApiResponse();
      const workspace = BasicBuilder.string();

      // When
      const result = ExtensionAdapter.toStoredExtension(apiResponse, workspace);

      // Then
      expect(result).toEqual({
        info: {
          ...apiResponse,
          id: apiResponse.extensionId,
          externalId: apiResponse.id,
          namespace: apiResponse.scope,
        },
        content: new Uint8Array(),
        workspace,
        fileId: apiResponse.fileId,
        externalId: apiResponse.id,
      } as StoredExtension);
    });

    it("should convert IExtensionApiResponse to StoredExtension with custom content", () => {
      // Given
      const apiResponse = createMockApiResponse();
      const workspace = BasicBuilder.string();
      const customContent = new Uint8Array([1, 2, 3, 4]);

      // When
      const result = ExtensionAdapter.toStoredExtension(apiResponse, workspace, customContent);

      // Then
      expect(result).toEqual({
        info: {
          ...apiResponse,
          id: apiResponse.extensionId,
          externalId: apiResponse.id,
          namespace: apiResponse.scope,
        },
        content: customContent,
        workspace,
        fileId: apiResponse.fileId,
        externalId: apiResponse.id,
      });
    });
  });

  describe("toExtensionInfoList", () => {
    it("should convert array of IExtensionApiResponse to array of ExtensionInfo", () => {
      // Given
      const apiResponses = [createMockApiResponse(), createMockApiResponse()];

      // When
      const result = ExtensionAdapter.toExtensionInfoList(apiResponses);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...apiResponses[0],
        id: apiResponses[0]!.extensionId,
        externalId: apiResponses[0]!.id,
        namespace: apiResponses[0]!.scope,
      });
      expect(result[1]).toEqual({
        ...apiResponses[1],
        id: apiResponses[1]!.extensionId,
        externalId: apiResponses[1]!.id,
        namespace: apiResponses[1]!.scope,
      });
    });

    it("should handle empty array", () => {
      // Given
      const apiResponses: IExtensionApiResponse[] = [];

      // When
      const result = ExtensionAdapter.toExtensionInfoList(apiResponses);

      // Then
      expect(result).toEqual([]);
    });
  });
});
