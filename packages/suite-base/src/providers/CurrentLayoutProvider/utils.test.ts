// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { findFavoriteLayout } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/utils";
import { Layout, LayoutPermission } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

function makeLayout(
  id: string,
  name: string,
  permission: LayoutPermission,
  externalId?: string,
): Layout {
  // LayoutBuilder fills undefined fields with random values, so set the remote id afterwards.
  return { ...LayoutBuilder.layout({ id: id as LayoutID, name, permission }), externalId };
}

describe("findFavoriteLayout", () => {
  const personalA = makeLayout("personal-a", "A personal", "CREATOR_WRITE");
  const personalB = makeLayout("personal-b", "B personal", "CREATOR_WRITE");
  const sharedC = makeLayout("shared-c", "C shared", "ORG_WRITE", "remote-c");
  const sharedD = makeLayout("shared-d", "D shared", "ORG_READ", "remote-d");
  const layouts = [sharedD, personalB, sharedC, personalA];

  it("returns undefined when there are no favorites", () => {
    // Given
    const favorites = { personal: new Set<string>(), shared: new Set<string>() };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBeUndefined();
  });

  it("returns the favorite personal layout", () => {
    // Given
    const favorites = { personal: new Set(["personal-b"]), shared: new Set<string>() };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(personalB);
  });

  it("returns the favorite shared layout", () => {
    // Given
    const favorites = { personal: new Set<string>(), shared: new Set(["remote-d"]) };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(sharedD);
  });

  it("prefers a favorite shared layout over a favorite personal layout", () => {
    // Given
    const favorites = { personal: new Set(["personal-a"]), shared: new Set(["remote-d"]) };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(sharedD);
  });

  it("returns the first favorite personal layout by name when several exist", () => {
    // Given
    const favorites = {
      personal: new Set(["personal-b", "personal-a"]),
      shared: new Set<string>(),
    };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(personalA);
  });

  it("returns the first favorite shared layout by name when several exist", () => {
    // Given
    const favorites = {
      personal: new Set<string>(),
      shared: new Set(["remote-d", "remote-c"]),
    };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(sharedC);
  });

  it("ignores favorite ids of layouts that are not available", () => {
    // Given
    const favorites = {
      personal: new Set(["missing", "personal-b"]),
      shared: new Set(["remote-missing"]),
    };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBe(personalB);
  });

  it("matches shared layouts by remote id and personal layouts by local id", () => {
    // Given
    const favorites = { personal: new Set(["shared-c"]), shared: new Set(["personal-a"]) };

    // When
    const result = findFavoriteLayout(layouts, favorites);

    // Then
    expect(result).toBeUndefined();
  });
});
