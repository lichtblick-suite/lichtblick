// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import { useAsyncAppConfigurationValue } from "@foxglove-studio/app/hooks/useAsyncAppConfigurationValue";

export default function useAppSetting<T>(setting: AppSetting): T | undefined {
  const [entry] = useAsyncAppConfigurationValue<T>(setting);
  if (typeof entry.value === "string" && entry.value.length === 0) {
    return undefined;
  }
  return entry.value;
}
