// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";
import { useAsync } from "react-use";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import AppConfigurationContext from "@foxglove-studio/app/context/AppConfigurationContext";
import OsContextAppConfiguration from "@foxglove-studio/app/services/OsContextAppConfiguration";
import Log from "@foxglove/log";

const log = Log.getLogger(__filename);

export default function OsContextAppConfigurationProvider({
  children,
}: PropsWithChildren<unknown>): React.ReactElement | ReactNull {
  const { value, error } = useAsync(() => {
    if (!OsContextSingleton) {
      throw new Error("OsContext is not available");
    }

    log.debug("Initializing app configuration");
    return OsContextAppConfiguration.Initialize(OsContextSingleton);
  }, []);

  if (error) {
    throw error;
  }

  // do not render any children until the configuration is loaded
  if (!value) {
    return ReactNull;
  }

  return (
    <AppConfigurationContext.Provider value={value}>{children}</AppConfigurationContext.Provider>
  );
}
