// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@foxglove/studio-base";
import { Storage } from "@foxglove/studio-desktop/src/common/types";
import { main as rendererMain } from "@foxglove/studio-desktop/src/renderer/index";
import NativeStorageAppConfiguration from "@foxglove/studio-desktop/src/renderer/services/NativeStorageAppConfiguration";

const isDevelopment = process.env.NODE_ENV === "development";

async function main() {
  const appConfiguration = await NativeStorageAppConfiguration.Initialize(
    (global as { storageBridge?: Storage }).storageBridge!,
    {
      defaults: {
        [AppSetting.SHOW_DEBUG_PANELS]: isDevelopment,
      },
    },
  );

  await rendererMain({ appConfiguration });
}

void main();
