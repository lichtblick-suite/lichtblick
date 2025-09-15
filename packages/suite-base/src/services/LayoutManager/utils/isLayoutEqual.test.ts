// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import { isLayoutEqual } from "./isLayoutEqual";

describe("isLayoutEqual", () => {
  describe("when comparing identical layouts", () => {
    it("should return true for exact same layout objects", () => {
      // Given
      const layout = LayoutBuilder.data();

      // When
      const result = isLayoutEqual(layout, layout);

      // Then
      expect(result).toBe(true);
    });

    it("should return true for layouts with identical content", () => {
      // Given
      const layoutA = LayoutBuilder.data();
      const layoutB = layoutA;

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(true);
    });
  });

  describe("when comparing layouts with differences", () => {
    it("should return false when panel configuration changes", () => {
      // Given
      const painelId = BasicBuilder.string();
      const layoutA = LayoutBuilder.data({
        configById: {
          [painelId]: { id: "panel1", type: "3DPanel" },
        },
      });
      const layoutB = LayoutBuilder.data({
        configById: {
          [painelId]: { id: "panel1", type: "MapPanel" }, // different type
        },
      });

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(false);
    });
  });

  describe("when second layout has additional undefined fields", () => {
    it("should return true when layout B has extra undefined fields", () => {
      // Given
      const layoutA = LayoutBuilder.data();
      const layoutB = {
        ...layoutA,
        extraField: undefined,
      } as LayoutData & { extraField: undefined };

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(true);
    });

    it("should return false when layout B has extra defined fields", () => {
      // Given
      const layoutA = LayoutBuilder.data();
      const layoutB = {
        ...layoutA,
        extraField: BasicBuilder.string(),
      } as LayoutData & { extraField: string };

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(false);
    });
  });
});
