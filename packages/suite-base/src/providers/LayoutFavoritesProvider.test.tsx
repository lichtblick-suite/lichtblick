/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook, waitFor } from "@testing-library/react";
import { PropsWithChildren } from "react";

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutFavorites } from "@lichtblick/suite-base/context/LayoutFavoritesContext";
import LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import { RemoteLayoutFavoritesStorageContext } from "@lichtblick/suite-base/context/RemoteLayoutFavoritesStorageContext";
import {
  UserProfile,
  UserProfileStorage,
  UserProfileStorageContext,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutFavoritesProvider from "./LayoutFavoritesProvider";

function makeUserProfileStorage(initial: UserProfile = {}): UserProfileStorage & {
  profile: () => UserProfile;
} {
  let profile = initial;
  return {
    profile: () => profile,
    getUserProfile: jest.fn(async () => profile),
    setUserProfile: jest.fn(async (update) => {
      profile = typeof update === "function" ? update(profile) : update;
    }),
  };
}

function makeRemoteStorage(ids: string[] = []): jest.Mocked<IRemoteLayoutFavoritesStorage> {
  return {
    getFavoriteLayoutIds: jest.fn().mockResolvedValue(ids),
    addFavoriteLayout: jest.fn().mockResolvedValue(undefined),
    removeFavoriteLayout: jest.fn().mockResolvedValue(undefined),
  };
}

async function setup({
  remote,
  profileStorage = makeUserProfileStorage(),
  online = true,
}: {
  remote?: IRemoteLayoutFavoritesStorage;
  profileStorage?: UserProfileStorage;
  online?: boolean;
}) {
  const layoutManager = new MockLayoutManager();
  layoutManager.isOnline = online;
  function Wrapper({ children }: PropsWithChildren): React.JSX.Element {
    return (
      <LayoutManagerContext.Provider value={layoutManager}>
        <UserProfileStorageContext.Provider value={profileStorage}>
          <RemoteLayoutFavoritesStorageContext.Provider value={remote}>
            <LayoutFavoritesProvider>{children}</LayoutFavoritesProvider>
          </RemoteLayoutFavoritesStorageContext.Provider>
        </UserProfileStorageContext.Provider>
      </LayoutManagerContext.Provider>
    );
  }
  const hook = renderHook(() => useLayoutFavorites(), { wrapper: Wrapper });
  // Let the initial favorites loads settle.
  await act(async () => {
    await Promise.resolve();
  });
  return { ...hook, layoutManager };
}

const personalLayout = () => LayoutBuilder.layout({ permission: "CREATOR_WRITE" });
const sharedLayout = () =>
  LayoutBuilder.layout({ permission: "ORG_WRITE", externalId: BasicBuilder.string() });

describe("LayoutFavoritesProvider", () => {
  describe("personal layouts", () => {
    it("Given favorites in the user profile, when mounted, then those layouts are favorites", async () => {
      const layout = personalLayout();
      const profileStorage = makeUserProfileStorage({ favoriteLayoutIds: [layout.id] });

      const { result } = await setup({ profileStorage });

      await waitFor(() => {
        expect(result.current.isFavorite(layout)).toBe(true);
      });
      expect(result.current.isFavorite(personalLayout())).toBe(false);
    });

    it("Given no remote storage, when checking, then personal layouts can still be favorited", async () => {
      const { result } = await setup({ remote: undefined });

      expect(result.current.canFavorite(personalLayout())).toBe(true);
    });

    it("When adding and removing a favorite, then the user profile is updated", async () => {
      const layout = personalLayout();
      const profileStorage = makeUserProfileStorage();
      const { result } = await setup({ profileStorage });

      await act(async () => {
        await result.current.setFavorite(layout, { favorite: true });
      });
      expect(result.current.isFavorite(layout)).toBe(true);
      expect(profileStorage.profile().favoriteLayoutIds).toEqual([layout.id]);

      await act(async () => {
        await result.current.setFavorite(layout, { favorite: false });
      });
      expect(result.current.isFavorite(layout)).toBe(false);
      expect(profileStorage.profile().favoriteLayoutIds).toEqual([]);
    });

    it("Given the initial load is still pending, when adding a favorite, then the late load does not overwrite it", async () => {
      const layout = personalLayout();
      const profileStorage = makeUserProfileStorage();
      let resolveInitialLoad: (profile: UserProfile) => void = () => {};
      (profileStorage.getUserProfile as jest.Mock).mockReturnValueOnce(
        new Promise<UserProfile>((resolve) => {
          resolveInitialLoad = resolve;
        }),
      );
      const { result } = await setup({ profileStorage });

      await act(async () => {
        await result.current.setFavorite(layout, { favorite: true });
      });
      await act(async () => {
        resolveInitialLoad({});
      });

      expect(result.current.isFavorite(layout)).toBe(true);
    });

    it("Given the user profile cannot be saved, when adding a favorite, then the change is rolled back", async () => {
      const layout = personalLayout();
      const profileStorage = makeUserProfileStorage();
      (profileStorage.setUserProfile as jest.Mock).mockRejectedValue(new Error("Quota exceeded"));
      const { result } = await setup({ profileStorage });

      await act(async () => {
        await expect(result.current.setFavorite(layout, { favorite: true })).rejects.toThrow(
          "Quota exceeded",
        );
      });
      expect(result.current.isFavorite(layout)).toBe(false);
    });

    it("Given a personal layout, when adding a favorite, then the remote storage is not used", async () => {
      const remote = makeRemoteStorage();
      const { result } = await setup({ remote });

      await act(async () => {
        await result.current.setFavorite(personalLayout(), { favorite: true });
      });
      expect(remote.addFavoriteLayout).not.toHaveBeenCalled();
    });
  });

  describe("shared layouts", () => {
    it("Given remote favorites, when online, then the matching shared layouts are favorites", async () => {
      const layout = sharedLayout();
      const remote = makeRemoteStorage([layout.externalId!]);

      const { result } = await setup({ remote });

      await waitFor(() => {
        expect(result.current.isFavorite(layout)).toBe(true);
      });
      expect(result.current.isFavorite(sharedLayout())).toBe(false);
    });

    it("Given the layout manager is offline, when mounted, then remote favorites are loaded once it goes online", async () => {
      const layout = sharedLayout();
      const remote = makeRemoteStorage([layout.externalId!]);

      const { result, layoutManager } = await setup({ remote, online: false });
      expect(remote.getFavoriteLayoutIds).not.toHaveBeenCalled();

      const onlineListener = layoutManager.on.mock.calls.find(
        ([event]) => event === "onlinechange",
      )?.[1] as () => void;
      layoutManager.isOnline = true;
      act(() => {
        onlineListener();
      });

      await waitFor(() => {
        expect(result.current.isFavorite(layout)).toBe(true);
      });
    });

    it("Given loading remote favorites fails, when mounted, then no shared layout is a favorite", async () => {
      const remote = makeRemoteStorage();
      remote.getFavoriteLayoutIds.mockRejectedValue(new Error("Not Found"));
      const layout = sharedLayout();

      const { result } = await setup({ remote });

      await waitFor(() => {
        expect(remote.getFavoriteLayoutIds).toHaveBeenCalled();
      });
      expect(result.current.isFavorite(layout)).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load remote favorite layouts"),
        expect.any(Error),
      );
      (console.error as jest.Mock).mockClear();
    });

    it("Given no remote storage, when checking, then shared layouts cannot be favorited", async () => {
      const { result } = await setup({ remote: undefined });

      expect(result.current.canFavorite(sharedLayout())).toBe(false);
    });

    it("Given a shared layout without an external id, when checking, then it cannot be favorited", async () => {
      const { result } = await setup({ remote: makeRemoteStorage() });

      expect(result.current.canFavorite({ ...sharedLayout(), externalId: undefined })).toBe(false);
    });

    it("When adding and removing a favorite, then the remote storage is called with the external id", async () => {
      const layout = sharedLayout();
      const remote = makeRemoteStorage();
      const { result } = await setup({ remote });

      await act(async () => {
        await result.current.setFavorite(layout, { favorite: true });
      });
      expect(remote.addFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
      expect(result.current.isFavorite(layout)).toBe(true);

      await act(async () => {
        await result.current.setFavorite(layout, { favorite: false });
      });
      expect(remote.removeFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
      expect(result.current.isFavorite(layout)).toBe(false);
    });

    it("Given the remote storage fails, when adding a favorite, then the change is rolled back", async () => {
      const layout = sharedLayout();
      const remote = makeRemoteStorage();
      remote.addFavoriteLayout.mockRejectedValue(new Error("Forbidden"));
      const { result } = await setup({ remote });

      await act(async () => {
        await expect(result.current.setFavorite(layout, { favorite: true })).rejects.toThrow(
          "Forbidden",
        );
      });
      expect(result.current.isFavorite(layout)).toBe(false);
    });

    it("Given no remote storage, when adding a favorite, then it throws", async () => {
      const { result } = await setup({ remote: undefined });

      await expect(result.current.setFavorite(sharedLayout(), { favorite: true })).rejects.toThrow(
        "cannot be marked as favorite",
      );
    });
  });

  it("Given personal and shared layouts with the same id, when favoriting the personal one, then the shared one is not a favorite", async () => {
    const id = BasicBuilder.string();
    const personal = LayoutBuilder.layout({ id: id as LayoutID, permission: "CREATOR_WRITE" });
    const shared = LayoutBuilder.layout({
      id: id as LayoutID,
      permission: "ORG_READ",
      externalId: id,
    });
    const { result } = await setup({ remote: makeRemoteStorage() });

    await act(async () => {
      await result.current.setFavorite(personal, { favorite: true });
    });

    expect(result.current.isFavorite(personal)).toBe(true);
    expect(result.current.isFavorite(shared)).toBe(false);
  });
});
