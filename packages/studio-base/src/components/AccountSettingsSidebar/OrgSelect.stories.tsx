// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import OrgSelect from "@foxglove/studio-base/components/AccountSettingsSidebar/OrgSelect";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import ConsoleApi, { Org } from "@foxglove/studio-base/services/ConsoleApi";

class FakeConsoleApi extends ConsoleApi {
  constructor() {
    super("");
  }

  override orgs(): Promise<Org[]> {
    return Promise.resolve([{ id: "1234", slug: "Slug" }]);
  }
}

export default {
  title: "AccountSettingsSidebar/OrgSelect",
  component: OrgSelect,
};

export const SignedIn = (): JSX.Element => {
  const fakeConsoleApi = new FakeConsoleApi();

  return (
    <ConsoleApiContext.Provider value={fakeConsoleApi}>
      <OrgSelect idToken="test" onSelect={() => {}}></OrgSelect>
    </ConsoleApiContext.Provider>
  );
};
