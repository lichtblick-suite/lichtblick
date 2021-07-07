// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useState } from "react";

import { AppConfigurationContext, AppConfiguration } from "@foxglove/studio-base";

export default function AppConfigurationProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const [ctx] = useState(() => {
    return {
      get() {
        return undefined;
      },
      async set() {},
      addChangeListener() {},
      removeChangeListener() {},
    } as AppConfiguration;
  });

  return (
    <AppConfigurationContext.Provider value={ctx}>
      {props.children}
    </AppConfigurationContext.Provider>
  );
}
