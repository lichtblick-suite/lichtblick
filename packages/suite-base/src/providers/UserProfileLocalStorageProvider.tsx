// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { LOCAL_STORAGE_PROFILE_DATA } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { useRemoteUserProfileStorage } from "@lichtblick/suite-base/context/RemoteUserProfileStorageContext";
import {
  UserProfile,
  UserProfileStorageContext,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";

const DEFAULT_PROFILE: UserProfile = {};

/**
 * A provider for UserProfileStorage that stores data in localStorage, kept as a synchronous
 * working cache. When a RemoteUserProfileStorageContext is supplied (i.e. deployed with a
 * backend), the remote profile is treated as the source of truth: reads prefer remote (falling
 * back to the local cache on failure) and writes go to both, so the profile survives across
 * devices/browsers instead of being pinned to a single browser's localStorage.
 */
export default function UserProfileLocalStorageProvider({
  children,
}: React.PropsWithChildren): React.JSX.Element {
  const remote = useRemoteUserProfileStorage();

  const readLocalProfile = useCallback((): UserProfile => {
    const item = localStorage.getItem(LOCAL_STORAGE_PROFILE_DATA);
    return item != undefined ? (JSON.parse(item) as UserProfile) : DEFAULT_PROFILE;
  }, []);

  const writeLocalProfile = useCallback((profile: UserProfile) => {
    localStorage.setItem(LOCAL_STORAGE_PROFILE_DATA, JSON.stringify(profile) ?? "");
  }, []);

  const getUserProfile = useCallback(async (): Promise<UserProfile> => {
    if (!remote) {
      return readLocalProfile();
    }
    try {
      const remoteProfile = await remote.getUserProfile();
      writeLocalProfile(remoteProfile);
      return remoteProfile;
    } catch (err: unknown) {
      console.error(err);
      return readLocalProfile();
    }
  }, [remote, readLocalProfile, writeLocalProfile]);

  const setUserProfile = useCallback(
    async (value: UserProfile | ((prev: UserProfile) => UserProfile)) => {
      const prev = readLocalProfile();
      const newProfile = typeof value === "function" ? value(prev) : _.merge(prev, value);
      writeLocalProfile(newProfile);

      if (remote) {
        try {
          await remote.setUserProfile(newProfile);
        } catch (err: unknown) {
          console.error(err);
        }
      }
    },
    [remote, readLocalProfile, writeLocalProfile],
  );

  // On first load stamp firstSeenTime timestamp. We consider the time at which
  // we stamp firstTime as the first time the user has opened the app if at that
  // time there is no currentLayoutId already set in the profile.
  useEffect(() => {
    setUserProfile((old) => ({
      ...old,
      firstSeenTime: old.firstSeenTime ?? new Date().toISOString(),
      firstSeenTimeIsFirstLoad: old.firstSeenTimeIsFirstLoad ?? old.currentLayoutId == undefined,
    })).catch((err: unknown) => {
      console.error(err);
    });
  }, [setUserProfile]);

  const storage = useShallowMemo({
    getUserProfile,
    setUserProfile,
  });

  return (
    <UserProfileStorageContext.Provider value={storage}>
      {children}
    </UserProfileStorageContext.Provider>
  );
}
