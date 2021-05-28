// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  User,
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  OAuthCredential,
  AuthCredential,
} from "@firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToasts } from "react-toast-notifications";

import Log from "@foxglove/log";
import { AuthContext, Auth, CurrentUser } from "@foxglove/studio-base";
import useShallowMemo from "@foxglove/studio-base/hooks/useShallowMemo";

import { useFirebase } from "../context/FirebaseAppContext";

const log = Log.getLogger(__filename);

type Props = {
  /** Authenticate and return a Firebase credential */
  getCredential: () => Promise<AuthCredential>;
};

export default function FirebaseAuthProvider({
  children,
  getCredential,
}: React.PropsWithChildren<Props>): JSX.Element {
  const app = useFirebase();

  const [user, setUser] = useState<User | undefined>();
  const { addToast } = useToasts();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      getAuth(app),
      (newUser) => {
        setUser(newUser ?? undefined);
      },
      (err) => {
        addToast(`Authentication failed: ${err.toString()}`, { appearance: "error" });
        console.error("Auth error", err);
      },
    );
    return unsubscribe;
  }, [addToast, app]);

  const loginWithCredential = useCallback(
    async (credentialStr: string) => {
      const authCredential: AuthCredential = JSON.parse(credentialStr);
      if (authCredential.providerId !== "google.com" /* ProviderId.GOOGLE */) {
        addToast(`Login failed: unsupported credential provider.`, {
          appearance: "error",
        });
        return;
      }
      const oauthCredential = OAuthCredential.fromJSON(authCredential);
      if (!oauthCredential) {
        addToast(`Login failed: invalid credential data.`, {
          appearance: "error",
        });
        return;
      }
      const credential = await signInWithCredential(getAuth(app), oauthCredential);
      log.debug("signed in:", credential);
    },
    [addToast, app],
  );

  const login = useCallback(async () => {
    try {
      const credential = await getCredential();
      return loginWithCredential(JSON.stringify(credential.toJSON()));
    } catch (error) {
      addToast(`Login error: ${error.toString()}`, { appearance: "error" });
    }
  }, [addToast, getCredential, loginWithCredential]);

  const logout = useCallback(async () => {
    try {
      await signOut(getAuth(app));
    } catch (error) {
      addToast(`Logout error: ${error.toString()}`, { appearance: "error" });
    }
  }, [addToast, app]);

  const currentUser = useMemo<CurrentUser | undefined>(() => {
    if (user == undefined) {
      return undefined;
    }
    return {
      email: user.email ?? undefined,
      logout,
    };
  }, [logout, user]);

  const value = useShallowMemo<Auth>({
    currentUser,
    login,
    loginWithCredential,
  });
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
