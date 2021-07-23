// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import ConsoleApi, { Org } from "@foxglove/studio-base/services/ConsoleApi";

import DeviceCode from "./DeviceCodeDialog";

class FakeConsoleApi extends ConsoleApi {
  constructor() {
    super("");
  }

  override async orgs(): Promise<Org[]> {
    return [{ id: "1234", slug: "OrgSlug", display_name: "My Org" }];
  }

  override async token(): ReturnType<ConsoleApi["token"]> {
    return {
      access_token: "foo",
      id_token: "bar",
    };
  }
}

class NeverLoadOrgsConsoleApi extends FakeConsoleApi {
  // never finish loading the orgs
  override async orgs(): Promise<Org[]> {
    return await new Promise(() => {});
  }
}

class NoOrgsConsoleApi extends FakeConsoleApi {
  override async orgs(): Promise<Org[]> {
    return [];
  }
}

export default {
  title: "AccountSettingsSidebar/DeviceCode",
  component: DeviceCode,
  decorators: [
    (SingleStory: Story, ctx: StoryContext): JSX.Element => {
      const fakeConsoleApi = ctx.parameters.consoleApi ?? new FakeConsoleApi();

      return (
        <ModalHost>
          <ConsoleApiContext.Provider value={fakeConsoleApi}>
            <SingleStory />
          </ConsoleApiContext.Provider>
        </ModalHost>
      );
    },
  ],
};

export const ShowDeviceCode = (): JSX.Element => {
  return (
    <DeviceCode
      deviceCode={{
        device_code: "foobar",
        expires_in: 100000,
        interval: 100,
        user_code: "AAAA-12BB",
        verification_uri: "https://console.example.com/activate",
      }}
    />
  );
};

export const CodeTimeout = (): JSX.Element => {
  return (
    <DeviceCode
      deviceCode={{
        device_code: "foobar",
        expires_in: 0,
        interval: 0,
        user_code: "AAAA-12BB",
        verification_uri: "https://console.example.com/activate",
      }}
    />
  );
};

export const LoadingOrgs = (): JSX.Element => {
  return (
    <DeviceCode
      deviceCode={{
        device_code: "foobar",
        expires_in: 1,
        interval: 0,
        user_code: "AAAA-12BB",
        verification_uri: "https://console.example.com/activate",
      }}
    />
  );
};
LoadingOrgs.parameters = {
  consoleApi: new NeverLoadOrgsConsoleApi(),
};

export const OrgSelect = (): JSX.Element => {
  return (
    <DeviceCode
      deviceCode={{
        device_code: "foobar",
        expires_in: 1,
        interval: 0,
        user_code: "AAAA-12BB",
        verification_uri: "https://console.example.com/activate",
      }}
    />
  );
};

export const NoOrgs = (): JSX.Element => {
  return (
    <DeviceCode
      deviceCode={{
        device_code: "foobar",
        expires_in: 1,
        interval: 0,
        user_code: "AAAA-12BB",
        verification_uri: "https://console.example.com/activate",
      }}
    />
  );
};
NoOrgs.parameters = {
  consoleApi: new NoOrgsConsoleApi(),
};
