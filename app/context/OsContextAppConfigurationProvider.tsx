// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import AppConfigurationContext from "@foxglove-studio/app/context/AppConfigurationContext";
import OsContextAppConfiguration from "@foxglove-studio/app/services/OsContextAppConfiguration";

export default function OsContextAppConfigurationProvider({
  children,
}: PropsWithChildren<unknown>): React.ReactElement {
  const configuration = useMemo(() => {
    if (!OsContextSingleton) {
      return undefined;
    }
    return new OsContextAppConfiguration(OsContextSingleton);
  }, []);

  return (
    <AppConfigurationContext.Provider value={configuration}>
      {children}
    </AppConfigurationContext.Provider>
  );
}
