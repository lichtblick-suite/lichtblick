// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@lichtblick/suite-base";
import { Storage } from "@lichtblick/suite-desktop/src/common/types";
import { main as rendererMain } from "@lichtblick/suite-desktop/src/renderer/index";
import NativeStorageAppConfiguration from "@lichtblick/suite-desktop/src/renderer/services/NativeStorageAppConfiguration";

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
