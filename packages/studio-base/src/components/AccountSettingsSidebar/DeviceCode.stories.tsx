// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DeviceCode from "./DeviceCode";

export default {
  title: "AccountSettingsSidebar/DeviceCode",
  component: DeviceCode,
};

export const ShowDeviceCode = (): JSX.Element => {
  return <DeviceCode userCode="AAAA-12BB" verificationUrl="https://example.com/activate" />;
};
