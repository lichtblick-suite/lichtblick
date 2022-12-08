// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { User as ConsoleUser } from "@foxglove/studio-base/services/ConsoleApi";

export type User = ConsoleUser;

export interface CurrentUser {
  currentUser: User | undefined;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUser>({
  currentUser: undefined,
  signIn: () => {},
  signOut: async () => {},
});
CurrentUserContext.displayName = "CurrentUserContext";

export function useCurrentUser(): CurrentUser {
  return useContext(CurrentUserContext);
}

export default CurrentUserContext;
