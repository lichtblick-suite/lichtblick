// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";
import { PropsWithChildren } from "react";

import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";
import { useRemoteLayoutStorage } from "@foxglove/studio-base/context/RemoteLayoutStorageContext";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

import ConsoleApiRemoteLayoutStorageProvider from "./ConsoleApiRemoteLayoutStorageProvider";

class FakeConsoleApi extends ConsoleApi {
  constructor() {
    super("");
  }
}

describe("ConsoleApiRemoteLayoutStorageProvider", () => {
  it("produces the same layout storage instance when currentUser changes, as long as currentUser.id remains the same", () => {
    const fakeApi = new FakeConsoleApi();
    const initialUser: User = {
      id: "id",
      email: "foo@example.com",
      orgId: "org_abc",
      orgDisplayName: "BigCo",
      orgSlug: "bigco",
      orgPaid: true,
    };
    const { result, rerender } = renderHook(() => useRemoteLayoutStorage(), {
      initialProps: { user: initialUser },
      wrapper: ({ children, user }: PropsWithChildren<{ user: User }>) => (
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
    rerender({ user: { ...initialUser } });
    expect(result.current).toBe(initialResult);
    rerender({ user: { ...initialUser, id: "id2" } });
    expect(result.current).not.toBe(initialResult);
  });
});
