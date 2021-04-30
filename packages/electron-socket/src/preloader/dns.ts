// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dns from "dns";

import { MDnsResolver } from "./MDnsResolver";

const mdnsResolver = new MDnsResolver();

const getaddrinfo = dns.lookup.bind(dns);

export function dnsLookup(
  hostname: string,
  options: dns.LookupOneOptions,
  // eslint-disable-next-line no-restricted-syntax
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  if (!/\.local$/.test(hostname)) {
    getaddrinfo(hostname, options, callback);
  } else {
    mdnsLookup(hostname, options, callback);
  }
}

export async function mdnsLookup(
  hostname: string,
  options: dns.LookupOneOptions,
  // eslint-disable-next-line no-restricted-syntax
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): Promise<void> {
  const response = await mdnsResolver.mdnsLookup(hostname, options);
  if (response == undefined) {
    return callback(new Error(`mDNS resolution timed out for "${hostname}"`), "", 0);
  }
  // eslint-disable-next-line no-restricted-syntax
  callback(null, response.address, response.family);
}
