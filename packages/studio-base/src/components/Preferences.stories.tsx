// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";
import { useState } from "react";

import Preferences from "@foxglove/studio-base/components/Preferences";
import AppConfigurationContext, {
  AppConfigurationValue,
} from "@foxglove/studio-base/context/AppConfigurationContext";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

export function Default({
  entries,
}: {
  entries?: [string, AppConfigurationValue][];
}): React.ReactElement {
  const [config] = useState(() => makeMockAppConfiguration(entries));
  return (
    <AppConfigurationContext.Provider value={config}>
      <Preferences />
    </AppConfigurationContext.Provider>
  );
}

storiesOf("components/Preferences", module)
  .add("default", () => {
    return <Default />;
  })
  .add("with timezone", () => {
    return <Default entries={[["timezone", "America/Los_Angeles"]]} />;
  });
