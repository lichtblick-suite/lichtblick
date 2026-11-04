// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LAYOUTS } from "../layouts";
import { SCENARIO_GROUPS, SCENARIO_TAGS } from "./constants";
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

    it("should describe every scenario with a sentence, a known group and known tags", () => {
      // Given
      const groups: readonly string[] = SCENARIO_GROUPS;
      const tags: readonly string[] = SCENARIO_TAGS;

      // When
      const invalid = SCENARIOS.filter(
        (scenario) =>
          scenario.description.trim().length === 0 ||
          scenario.player.trim().length === 0 ||
          !groups.includes(scenario.group) ||
          scenario.tags.length === 0 ||
          scenario.tags.some((tag) => !tags.includes(tag)),
      );

      // Then
      expect(invalid.map((scenario) => scenario.id)).toEqual([]);
    });

    it("should assign the expected group to each scenario", () => {
      // Given
      const expected = {
        sinewave: "time-series",
        pointcloud: "3d-rendering",
        transform: "3d-rendering",
        transformpreloading: "preloading",
        "mcap-ingest": "real-pipeline-ingest",
      };

      // When
      const groups = Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, scenario.group]));

      // Then
      expect(groups).toEqual(expected);
    });

    it("should tag synthetic and real scenarios consistently with their pipeline", () => {
      // Given / When
      const mismatched = SCENARIOS.filter(
        (scenario) =>
          scenario.tags.includes("synthetic") !== (scenario.pipeline === "synthetic") ||
          scenario.tags.includes("real-pipeline") !== (scenario.pipeline === "real"),
      );

      // Then
      expect(mismatched.map((scenario) => scenario.id)).toEqual([]);
    });

    it("should not require any params for synthetic scenarios", () => {
      // Given
      const synthetic = SCENARIOS.filter((scenario) => scenario.pipeline === "synthetic");

      // When
      const requiredParams = synthetic.flatMap(
        (scenario) => scenario.dataSource.requiredParams ?? [],
      );

      // Then
      expect(synthetic.length).toBeGreaterThan(0);
      expect(requiredParams).toEqual([]);
    });
  });
});
