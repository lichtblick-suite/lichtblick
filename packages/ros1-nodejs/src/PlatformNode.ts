// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import os from "os";
import { URL } from "whatwg-url";

function isPrivateIP(ip: string): boolean {
  // Logic based on isPrivateIP() in ros_comm network.cpp
  return ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("169.254");
}

export function GetPid(): Promise<number> {
  return Promise.resolve(process.pid);
}

export function GetDefaultRosMasterUri(): Promise<URL> {
  const urlStr = process.env["ROS_MASTER_URI"];
  if (urlStr !== undefined && urlStr.length > 0) {
    try {
      const url = new URL(urlStr);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return Promise.resolve(url);
      }
    } finally {
      // Ignore malformed ROS_MASTER_URI env var
    }
  }

  return Promise.resolve(new URL("http://localhost:11311"));
}

export function GetHostname(): Promise<string> {
  // Prefer ROS_HOSTNAME, then ROS_IP env vars
  let hostname = process.env["ROS_HOSTNAME"] ?? process.env["ROS_IP"];
  if (hostname !== undefined && hostname.length > 0) {
    return Promise.resolve(hostname);
  }

  // Try to get the operating system hostname
  hostname = os.hostname();
  if (hostname !== undefined && hostname.length > 0) {
    return Promise.resolve(hostname);
  }

  // Fall back to iterating network interfaces looking for an IP address
  let bestAddr: os.NetworkInterfaceInfo | undefined;
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    const iface = ifaces[name];
    if (iface !== undefined) {
      for (const info of iface) {
        if (
          (info.family !== "IPv4" && info.family !== "IPv6") ||
          info.internal ||
          info.address.length === 0
        ) {
          continue;
        }

        if (bestAddr === undefined) {
          // Use the first non-internal interface we find
          bestAddr = info;
        } else if (isPrivateIP(bestAddr.address) && !isPrivateIP(info.address)) {
          // Prefer public IPs over private
          bestAddr = info;
        } else if (bestAddr.family !== "IPv6" && info.family === "IPv6") {
          // Prefer IPv6
          bestAddr = info;
        }
      }
    }
  }
  if (bestAddr !== undefined) {
    return Promise.resolve(bestAddr.address);
  }

  // Last resort, return IPv4 loopback
  return Promise.resolve("127.0.0.1");
}
