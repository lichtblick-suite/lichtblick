/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook, waitFor } from "@testing-library/react";

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useFavoriteLayoutsStorage } from "@lichtblick/suite-base/context/FavoriteLayoutsStorageContext";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import { useListFavoriteLayouts } from "./useListFavoriteLayouts";

jest.mock("@lichtblick/suite-base/context/FavoriteLayoutsStorageContext", () => ({
  useFavoriteLayoutsStorage: jest.fn(),
}));

function mockFavoriteLayoutsStorage(initialIds: LayoutID[]) {
  let ids = initialIds;
  const getFavoriteLayoutIds = jest.fn(async () => ids);
  const toggleFavoriteLayout = jest.fn(async (id: LayoutID) => {
    ids = ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
  });
  (useFavoriteLayoutsStorage as jest.Mock).mockReturnValue({
    getFavoriteLayoutIds,
    toggleFavoriteLayout,
  });
  return { getFavoriteLayoutIds, toggleFavoriteLayout };
}

describe("useListFavoriteLayouts", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Given no favourites, when mounted, then resolves to an empty list", async () => {
    // GIVEN
    mockFavoriteLayoutsStorage([]);

    // WHEN
    const { result } = renderHook(() => useListFavoriteLayouts());

    // THEN
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.favoriteLayoutIds).toEqual([]);
  });

  it("Given stored favourites, when mounted, then resolves to the stored ids", async () => {
    // GIVEN
    const favoriteLayoutIds = [
      LayoutBuilder.layoutId("layout-1"),
      LayoutBuilder.layoutId("layout-2"),
    ];
    mockFavoriteLayoutsStorage(favoriteLayoutIds);

    // WHEN
    const { result } = renderHook(() => useListFavoriteLayouts());

    // THEN
    await waitFor(() => {
      expect(result.current.favoriteLayoutIds).toEqual(favoriteLayoutIds);
    });
  });

  it("Given a layout is not yet favourite, when toggled, then it is added, persisted and the list is reloaded", async () => {
    // GIVEN
    const { toggleFavoriteLayout } = mockFavoriteLayoutsStorage([]);
    const { result } = renderHook(() => useListFavoriteLayouts());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // WHEN
    await act(async () => {
      await result.current.toggleFavoriteLayout(LayoutBuilder.layoutId("layout-1"));
    });

    // THEN
    expect(toggleFavoriteLayout).toHaveBeenCalledWith("layout-1");
    expect(result.current.favoriteLayoutIds).toEqual(["layout-1"]);
  });

  it("Given a layout is already favourite, when toggled, then it is removed and persisted", async () => {
    // GIVEN
    mockFavoriteLayoutsStorage([
      LayoutBuilder.layoutId("layout-1"),
      LayoutBuilder.layoutId("layout-2"),
    ]);
    const { result } = renderHook(() => useListFavoriteLayouts());
    await waitFor(() => {
      expect(result.current.favoriteLayoutIds).toEqual(["layout-1", "layout-2"]);
    });

    // WHEN
    await act(async () => {
      await result.current.toggleFavoriteLayout(LayoutBuilder.layoutId("layout-1"));
    });

    // THEN
    expect(result.current.favoriteLayoutIds).toEqual(["layout-2"]);
  });
});
