// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import RemoteLayoutStorageContext from "@foxglove/studio-base/context/RemoteLayoutStorageContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import ConsoleApiRemoteLayoutStorage from "@foxglove/studio-base/services/ConsoleApiRemoteLayoutStorage";

export default function ConsoleApiRemoteLayoutStorageProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const [enableConsoleApiLayouts = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_CONSOLE_API_LAYOUTS,
  );
  const api = useConsoleApi();
  const { currentUser } = useCurrentUser();

  const apiStorage = useMemo(
    () =>
      enableConsoleApiLayouts && currentUser
        ? new ConsoleApiRemoteLayoutStorage(currentUser.id, api)
        : undefined,
    [api, currentUser, enableConsoleApiLayouts],
  );

  return (
    <RemoteLayoutStorageContext.Provider value={apiStorage}>
      {children}
    </RemoteLayoutStorageContext.Provider>
  );
}
