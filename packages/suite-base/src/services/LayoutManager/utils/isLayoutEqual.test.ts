// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

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
      const panelId = BasicBuilder.string();
      const layoutA = LayoutBuilder.data({
        configById: {
          [panelId]: { id: "panel1", type: "3DPanel" },
        },
      });
      const layoutB = LayoutBuilder.data({
        configById: {
          [panelId]: { id: "panel1", type: "MapPanel" },
        },
      });

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(false);
    });

    it("should return false when a config key present in a is absent in b", () => {
      // Given
      const panelId = BasicBuilder.string();
      const layoutA = LayoutBuilder.data({
        configById: {
          [panelId]: { topic: "/markers" },
        },
      });
      const layoutB = LayoutBuilder.data({
        configById: {
          [panelId]: {},
        },
      });

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(false);
    });

    it("should return false when a top-level field differs", () => {
      // Given
      const layoutA = LayoutBuilder.data({ globalVariables: { speed: 10 } });
      const layoutB = LayoutBuilder.data({ globalVariables: { speed: 99 } });

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(false);
    });
  });

  describe("when b has additional entries not present in a (additive tolerance)", () => {
    it("should return true when b has a new panel ID not present in a", () => {
      // Given
      const panelId = BasicBuilder.string();
      const newPanelId = BasicBuilder.string();
      const base = LayoutBuilder.data({ configById: { [panelId]: { topic: "/markers" } } });
      const layoutA = base;
      const layoutB = {
        ...base,
        configById: { [panelId]: { topic: "/markers" }, [newPanelId]: { topic: "/new" } },
      };

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(true);
    });

    it("should return true when b's panel config has a new key not present in a", () => {
      // Given
      const panelId = BasicBuilder.string();
      const base = LayoutBuilder.data({ configById: { [panelId]: { topic: "/markers" } } });
      const layoutA = base;
      const layoutB = {
        ...base,
        configById: { [panelId]: { topic: "/markers", newKey: "defaultValue" } },
      };

      // When
      const result = isLayoutEqual(layoutA, layoutB);

      // Then
      expect(result).toBe(true);
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
