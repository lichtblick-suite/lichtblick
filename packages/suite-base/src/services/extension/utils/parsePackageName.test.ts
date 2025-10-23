// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PackageName } from "@lichtblick/suite-base/services/extension/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import parsePackageName from "./parsePackageName";

describe("parsePackageName", () => {
  describe("Given a scoped package name", () => {
    it("When parsing a standard scoped package, Then should return name and publisher", () => {
      // Given
      const publisher = BasicBuilder.string();
      const name = BasicBuilder.string();
      const packageName = `@${publisher}/${name}`;

      // When
      const result = parsePackageName(packageName);

      // Then
      expect(result).toEqual({ name, publisher } as PackageName);
    });

    it("When parsing a scoped package with hyphens, Then should handle hyphens correctly", () => {
      // Given
      const publisher = `${BasicBuilder.string()}-${BasicBuilder.string()}`;
      const name = `${BasicBuilder.string()}-${BasicBuilder.string()}`;
      const packageName = `@${publisher}/${name}`;

      // When
      const result = parsePackageName(packageName);

      // Then
      expect(result).toEqual({ name, publisher } as PackageName);
    });

    it("When parsing a scoped package with underscores, Then should handle underscores correctly", () => {
      // Given
      const publisher = `${BasicBuilder.string()}_${BasicBuilder.string()}`;
      const name = `${BasicBuilder.string()}_${BasicBuilder.string()}`;
      const packageName = `@${publisher}/${name}`;

      // When
      const result = parsePackageName(packageName);

      // Then
      expect(result).toEqual({ name, publisher } as PackageName);
    });

    it("When parsing a scoped package with numbers, Then should handle numbers correctly", () => {
      // Given
      const publisher = `${BasicBuilder.string()}${BasicBuilder.number()}`;
      const name = `${BasicBuilder.string()}${BasicBuilder.number()}`;
      const packageName = `@${publisher}/${name}`;

      // When
      const result = parsePackageName(packageName);

      // Then
      expect(result).toEqual({ name, publisher } as PackageName);
    });

    it("When parsing a scoped package with dots, Then should handle dots correctly", () => {
      // Given
      const publisher = `${BasicBuilder.string()}.${BasicBuilder.string()}`;
      const name = `${BasicBuilder.string()}.${BasicBuilder.string()}`;
      const packageName = `@${publisher}/${name}`;

      // When
      const result = parsePackageName(packageName);

      // Then
      expect(result).toEqual({ name, publisher } as PackageName);
    });
  });

  describe("Given an unscoped package name", () => {
    it("When parsing a simple package name, Then should return only name without publisher", () => {
      // Given
      const name = BasicBuilder.string();

      // When
      const result = parsePackageName(name);

      // Then
      expect(result).toEqual({ name } as PackageName);
    });
  });
});
