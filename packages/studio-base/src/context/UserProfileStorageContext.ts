// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

export type UserProfile = {
  /** The id of the layout the user is currently working with. */
  currentLayoutId?: LayoutID;
};

export type UserProfileStorage = {
  getUserProfile: () => Promise<UserProfile>;
  setUserProfile: (data: UserProfile) => Promise<void>;
};

export const UserProfileStorageContext = createContext<UserProfileStorage | undefined>(undefined);

export function useUserProfileStorage(): UserProfileStorage {
  const storage = useContext(UserProfileStorageContext);
  if (storage == undefined) {
    throw new Error("A UserProfileStorage provider is required to useUserProfileStorage");
  }

  return storage;
}
