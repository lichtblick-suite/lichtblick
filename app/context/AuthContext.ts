// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export interface CurrentUser {
  email?: string;
  logout: () => Promise<void>;
}

export interface Auth {
  currentUser?: CurrentUser;

  /** Log in via the default flow, e.g. by opening a login page in another window/browser. */
  login: () => Promise<void>;

  /**
   * Log in with a manually pasted token, for example if the normal login flow failed. This is
   * particularly important for dev mode on Linux where setAsDefaultProtocolClient doesn't work.
   */
  loginWithCredential: (credential: string) => Promise<void>;
}

const AuthContext = createContext<Auth | undefined>(undefined);

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("An AuthContext provider is required to useAuth");
  }
  return ctx;
}

export default AuthContext;
