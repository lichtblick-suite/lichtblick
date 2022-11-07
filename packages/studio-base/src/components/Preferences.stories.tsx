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

import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { fromDate } from "@foxglove/rostime";
import Preferences from "@foxglove/studio-base/components/Preferences";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import AppConfigurationContext, {
  AppConfigurationValue,
} from "@foxglove/studio-base/context/AppConfigurationContext";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

export default {
  title: "components/Preferences",
  component: Preferences,
};

function Wrapper({ entries }: { entries?: [string, AppConfigurationValue][] }): React.ReactElement {
  const [config] = useState(() => makeMockAppConfiguration(entries));
  const timeVal = fromDate(new Date("2020-01-01"));

  return (
    <AppConfigurationContext.Provider value={config}>
      <Timestamp time={timeVal} />
      <Preferences />
    </AppConfigurationContext.Provider>
  );
}

export function Default(): JSX.Element {
  return <Wrapper />;
}

export function DefaultWithTimezone(): JSX.Element {
  return <Wrapper entries={[["timezone", "UTC"]]} />;
}

ChangingTimezone.parameters = { colorScheme: "light" };
export function ChangingTimezone(): JSX.Element {
  return <Wrapper />;
}
ChangingTimezone.play = async () => {
  const user = userEvent.setup();
  const input = await screen.findByDisplayValue("Detect from system", { exact: false });
  await user.click(input);

  await userEvent.keyboard("UTC (+00:00)");
  const item = await screen.findByText("UTC", { exact: false });
  await user.click(item);
};

ChangingTimeFormat.parameters = { colorScheme: "light" };
export function ChangingTimeFormat(): JSX.Element {
  return <Wrapper />;
}
ChangingTimeFormat.play = async () => {
  const user = userEvent.setup();
  const inputs = await screen.findAllByTestId("timeformat-local");
  await user.click(inputs[0]!);

  const item = await screen.findByTestId("timeformat-seconds");
  await user.click(item);
};
