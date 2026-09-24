// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { FavoriteLayoutsAPI } from "./FavoriteLayoutsAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("FavoriteLayoutsAPI", () => {
  let favoriteLayoutsAPI: FavoriteLayoutsAPI;

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    favoriteLayoutsAPI = new FavoriteLayoutsAPI();
    jest.clearAllMocks();
  });

  describe("getFavoriteLayoutIds", () => {
    it("should fetch and unwrap the favourite layout ids from the response", async () => {
      // Given
      const favoriteLayouts = BasicBuilder.strings();
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ favoriteLayouts }));
      jest.mocked(HttpService).get = mockGet;

      // When
      const result = await favoriteLayoutsAPI.getFavoriteLayoutIds();

      // Then
      expect(mockGet).toHaveBeenCalledWith("profile/favorite-layouts");
      expect(result).toEqual(favoriteLayouts);
    });
  });

  describe("addFavoriteLayout", () => {
    it("should post the layout id to the favorites endpoint", async () => {
      // Given
      const layoutId = BasicBuilder.string() as LayoutID;
      const mockPost = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      jest.mocked(HttpService).post = mockPost;

      // When
      await favoriteLayoutsAPI.addFavoriteLayout(layoutId);

      // Then
      expect(mockPost).toHaveBeenCalledWith("profile/layout", { layoutId });
    });
  });

  describe("removeFavoriteLayout", () => {
    it("should delete the layout id from the favorites endpoint", async () => {
      // Given
      const layoutId = BasicBuilder.string() as LayoutID;
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      jest.mocked(HttpService).delete = mockDelete;

      // When
      await favoriteLayoutsAPI.removeFavoriteLayout(layoutId);

      // Then
      expect(mockDelete).toHaveBeenCalledWith(`profile/${layoutId}/layout`);
    });
  });
});
