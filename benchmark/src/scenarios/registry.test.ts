// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LAYOUTS } from "../layouts";
import { getScenario, getScenarioFromUrl, SCENARIOS } from "./registry";

describe("scenarios registry", () => {
  describe("getScenario", () => {
    it("should return the scenario when the id is registered", () => {
      // Given
      const existingId = SCENARIOS[0]!.id;

      // When
      const result = getScenario(existingId);

      // Then
      expect(result).toEqual(SCENARIOS[0]);
    });

    it("should return undefined when the id is not registered", () => {
      // Given
      const unknownId = "not-a-real-scenario";

      // When
      const result = getScenario(unknownId);

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe("getScenarioFromUrl", () => {
    it("should return the scenario referenced by the ?scenario= query param", () => {
      // Given
      const existingId = SCENARIOS[0]!.id;
      const url = new URL(`http://localhost:8080/?scenario=${existingId}`);

      // When
      const result = getScenarioFromUrl(url);

      // Then
      expect(result).toEqual(SCENARIOS[0]);
    });

    it("should return undefined when the ?scenario= query param is absent", () => {
      // Given
      const url = new URL("http://localhost:8080/?ds=sinewave");

      // When
      const result = getScenarioFromUrl(url);

      // Then
      expect(result).toBeUndefined();
    });

    it("should return undefined when the ?scenario= query param does not match a registered scenario", () => {
      // Given
      const url = new URL("http://localhost:8080/?scenario=not-a-real-scenario");

      // When
      const result = getScenarioFromUrl(url);

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe("SCENARIOS", () => {
    it("should reference only layouts that exist in LAYOUTS", () => {
      // Given
      const layoutKeys = Object.keys(LAYOUTS);

      // When
      const referencedLayouts = SCENARIOS.map((scenario) => scenario.layout);

      // Then
      for (const layout of referencedLayouts) {
        expect(layoutKeys).toContain(layout);
      }
    });

    it("should use unique scenario ids", () => {
      // Given
      const ids = SCENARIOS.map((scenario) => scenario.id);

      // When
      const uniqueIds = new Set(ids);

      // Then
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
