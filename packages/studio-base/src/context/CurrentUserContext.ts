// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export interface User {
  id: string;
  orgId: string;
  email: string;
}

export interface CurrentUser {
  currentUser: User | undefined;
  setBearerToken: (token: string) => void;
  signOut: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUser>({
  currentUser: undefined,
  setBearerToken: () => {},
  signOut: async () => {},
});

export function useCurrentUser(): CurrentUser {
  return useContext(CurrentUserContext);
}

export default CurrentUserContext;
