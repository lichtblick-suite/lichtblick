/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";

import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";
import { useRemoteLayoutStorage } from "@foxglove/studio-base/context/RemoteLayoutStorageContext";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

import ConsoleApiRemoteLayoutStorageProvider from "./ConsoleApiRemoteLayoutStorageProvider";

class FakeConsoleApi extends ConsoleApi {
  public constructor() {
    super("");
  }
}

describe("ConsoleApiRemoteLayoutStorageProvider", () => {
  it("produces the same layout storage instance when currentUser changes, as long as currentUser.id remains the same", () => {
    const fakeApi = new FakeConsoleApi();
    const org: User["org"] = {
      id: "fake-orgid",
      slug: "fake-org",
      displayName: "Fake Org",
      isEnterprise: false,
      allowsUploads: false,
      supportsEdgeSites: false,
    };
    const initialUser: User = {
      id: "id",
      email: "foo@example.com",
      orgId: org.id,
      orgDisplayName: org.displayName,
      orgSlug: org.slug,
      orgPaid: true,
      org,
    };
    let user = initialUser;
    const { result, rerender } = renderHook(() => useRemoteLayoutStorage(), {
      initialProps: { user: initialUser },
      wrapper: ({ children }) => (
        <ConsoleApiContext.Provider value={fakeApi}>
          <CurrentUserContext.Provider
            value={{ currentUser: user, signIn: () => {}, signOut: async () => {} }}
          >
            <ConsoleApiRemoteLayoutStorageProvider>
              {children}
            </ConsoleApiRemoteLayoutStorageProvider>
          </CurrentUserContext.Provider>
        </ConsoleApiContext.Provider>
      ),
    });

    const initialResult = result.current;
    user = { ...initialUser };
    rerender();
    expect(result.current).toBe(initialResult);
    user = { ...initialUser, id: "id2" };
    rerender();
    expect(result.current).not.toBe(initialResult);
  });
});
