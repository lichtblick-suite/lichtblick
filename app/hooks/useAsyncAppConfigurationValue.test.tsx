// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";
import { PropsWithChildren } from "react";

import AppConfigurationContext, {
  AppConfiguration,
} from "@foxglove-studio/app/context/AppConfigurationContext";
import { useAsyncAppConfigurationValue } from "@foxglove-studio/app/hooks/useAsyncAppConfigurationValue";

class FakeProvider implements AppConfiguration {
  async get(key: string): Promise<unknown> {
    return key;
  }
  async set(_key: string, _value: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

describe("useAsyncAppConfigurationValue", () => {
  it("gets the value", async () => {
    const wrapper = ({ children }: PropsWithChildren<unknown>) => {
      return (
        <AppConfigurationContext.Provider value={new FakeProvider()}>
          {children}
        </AppConfigurationContext.Provider>
      );
    };

    const { result, unmount, waitForNextUpdate } = renderHook(
      () => useAsyncAppConfigurationValue("test.value"),
      {
        wrapper,
      },
    );

    // immediately on mount loading should be true
    expect(result.current[0]).toMatchObject({ loading: true, retry: undefined });

    await waitForNextUpdate();
    expect(result.current[0]).toMatchObject({
      loading: false,
      value: "test.value",
      retry: undefined,
    });

    unmount();
  });
});
