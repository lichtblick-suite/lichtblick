// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

export function GetPid(): Promise<number> {
  return Promise.resolve(1);
}

export function GetDefaultRosMasterUri(): Promise<URL> {
  return Promise.resolve(new URL("http://localhost:11311"));
}

export function GetHostname(): Promise<string> {
  return Promise.resolve("localhost");
}
