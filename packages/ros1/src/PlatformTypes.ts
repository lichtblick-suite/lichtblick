// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Platform-specific functions that need access to the environment surrounding
// the executing process. Process ID, environment variables, hostname, etc.

export interface GetPid {
  (): Promise<number>;
}

export interface GetDefaultRosMasterUri {
  (): Promise<string>;
}

export interface GetHostname {
  (): Promise<string>;
}
