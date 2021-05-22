// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import {
  UserProfile,
  UserProfileStorageContext,
} from "@foxglove/studio-base/context/UserProfileStorageContext";
import useShallowMemo from "@foxglove/studio-base/hooks/useShallowMemo";

const DEFAULT_PROFILE: UserProfile = {};
const LOCAL_STORAGE_KEY = "studio.profile-data";

/**
 * A provider for UserProfileStorage that stores data in localStorage.
 */
export default function UserProfileLocalStorageProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const getUserProfile = useCallback(async (): Promise<UserProfile> => {
    const item = localStorage.getItem(LOCAL_STORAGE_KEY);
    return item != undefined ? (JSON.parse(item) as UserProfile) : DEFAULT_PROFILE;
  }, []);
  const setUserProfile = useCallback(async (profile: UserProfile) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  }, []);
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
