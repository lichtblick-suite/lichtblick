// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import { attachFavorites } from "./attachFavorites";

describe("attachFavorites", () => {
  it("Given items is undefined, when called, then returns undefined", () => {
    // GIVEN / WHEN
    const result = attachFavorites(undefined, []);

    // THEN
    expect(result).toBeUndefined();
  });

  it("Given no favourites, when called, then attaches favorite=false to every layout", () => {
    // GIVEN
    const layoutA = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("a"), name: "Alpha" });
    const layoutB = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("b"), name: "Beta" });

    // WHEN
    const result = attachFavorites([layoutA, layoutB], []);

    // THEN
    expect(result).toEqual([
      { ...layoutA, favorite: false },
      { ...layoutB, favorite: false },
    ]);
  });

  it("Given some favourites, when called, then attaches favorite=true only to matching ids", () => {
    // GIVEN
    const layoutA = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("a"), name: "Alpha" });
    const layoutB = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("b"), name: "Beta" });

    // WHEN
    const result = attachFavorites([layoutA, layoutB], [layoutB.id]);

    // THEN
    expect(result).toEqual([
      { ...layoutB, favorite: true },
      { ...layoutA, favorite: false },
    ]);
  });

  it("Given favourites and non-favourites, when sorted, then favourites come first", () => {
    // GIVEN
    const zebra = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("z"), name: "Zebra" });
    const apple = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("a"), name: "Apple" });

    // WHEN
    const result = attachFavorites([apple, zebra], [zebra.id]);

    // THEN
    expect(result?.map((layout) => layout.id)).toEqual([zebra.id, apple.id]);
  });

  it("Given layouts within the same favourite group, when sorted, then orders alphabetically", () => {
    // GIVEN
    const zebra = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("z"), name: "Zebra" });
    const apple = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("a"), name: "Apple" });
    const monkey = LayoutBuilder.layout({ id: LayoutBuilder.layoutId("m"), name: "Monkey" });

    // WHEN
    const result = attachFavorites([zebra, apple, monkey], [zebra.id, monkey.id]);

    // THEN
    expect(result?.map((layout) => layout.id)).toEqual([monkey.id, zebra.id, apple.id]);
  });
});
