// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  addMultiFileHydrationOverrides,
  pickDefinedHydrationOverrides,
} from "./multiFileHydrationOptions";

describe("multiFileHydrationOptions", () => {
  describe("addMultiFileHydrationOverrides", () => {
    it("returns initArgs unchanged when overrides are undefined", () => {
      // GIVEN: base init args with no override object.
      const initArgs = { files: [new File(["data"], "first.mcap")] };

      // WHEN: applying undefined overrides.
      const result = addMultiFileHydrationOverrides(initArgs, undefined);

      // THEN: the original init args object is returned unchanged.
      expect(result).toBe(initArgs);
    });

    it("merges a single defined override field", () => {
      // GIVEN: base init args and one defined override.
      const initArgs = { urls: ["https://example.com/first.mcap"] };

      // WHEN: applying the override.
      const result = addMultiFileHydrationOverrides(initArgs, {
        maxHydratedSources: 3,
      });

      // THEN: only the defined field is merged into the result.
      expect(result).toEqual({
        urls: ["https://example.com/first.mcap"],
        maxHydratedSources: 3,
      });
    });

    it("merges all defined override fields", () => {
      // GIVEN: base init args and all override fields defined.
      const initArgs = { files: [new File(["data"], "first.mcap")] };

      // WHEN: applying the overrides.
      const result = addMultiFileHydrationOverrides(initArgs, {
        maxHydratedSources: 4,
        maxHydratedBytes: 5678,
        initConcurrency: 2,
      });

      // THEN: every defined override field is merged into the result.
      expect(result).toEqual({
        files: [initArgs.files[0]],
        maxHydratedSources: 4,
        maxHydratedBytes: 5678,
        initConcurrency: 2,
      });
    });

    it("does not add undefined override fields or overwrite existing values with undefined", () => {
      // GIVEN: init args that already include hydration fields.
      const initArgs = {
        urls: ["https://example.com/first.mcap"],
        maxHydratedSources: 9,
        initConcurrency: 5,
      };

      // WHEN: applying an override object with mixed defined and undefined values.
      const result = addMultiFileHydrationOverrides(initArgs, {
        maxHydratedSources: undefined,
        maxHydratedBytes: 1234,
        initConcurrency: undefined,
      });

      // THEN: only the defined override is applied and existing values remain intact.
      expect(result).toEqual({
        urls: ["https://example.com/first.mcap"],
        maxHydratedSources: 9,
        maxHydratedBytes: 1234,
        initConcurrency: 5,
      });
    });
  });

  describe("pickDefinedHydrationOverrides", () => {
    it("returns only the defined hydration fields", () => {
      // GIVEN: a mixed hydration override object.
      const overrides = {
        maxHydratedSources: 4,
        maxHydratedBytes: undefined,
        initConcurrency: 2,
      };

      // WHEN: picking defined fields.
      const result = pickDefinedHydrationOverrides(overrides);

      // THEN: only the defined fields are returned.
      expect(result).toEqual({
        maxHydratedSources: 4,
        initConcurrency: 2,
      });
    });
  });
});
