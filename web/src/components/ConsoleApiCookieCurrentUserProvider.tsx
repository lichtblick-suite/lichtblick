// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useAsync } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import { useConsoleApi, CurrentUserContext, User } from "@foxglove/studio-base";

/**
 * ConsoleApiCookieUserProvider provides a CurrentUserContext
 *
 * On mount, it loads the current user profile if there is a session.
 */
export default function ConsoleApiCookieCurrentUserProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const api = useConsoleApi();

  const [currentUser, setCurrentUser] = useState<User | undefined>();

  // initial load of the user profile
  const { value: profile, loading: isLoading } = useAsync(async () => {
    // Presence of the fox.signedin cookie indicates we might have a valid session
    // we attempt to load the user's profile
    if (document.cookie.includes("fox.signedin")) {
      return await api.me();
    }
    return undefined;
  }, [api]);

  useEffect(() => {
    setCurrentUser(profile);
  }, [profile]);

  const signOut = useCallback(async () => {
    try {
      await api.signout();
    } finally {
      setCurrentUser(undefined);
    }
  }, [api]);

  // On signIn, direct the user to console to perform the account signin flow. This will set the correct
  // cookies and return the user back to studio
  const signIn = useCallback(() => {
    const currentLocation = encodeURIComponent(window.location.href);
    window.location.href = `https://console.foxglove.dev/signin?returnTo=${currentLocation}`;
  }, []);

  const value = useShallowMemo({ currentUser, signIn, signOut });

  if (isLoading) {
    return <></>;
  }

  return <CurrentUserContext.Provider value={value}>{props.children}</CurrentUserContext.Provider>;
}
