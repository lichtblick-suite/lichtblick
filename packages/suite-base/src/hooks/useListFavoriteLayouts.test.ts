/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook, waitFor } from "@testing-library/react";

import {
  UserProfile,
  useUserProfileStorage,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import { useListFavoriteLayouts } from "./useListFavoriteLayouts";

jest.mock("@lichtblick/suite-base/context/UserProfileStorageContext", () => ({
  useUserProfileStorage: jest.fn(),
}));

function mockProfileStorage(initialProfile: UserProfile) {
  let profile = initialProfile;
  const getUserProfile = jest.fn(async () => profile);
  const setUserProfile = jest.fn(
    async (value: UserProfile | ((prev: UserProfile) => UserProfile)) => {
      profile = typeof value === "function" ? value(profile) : { ...profile, ...value };
    },
  );
  (useUserProfileStorage as jest.Mock).mockReturnValue({ getUserProfile, setUserProfile });
  return { getUserProfile, setUserProfile };
}

describe("useListFavoriteLayouts", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Given a profile without favourites, when mounted, then resolves to an empty list", async () => {
    // GIVEN
    mockProfileStorage({});

    // WHEN
    const { result } = renderHook(() => useListFavoriteLayouts());

    // THEN
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.favoriteLayoutIds).toEqual([]);
  });

  it("Given a profile with favourites, when mounted, then resolves to the stored ids", async () => {
    // GIVEN
    const favoriteLayoutIds = [
      LayoutBuilder.layoutId("layout-1"),
      LayoutBuilder.layoutId("layout-2"),
    ];
    mockProfileStorage({ favoriteLayoutIds });

    // WHEN
    const { result } = renderHook(() => useListFavoriteLayouts());

    // THEN
    await waitFor(() => {
      expect(result.current.favoriteLayoutIds).toEqual(favoriteLayoutIds);
    });
  });

  it("Given a layout is not yet favourite, when toggled, then it is added and persisted", async () => {
    // GIVEN
    const { setUserProfile } = mockProfileStorage({});
    const { result } = renderHook(() => useListFavoriteLayouts());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // WHEN
    await act(async () => {
      await result.current.toggleFavoriteLayout(LayoutBuilder.layoutId("layout-1"));
    });

    // THEN
    expect(setUserProfile).toHaveBeenCalledWith(expect.any(Function));
    expect(result.current.favoriteLayoutIds).toEqual(["layout-1"]);
  });

  it("Given a layout is already favourite, when toggled, then it is removed and persisted", async () => {
    // GIVEN
    mockProfileStorage({
      favoriteLayoutIds: [LayoutBuilder.layoutId("layout-1"), LayoutBuilder.layoutId("layout-2")],
    });
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
