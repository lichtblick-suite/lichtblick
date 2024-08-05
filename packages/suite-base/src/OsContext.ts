// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export interface NetworkInterface {
  name: string;
  family: "IPv4" | "IPv6";
  internal: boolean;
  address: string;
  cidr?: string;
  mac: string;
  netmask: string;
}

/** OsContext is exposed over the electron Context Bridge */
export interface OsContext {
  // See Node.js process.platform
  platform: string;

  // The process id of this application
  pid: number;

  // Retrieve an environment variable
  getEnvVar: (envVar: string) => string | undefined;
  // Get the operating system hostname
  getHostname: () => string;
  // Get a listing for every network interface discovered on the system
  getNetworkInterfaces: () => NetworkInterface[];
  // Get the version string from package.json
  getAppVersion: () => string;
}
