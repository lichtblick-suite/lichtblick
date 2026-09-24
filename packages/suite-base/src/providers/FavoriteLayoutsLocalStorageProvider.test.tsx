/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import { LOCAL_STORAGE_FAVORITE_LAYOUT_IDS } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useFavoriteLayoutsStorage } from "@lichtblick/suite-base/context/FavoriteLayoutsStorageContext";
import { RemoteFavoriteLayoutsStorageContext } from "@lichtblick/suite-base/context/RemoteFavoriteLayoutsStorageContext";
import FavoriteLayoutsLocalStorageProvider from "@lichtblick/suite-base/providers/FavoriteLayoutsLocalStorageProvider";
import { IRemoteFavoriteLayoutsStorage } from "@lichtblick/suite-base/services/IRemoteFavoriteLayoutsStorage";
import { BasicBuilder } from "@lichtblick/test-builders";

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

const createLayoutId = (id: string): LayoutID => id as LayoutID;

const wrapper = ({ children }: PropsWithChildren) => (
  <FavoriteLayoutsLocalStorageProvider>{children}</FavoriteLayoutsLocalStorageProvider>
);

describe("FavoriteLayoutsLocalStorageProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(undefined);
  });

  describe("without remote storage", () => {
    describe("getFavoriteLayoutIds", () => {
      it("should return an empty list when localStorage is empty", async () => {
        // When
        const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper });
        const ids = await result.current.getFavoriteLayoutIds();

        // Then
        expect(ids).toEqual([]);
      });

      it("should return the parsed ids from localStorage when present", async () => {
        // Given
        const storedIds = [createLayoutId("layout-1")];
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedIds));

        // When
        const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper });
        const ids = await result.current.getFavoriteLayoutIds();

        // Then
        expect(ids).toEqual(storedIds);
      });
    });

    describe("toggleFavoriteLayout", () => {
      it("should add the id and persist it locally when it is not yet a favourite", async () => {
        // Given
        const layoutId = createLayoutId(BasicBuilder.string());

        // When
        const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper });
        await result.current.toggleFavoriteLayout(layoutId);

        // Then
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          LOCAL_STORAGE_FAVORITE_LAYOUT_IDS,
          JSON.stringify([layoutId]),
        );
      });

      it("should remove the id when it is already a favourite", async () => {
        // Given
        const layoutId = createLayoutId("layout-1");
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify([layoutId]));

        // When
        const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper });
        await result.current.toggleFavoriteLayout(layoutId);

        // Then
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          LOCAL_STORAGE_FAVORITE_LAYOUT_IDS,
          JSON.stringify([]),
        );
      });
    });
  });

  describe("with remote storage", () => {
    const mockRemote: jest.Mocked<IRemoteFavoriteLayoutsStorage> = {
      getFavoriteLayoutIds: jest.fn(),
      addFavoriteLayout: jest.fn(),
      removeFavoriteLayout: jest.fn(),
    };

    const remoteWrapper = ({ children }: PropsWithChildren) => (
      <RemoteFavoriteLayoutsStorageContext.Provider value={mockRemote}>
        <FavoriteLayoutsLocalStorageProvider>{children}</FavoriteLayoutsLocalStorageProvider>
      </RemoteFavoriteLayoutsStorageContext.Provider>
    );

    beforeEach(() => {
      mockRemote.getFavoriteLayoutIds.mockReset().mockResolvedValue([]);
      mockRemote.addFavoriteLayout.mockReset().mockResolvedValue(undefined);
      mockRemote.removeFavoriteLayout.mockReset().mockResolvedValue(undefined);
    });

    it("should return the remote ids and cache them locally", async () => {
      // Given
      const remoteIds = [createLayoutId("remote-layout")];
      mockRemote.getFavoriteLayoutIds.mockResolvedValue(remoteIds);

      // When
      const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper: remoteWrapper });
      const ids = await result.current.getFavoriteLayoutIds();

      // Then
      expect(ids).toEqual(remoteIds);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_FAVORITE_LAYOUT_IDS,
        JSON.stringify(remoteIds),
      );
    });

    it("should fall back to the local cache when the remote call fails", async () => {
      // Given
      const localIds = [createLayoutId("local-layout")];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localIds));
      mockRemote.getFavoriteLayoutIds.mockRejectedValue(new Error("network error"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      // When
      const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper: remoteWrapper });
      const ids = await result.current.getFavoriteLayoutIds();

      // Then
      expect(ids).toEqual(localIds);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should call addFavoriteLayout when the layout is not yet a favourite", async () => {
      // Given
      const layoutId = createLayoutId("layout-1");
      mockRemote.getFavoriteLayoutIds.mockResolvedValue([]);

      // When
      const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper: remoteWrapper });
      await result.current.toggleFavoriteLayout(layoutId);

      // Then
      expect(mockRemote.addFavoriteLayout).toHaveBeenCalledWith(layoutId);
      expect(mockRemote.removeFavoriteLayout).not.toHaveBeenCalled();
    });

    it("should call removeFavoriteLayout when the layout is already a favourite", async () => {
      // Given
      const layoutId = createLayoutId("layout-1");
      mockRemote.getFavoriteLayoutIds.mockResolvedValue([layoutId]);

      // When
      const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper: remoteWrapper });
      await result.current.toggleFavoriteLayout(layoutId);

      // Then
      expect(mockRemote.removeFavoriteLayout).toHaveBeenCalledWith(layoutId);
      expect(mockRemote.addFavoriteLayout).not.toHaveBeenCalled();
    });

    it("should keep the local write even when the remote call fails", async () => {
      // Given
      const layoutId = createLayoutId("layout-1");
      mockRemote.getFavoriteLayoutIds.mockResolvedValue([]);
      mockRemote.addFavoriteLayout.mockRejectedValue(new Error("network error"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      // When
      const { result } = renderHook(() => useFavoriteLayoutsStorage(), { wrapper: remoteWrapper });
      await expect(result.current.toggleFavoriteLayout(layoutId)).resolves.toBeUndefined();

      // Then
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_FAVORITE_LAYOUT_IDS,
        JSON.stringify([layoutId]),
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
