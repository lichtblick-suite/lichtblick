/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import AppConfigurationContext, {
  IAppConfiguration,
  AppConfigurationValue,
} from "@foxglove/studio-base/context/AppConfigurationContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";

class FakeProvider implements IAppConfiguration {
  public get(key: string): AppConfigurationValue {
    return key;
  }
  public async set(_key: string, _value: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public addChangeListener() {}
  public removeChangeListener() {}
}

describe("useAppConfigurationValue", () => {
  it("should have the value on first mount", async () => {
    const wrapper = ({ children }: PropsWithChildren<unknown>) => {
      return (
        <AppConfigurationContext.Provider value={new FakeProvider()}>
          {children}
        </AppConfigurationContext.Provider>
      );
    };

    const { result, unmount } = renderHook(() => useAppConfigurationValue("test.value"), {
      wrapper,
    });

    // immediately on mount loading should be false and value should be available
    expect(result.current[0]).toEqual("test.value");
    unmount();
  });

  it("should treat empty string value as undefined", async () => {
    const wrapper = ({ children }: PropsWithChildren<unknown>) => {
      return (
        <AppConfigurationContext.Provider value={new FakeProvider()}>
          {children}
        </AppConfigurationContext.Provider>
      );
    };

    const { result, unmount } = renderHook(() => useAppConfigurationValue(""), {
      wrapper,
    });

    // immediately on mount loading should be false and value should be available
    expect(result.current[0]).toEqual(undefined);
    unmount();
  });
});
