// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { LOCAL_STORAGE_PROFILE_DATA } from "@lichtblick/suite-base/constants/browserStorageKeys";
import {
  UserProfile,
  UserProfileStorageContext,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";

const DEFAULT_PROFILE: UserProfile = {};

/**
 * A provider for UserProfileStorage that stores data in localStorage.
 */
export default function UserProfileLocalStorageProvider({
  children,
}: React.PropsWithChildren): React.JSX.Element {
  const getUserProfile = useCallback(async (): Promise<UserProfile> => {
    const item = localStorage.getItem(LOCAL_STORAGE_PROFILE_DATA);
    return item != undefined ? (JSON.parse(item) as UserProfile) : DEFAULT_PROFILE;
  }, []);

  const setUserProfile = useCallback(
    async (value: UserProfile | ((prev: UserProfile) => UserProfile)) => {
      const item = localStorage.getItem(LOCAL_STORAGE_PROFILE_DATA);
      const prev = item != undefined ? (JSON.parse(item) as UserProfile) : DEFAULT_PROFILE;
      const newProfile = typeof value === "function" ? value(prev) : _.merge(prev, value);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_DATA, JSON.stringify(newProfile) ?? "");
    },
    [],
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
