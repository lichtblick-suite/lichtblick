// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Events that are forwarded from the main process and can be listened to using ctxbridge.addIpcEventListener
export type OsContextForwardedEvent = "enter-full-screen" | "leave-full-screen";

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

  handleToolbarDoubleClick: () => void;

  // Return true unless the user has opted out of crash reporting
  isCrashReportingEnabled(): boolean;
  // Return true unless the user has opted out of telemetry
  isTelemetryEnabled(): boolean;

  // Retrieve an environment variable
  getEnvVar: (envVar: string) => string | undefined;
  // Get the operating system hostname
  getHostname: () => string;
  // Get a listing for every network interface discovered on the system
  getNetworkInterfaces: () => NetworkInterface[];
  // Get a unique identifier for the system from the operating system
  getMachineId: () => Promise<string>;
  // Get the version string from package.json
  getAppVersion: () => string;

  // Get an array of deep links provided on app launch
  getDeepLinks: () => string[];
}
