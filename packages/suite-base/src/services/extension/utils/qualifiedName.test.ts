// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { Namespace } from "@lichtblick/suite-base/types";

import qualifiedName from "./qualifiedName";

describe("qualifiedName", () => {
  describe("Given a local namespace", () => {
    it("When generating qualified name for local extension, Then should return displayName", () => {
      // Given
      const extensionInfo = ExtensionBuilder.extensionInfo();
      const namespace: Namespace = "local";
      const publisher = BasicBuilder.string();

      // When
      const result = qualifiedName(namespace, publisher, extensionInfo);

      // Then
      expect(result).toBe(extensionInfo.displayName);
    });
  });

  describe("Given an org namespace", () => {
    it("When generating qualified name for org extension, Then should return namespace:publisher:name format", () => {
      // Given
      const extensionInfo = ExtensionBuilder.extensionInfo();
      const namespace: Namespace = "org";
      const publisher = BasicBuilder.string();

      // When
      const result = qualifiedName(namespace, publisher, extensionInfo);

      // Then
      expect(result).toBe(`${namespace}:${publisher}:${extensionInfo.name}`);
    });
  });
});
