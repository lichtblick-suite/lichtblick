/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, waitFor } from "@testing-library/react";
import * as _ from "lodash-es";
import { PropsWithChildren } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { LOCAL_STORAGE_PROFILE_DATA } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { RemoteUserProfileStorageContext } from "@lichtblick/suite-base/context/RemoteUserProfileStorageContext";
import {
  UserProfile,
  useUserProfileStorage,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import UserProfileLocalStorageProvider from "@lichtblick/suite-base/providers/UserProfileLocalStorageProvider";
import { IRemoteUserProfileStorage } from "@lichtblick/suite-base/services/IRemoteUserProfileStorage";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/hooks");
jest.mock("lodash-es");

const mockedUseShallowMemo = jest.mocked(useShallowMemo);
const mockedLodash = jest.mocked(_);
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

describe("UserProfileLocalStorageProvider", () => {
  const createLayoutId = (id: string): LayoutID => id as LayoutID;

  const mockUserProfile: UserProfile = {
    currentLayoutId: createLayoutId(BasicBuilder.string()),
    firstSeenTime: "2025-01-01T00:00:00.000Z",
    firstSeenTimeIsFirstLoad: true,
    onboarding: {
      settingsTooltipShownForPanelTypes: [BasicBuilder.string()],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(undefined);
    mockedUseShallowMemo.mockImplementation((obj) => obj);
    mockedLodash.merge.mockImplementation((target, source) => ({ ...target, ...source }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getUserProfile", () => {
    it("should return default profile when localStorage is empty", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue(undefined);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      const profile = await result.current.getUserProfile();

      // Then
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA);
      expect(profile).toEqual({});
    });

    it("should return parsed profile from localStorage when data exists", async () => {
      // Given
      const storedProfile = JSON.stringify(mockUserProfile);
      mockLocalStorage.getItem.mockReturnValue(storedProfile);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      const profile = await result.current.getUserProfile();

      // Then
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA);
      expect(profile).toEqual(mockUserProfile);
    });

    it("should return default profile when localStorage contains invalid JSON", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue("invalid-json");
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When & Then
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await expect(result.current.getUserProfile()).rejects.toThrow();

      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe("setUserProfile", () => {
    it("should store new profile when localStorage is empty", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue(undefined);
      const layoutId = BasicBuilder.string();
      const newProfile: UserProfile = { currentLayoutId: createLayoutId(layoutId) };

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await result.current.setUserProfile(newProfile);

      // Then
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA);
      expect(mockedLodash.merge).toHaveBeenCalledWith({}, newProfile);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_PROFILE_DATA,
        JSON.stringify({ currentLayoutId: layoutId }),
      );
    });

    it("should merge new profile with existing profile", async () => {
      // Given
      const existingProfile: UserProfile = {
        currentLayoutId: createLayoutId(BasicBuilder.string()),
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingProfile));
      const newProfile: UserProfile = { firstSeenTime: new Date().toISOString() };
      const mergedProfile = { ...existingProfile, ...newProfile };
      mockedLodash.merge.mockReturnValue(mergedProfile);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await result.current.setUserProfile(newProfile);

      // Then
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA);
      expect(mockedLodash.merge).toHaveBeenCalledWith(existingProfile, newProfile);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_PROFILE_DATA,
        JSON.stringify(mergedProfile),
      );
    });

    it("should handle function-based profile updates", async () => {
      // Given
      const existingProfile: UserProfile = {
        currentLayoutId: createLayoutId(BasicBuilder.string()),
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingProfile));
      const updateFunction = (prev: UserProfile) => ({
        ...prev,
        firstSeenTime: "2025-01-01T00:00:00.000Z",
      });
      const expectedResult = updateFunction(existingProfile);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await result.current.setUserProfile(updateFunction);

      // Then
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_PROFILE_DATA,
        JSON.stringify(expectedResult),
      );
    });

    it("should handle empty string from JSON.stringify", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue(undefined);
      const newProfile: UserProfile = {};
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockReturnValue(undefined);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await result.current.setUserProfile(newProfile);

      // Then
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_PROFILE_DATA, "");

      // Restore original JSON.stringify
      JSON.stringify = originalStringify;
    });
  });

  describe("firstSeenTime initialization", () => {
    const sysTime = new Date();

    beforeEach(() => {
      // Mock Date.now() to return a consistent timestamp
      jest.useFakeTimers();
      jest.setSystemTime(sysTime.getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should set firstSeenTime when profile is empty", () => {
      // Given
      const updateFunction = (old: UserProfile) => ({
        ...old,
        firstSeenTime: old.firstSeenTime ?? new Date().toISOString(),
        firstSeenTimeIsFirstLoad: old.firstSeenTimeIsFirstLoad ?? old.currentLayoutId == undefined,
      });

      // When
      const result = updateFunction({});

      // Then
      expect(result.firstSeenTime).toBe(sysTime.toISOString());
      expect(result.firstSeenTimeIsFirstLoad).toBe(true);
    });

    it("should set firstSeenTimeIsFirstLoad to false when currentLayoutId exists", () => {
      // Given
      const updateFunction = (old: UserProfile) => ({
        ...old,
        firstSeenTime: old.firstSeenTime ?? new Date().toISOString(),
        firstSeenTimeIsFirstLoad: old.firstSeenTimeIsFirstLoad ?? old.currentLayoutId == undefined,
      });

      // When
      const result = updateFunction({ currentLayoutId: createLayoutId("existing-layout") });

      // Then
      expect(result.firstSeenTimeIsFirstLoad).toBe(false);
    });

    it("should not override existing firstSeenTime", () => {
      // Given
      const existingFirstSeenTime = new Date().toISOString();
      const updateFunction = (old: UserProfile) => ({
        ...old,
        firstSeenTime: old.firstSeenTime ?? new Date().toISOString(),
        firstSeenTimeIsFirstLoad: old.firstSeenTimeIsFirstLoad ?? old.currentLayoutId == undefined,
      });

      // When
      const result = updateFunction({
        firstSeenTime: existingFirstSeenTime,
        firstSeenTimeIsFirstLoad: false,
      });

      // Then
      expect(result.firstSeenTime).toBe(existingFirstSeenTime);
      expect(result.firstSeenTimeIsFirstLoad).toBe(false);
    });

    it("should handle errors during profile initialization", () => {
      // Given
      const errorMessage = "Storage error";

      // When
      const updateFunction = (_old: UserProfile) => {
        throw new Error(errorMessage);
      };

      // Then
      expect(() => updateFunction({})).toThrow(errorMessage);
    });
  });

  describe("provider integration", () => {
    it("should use useShallowMemo for performance optimization", () => {
      // Given
      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      renderHook(() => useUserProfileStorage(), { wrapper });

      // Then
      expect(mockedUseShallowMemo).toHaveBeenCalledWith({
        getUserProfile: expect.any(Function),
        setUserProfile: expect.any(Function),
      });
    });
  });

  describe("edge cases", () => {
    it("should handle undefined localStorage item correctly", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue(undefined as any);

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      const profile = await result.current.getUserProfile();

      // Then
      expect(profile).toEqual({});
    });

    it("should handle null values in profile updates", async () => {
      // Given
      mockLocalStorage.getItem.mockReturnValue(undefined);
      const profileWithNulls: Partial<UserProfile> = {
        currentLayoutId: undefined,
        firstSeenTime: undefined,
      };

      const wrapper = ({ children }: PropsWithChildren) => (
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      );

      // When
      const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
      await result.current.setUserProfile(profileWithNulls);

      // Then
      expect(mockedLodash.merge).toHaveBeenCalledWith({}, profileWithNulls);
    });
  });

  describe("with remote storage", () => {
    const mockRemote: jest.Mocked<IRemoteUserProfileStorage> = {
      getUserProfile: jest.fn(),
      setUserProfile: jest.fn(),
    };

    const wrapper = ({ children }: PropsWithChildren) => (
      <RemoteUserProfileStorageContext.Provider value={mockRemote}>
        <UserProfileLocalStorageProvider>{children}</UserProfileLocalStorageProvider>
      </RemoteUserProfileStorageContext.Provider>
    );

    beforeEach(() => {
      mockRemote.getUserProfile.mockReset().mockResolvedValue({});
      mockRemote.setUserProfile.mockReset().mockResolvedValue(undefined);
    });

    describe("getUserProfile", () => {
      it("should return the remote profile and cache it in localStorage", async () => {
        // Given
        const remoteProfile: UserProfile = { currentLayoutId: createLayoutId("remote-layout") };
        mockRemote.getUserProfile.mockResolvedValue(remoteProfile);

        // When
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        const profile = await result.current.getUserProfile();

        // Then
        expect(profile).toEqual(remoteProfile);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          LOCAL_STORAGE_PROFILE_DATA,
          JSON.stringify(remoteProfile),
        );
      });

      it("should fall back to the cached local profile when the remote call fails", async () => {
        // Given
        const localProfile: UserProfile = { currentLayoutId: createLayoutId("local-layout") };
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localProfile));
        mockRemote.getUserProfile.mockRejectedValue(new Error("network error"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // When
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        const profile = await result.current.getUserProfile();

        // Then
        expect(profile).toEqual(localProfile);
        expect(consoleSpy).toHaveBeenCalled();

        // Cleanup
        consoleSpy.mockRestore();
      });
    });

    describe("setUserProfile", () => {
      it("should persist locally and forward the merged profile to remote", async () => {
        // Given
        mockLocalStorage.getItem.mockReturnValue(undefined);
        const newProfile: UserProfile = { currentLayoutId: createLayoutId("new-layout") };

        // When
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        await result.current.setUserProfile(newProfile);

        // Then
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          LOCAL_STORAGE_PROFILE_DATA,
          JSON.stringify(newProfile),
        );
        expect(mockRemote.setUserProfile).toHaveBeenCalledWith(newProfile);
      });

      it("should keep the local write even when the remote call fails", async () => {
        // Given
        mockLocalStorage.getItem.mockReturnValue(undefined);
        const newProfile: UserProfile = { currentLayoutId: createLayoutId("new-layout") };
        mockRemote.setUserProfile.mockRejectedValue(new Error("network error"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // When
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        await expect(result.current.setUserProfile(newProfile)).resolves.toBeUndefined();

        // Then
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          LOCAL_STORAGE_PROFILE_DATA,
          JSON.stringify(newProfile),
        );
        expect(consoleSpy).toHaveBeenCalled();

        // Cleanup
        consoleSpy.mockRestore();
      });

      it("should merge against the freshly-hydrated remote profile on the very first write of the session, not a stale/empty local cache", async () => {
        // Given: local storage mock simulates real read-after-write persistence (the fixed
        // mockReturnValue pattern used elsewhere in this file can't exercise "hydration writes to
        // local cache, a later read observes it", which is what real (synchronous) localStorage does).
        let stored: string | undefined;
        mockLocalStorage.getItem.mockImplementation(() => stored);
        mockLocalStorage.setItem.mockImplementation((_key: string, value: string) => {
          stored = value;
        });
        const remoteProfile: UserProfile = {
          currentLayoutId: createLayoutId("layout-from-other-device"),
        };
        mockRemote.getUserProfile.mockResolvedValue(remoteProfile);
        const partialUpdate: UserProfile = { firstSeenTime: "2025-01-01T00:00:00.000Z" };

        // When: the provider mounts (its own firstSeenTime effect also calls setUserProfile
        // concurrently - let it settle first so the following call is unambiguously ours).
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        await waitFor(() => {
          expect(mockRemote.setUserProfile).toHaveBeenCalled();
        });
        mockRemote.setUserProfile.mockClear();

        await result.current.setUserProfile(partialUpdate);

        // Then: the remote profile must have been fetched (only once, cached) and merged in, not
        // clobbered by an empty local cache.
        expect(mockRemote.getUserProfile).toHaveBeenCalledTimes(1);
        expect(mockRemote.setUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({ ...remoteProfile, ...partialUpdate }),
        );
      });

      it("should only hydrate from remote once per mount across multiple setUserProfile calls", async () => {
        // Given
        mockLocalStorage.getItem.mockReturnValue(undefined);
        mockRemote.getUserProfile.mockResolvedValue({});

        // When
        const { result } = renderHook(() => useUserProfileStorage(), { wrapper });
        await result.current.setUserProfile({ currentLayoutId: createLayoutId("layout-1") });
        await result.current.setUserProfile({ currentLayoutId: createLayoutId("layout-2") });

        // Then
        expect(mockRemote.getUserProfile).toHaveBeenCalledTimes(1);
      });
    });
  });
});
