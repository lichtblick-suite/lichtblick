// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { useAsync, useLocalStorage } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import {
  useConsoleApi,
  DeviceCodeDialog,
  CurrentUserContext,
  User,
  Session,
} from "@foxglove/studio-base";

const log = Logger.getLogger(__filename);

/**
 * ConsoleApiCurrentUserProvider attempts to load the current user's profile if there is an authenticated
 * session.
 *
 * ConsoleApiCurrentUserProvider provides a CurrentUserContext
 */
export default function ConsoleApiCurrentUserProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const api = useConsoleApi();
  const [bearerToken, setBearerToken, removeBearerToken] =
    useLocalStorage<string>("fox.bearer-token");
  const [modalOpen, setModalOpen] = useState(false);

  // We want to support starting the app while offline. Various children components of the provider
  // use the presence of the user as an indicator of sign-in state. We cache the user to provide a
  // stale-while-loading value so the app can open with no connection and update the cached record
  // once online.
  const [cachedCurrentUser, setCachedCurrentUser, removeCachedCurrentUser] = useLocalStorage<User>(
    "fox.current-user",
    undefined,
    {
      raw: false,
      serializer: (value: User) => JSON.stringify(value),
      deserializer: (value: string) => JSON.parse(value) as User,
    },
  );

  // If we don't have a cached user, the first loading pass prevents rendering the provider and
  // children. Future loading effects don't prevent rendering the provider to avoid flashing the
  // screen.
  const [completedFirstLoad, setCompletedFirstLoad] = useState(cachedCurrentUser != undefined);

  // When we have a valid token, we need to set the api auth header so child components can make
  // authenticated requests
  useMemo(() => {
    if (!bearerToken) {
      return;
    }
    api.setAuthHeader(`Bearer ${bearerToken}`);
  }, [api, bearerToken]);

  useAsync(async () => {
    try {
      if (!bearerToken) {
        return undefined;
      }
      const me = await api.me();
      setCachedCurrentUser(me);
      return me;
    } catch (error) {
      log.error(error);
      return undefined;
    } finally {
      setCompletedFirstLoad(true);
    }
  }, [api, bearerToken, setCachedCurrentUser]);

  const signOut = useCallback(async () => {
    removeBearerToken();
    removeCachedCurrentUser();
    await api.signout();
  }, [api, removeBearerToken, removeCachedCurrentUser]);

  const onClose = useCallback(
    (session?: Session) => {
      setModalOpen(false);
      if (session != undefined) {
        setBearerToken(session.bearerToken);
      }
    },
    [setBearerToken],
  );

  const signIn = useCallback(() => {
    setModalOpen(true);
  }, []);

  const value = useShallowMemo({ currentUser: cachedCurrentUser, signIn, signOut });

  // On mount we start loading a profile. To avoid rendering children without a profile and then
  // again with a profile after load, we render nothing until the first load is complete.
  if (!completedFirstLoad) {
    return <></>;
  }

  return (
    <>
      {modalOpen && <DeviceCodeDialog onClose={onClose} />}
      <CurrentUserContext.Provider value={value}>{props.children}</CurrentUserContext.Provider>
    </>
  );
}
