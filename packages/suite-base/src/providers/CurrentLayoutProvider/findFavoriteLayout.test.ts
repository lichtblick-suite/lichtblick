// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { findFavoriteLayout } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/findFavoriteLayout";
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
    expect(findFavoriteLayout(layouts, { personal: new Set(), shared: new Set() })).toBeUndefined();
  });

  it("returns the favorite personal layout", () => {
    const result = findFavoriteLayout(layouts, {
      personal: new Set(["personal-b"]),
      shared: new Set(),
    });

    expect(result).toBe(personalB);
  });

  it("returns the favorite shared layout", () => {
    const result = findFavoriteLayout(layouts, {
      personal: new Set(),
      shared: new Set(["remote-d"]),
    });

    expect(result).toBe(sharedD);
  });

  it("prefers a favorite shared layout over a favorite personal layout", () => {
    const result = findFavoriteLayout(layouts, {
      personal: new Set(["personal-a"]),
      shared: new Set(["remote-d"]),
    });

    expect(result).toBe(sharedD);
  });

  it("returns the first favorite by name when several favorites exist", () => {
    expect(
      findFavoriteLayout(layouts, {
        personal: new Set(["personal-b", "personal-a"]),
        shared: new Set(),
      }),
    ).toBe(personalA);
    expect(
      findFavoriteLayout(layouts, {
        personal: new Set(),
        shared: new Set(["remote-d", "remote-c"]),
      }),
    ).toBe(sharedC);
  });

  it("ignores favorite ids of layouts that are not available", () => {
    const result = findFavoriteLayout(layouts, {
      personal: new Set(["missing", "personal-b"]),
      shared: new Set(["remote-missing"]),
    });

    expect(result).toBe(personalB);
  });

  it("matches shared layouts by remote id and personal layouts by local id", () => {
    const result = findFavoriteLayout(layouts, {
      personal: new Set(["shared-c"]),
      shared: new Set(["personal-a"]),
    });

    expect(result).toBeUndefined();
  });
});
