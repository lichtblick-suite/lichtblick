// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { LayoutFavoritesAPI } from "./LayoutFavoritesAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("LayoutFavoritesAPI", () => {
  let api: LayoutFavoritesAPI;
  const mockHttpService = jest.mocked(HttpService);

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    api = new LayoutFavoritesAPI();
    jest.clearAllMocks();
  });

  describe("getFavoriteLayoutIds", () => {
    it("should fetch the favorite layout ids of the current user", async () => {
      const favoriteLayouts = BasicBuilder.strings();
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ favoriteLayouts }));
      mockHttpService.get = mockGet;

      const result = await api.getFavoriteLayoutIds();

      expect(mockGet).toHaveBeenCalledWith("profile/favorite-layouts");
      expect(result).toEqual(favoriteLayouts);
    });

    it("should propagate HTTP errors", async () => {
      mockHttpService.get = jest.fn().mockRejectedValue(new Error("Network error"));

      await expect(api.getFavoriteLayoutIds()).rejects.toThrow("Network error");
    });
  });

  describe("addFavoriteLayout", () => {
    it("should PUT the layout id", async () => {
      const externalId = BasicBuilder.string();
      const mockPut = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.put = mockPut;

      await api.addFavoriteLayout(externalId);

      expect(mockPut).toHaveBeenCalledWith(`profile/favorite-layouts/${externalId}`);
    });

    it("should encode the layout id in the path", async () => {
      const mockPut = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.put = mockPut;

      await api.addFavoriteLayout("a/b");

      expect(mockPut).toHaveBeenCalledWith("profile/favorite-layouts/a%2Fb");
    });
  });

  describe("removeFavoriteLayout", () => {
    it("should DELETE the layout id", async () => {
      const externalId = BasicBuilder.string();
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.delete = mockDelete;

      await api.removeFavoriteLayout(externalId);

      expect(mockDelete).toHaveBeenCalledWith(`profile/favorite-layouts/${externalId}`);
    });

    it("should propagate HTTP errors", async () => {
      mockHttpService.delete = jest.fn().mockRejectedValue(new Error("Delete failed"));

      await expect(api.removeFavoriteLayout(BasicBuilder.string())).rejects.toThrow(
        "Delete failed",
      );
    });
  });
});
