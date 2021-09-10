// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

import AccountInfo from "./AccountInfo";

class FakeConsoleApi extends ConsoleApi {
  constructor() {
    super("");
  }
}

export default {
  title: "AccountSettingsSidebar/AccountInfo",
  component: AccountInfo,
};

export const SignedIn = (): JSX.Element => {
  const me = {
    id: "fake-userid",
    orgId: "fake-orgid",
    orgDisplayName: "Fake Org",
    orgSlug: "fake-org",
    orgPaid: false,
    email: "foo@example.com",
  };

  const fakeConsoleApi = new FakeConsoleApi();

  return (
    <ConsoleApiContext.Provider value={fakeConsoleApi}>
      <AccountInfo currentUser={me} />
    </ConsoleApiContext.Provider>
  );
};
