// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import ConsoleApi, { DeviceCodeResponse } from "@foxglove/studio-base/services/ConsoleApi";

import DeviceCodeDialog from "./DeviceCodeDialog";

class FakeConsoleApi extends ConsoleApi {
  constructor(private _deviceCode: DeviceCodeResponse | Promise<DeviceCodeResponse>) {
    super("");
  }

  override async token(): ReturnType<ConsoleApi["token"]> {
    return {
      access_token: "foo",
      id_token: "bar",
    };
  }

  override async deviceCode(): Promise<DeviceCodeResponse> {
    return await this._deviceCode;
  }
}

export default {
  title: "AccountSettingsSidebar/DeviceCodeDialog",
  component: DeviceCodeDialog,
  decorators: [
    (SingleStory: Story, ctx: StoryContext): JSX.Element => {
      const fakeConsoleApi =
        ctx.parameters.consoleApi ?? new FakeConsoleApi(ctx.parameters.deviceCode);

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

export function WaitForCode(): JSX.Element {
  return <DeviceCodeDialog />;
}
WaitForCode.parameters = {
  deviceCode: new Promise(() => {}),
};

export function ShowDeviceCode(): JSX.Element {
  return <DeviceCodeDialog />;
}
ShowDeviceCode.parameters = {
  deviceCode: {
    device_code: "foobar",
    expires_in: 100000,
    interval: 100,
    user_code: "AAAA-12BB",
    verification_uri: "https://console.example.com/activate",
  },
};

export function CodeTimeout(): JSX.Element {
  return <DeviceCodeDialog />;
}
CodeTimeout.parameters = {
  deviceCode: {
    device_code: "foobar",
    expires_in: 0,
    interval: 0,
    user_code: "AAAA-12BB",
    verification_uri: "https://console.example.com/activate",
  },
};
