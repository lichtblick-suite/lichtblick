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
      const layoutBaseline = LayoutBuilder.data();
      const layoutCurrent = layoutBaseline;

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(true);
    });
  });

  describe("when comparing layouts with differences", () => {
    it("should return false when panel configuration changes", () => {
      // Given
      const panelId = BasicBuilder.string();
      const layoutBaseline = LayoutBuilder.data({
        configById: {
          [panelId]: { id: "panel1", type: "3DPanel" },
        },
      });
      const layoutCurrent = LayoutBuilder.data({
        configById: {
          [panelId]: { id: "panel1", type: "MapPanel" },
        },
      });

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(false);
    });

    it("should return false when a config key present in baseline is absent in current layout", () => {
      // Given
      const panelId = BasicBuilder.string();
      const layoutBaseline = LayoutBuilder.data({
        configById: {
          [panelId]: { topic: BasicBuilder.string() },
        },
      });
      const layoutCurrent = LayoutBuilder.data({
        configById: {
          [panelId]: {},
        },
      });

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(false);
    });

    it("should return false when baseline top-level field differs", () => {
      const speedA = BasicBuilder.number();
      const speedB = speedA + BasicBuilder.number();
      // Given
      const layoutBaseline = LayoutBuilder.data({ globalVariables: { speed: speedA } });
      const layoutCurrent = LayoutBuilder.data({ globalVariables: { speed: speedB } });

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(false);
    });
  });

  describe("when current layout has additional entries not present in baseline (additive tolerance)", () => {
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();
    it("should return true when current layout has a new panel ID not present in baseline", () => {
      // Given
      const panelId = BasicBuilder.string();
      const newPanelId = BasicBuilder.string();
      const base = LayoutBuilder.data({ configById: { [panelId]: { topic: topicA } } });
      const layoutBaseline = base;
      const layoutCurrent = {
        ...base,
        configById: { [panelId]: { topic: topicA }, [newPanelId]: { topic: topicB } },
      };

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(true);
    });

    it("should return true when current layout's panel config has a new key not present in baseline", () => {
      // Given
      const panelId = BasicBuilder.string();
      const base = LayoutBuilder.data({ configById: { [panelId]: { topic: topicA } } });
      const layoutBaseline = base;
      const layoutCurrent = {
        ...base,
        configById: { [panelId]: { topic: topicA, newKey: BasicBuilder.string() } },
      };

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(true);
    });
  });

  describe("when current layout has additional undefined fields", () => {
    it("should return true when current layout has extra undefined fields", () => {
      // Given
      const layoutBaseline = LayoutBuilder.data();
      const layoutCurrent = {
        ...layoutBaseline,
        extraField: undefined,
      } as LayoutData & { extraField: undefined };

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(true);
    });

    it("should return false when current layout has extra defined fields", () => {
      // Given
      const layoutBaseline = LayoutBuilder.data();
      const layoutCurrent = {
        ...layoutBaseline,
        extraField: BasicBuilder.string(),
      } as LayoutData & { extraField: string };

      // When
      const result = isLayoutEqual(layoutBaseline, layoutCurrent);

      // Then
      expect(result).toBe(false);
    });
  });
});
