// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dns from "dns";
import type packet from "dns-packet";
import MulticastDns from "multicast-dns";

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

export function mdnsLookup(
  hostname: string,
  options: dns.LookupOneOptions,
  // eslint-disable-next-line no-restricted-syntax
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  const MAX_ATTEMPTS = 5;

  const mdns = MulticastDns({ reuseAddr: true });
  const recordType = options.family === 6 ? "AAAA" : "A";
  let attempts = 0;
  const timer = setInterval(query, 1000);
  query();

  mdns.on("response", (res: packet.Packet) => {
    if (res.answers == undefined) {
      // Ignore this response, wait and see if another comes in
      return;
    }

    for (const answer of res.answers) {
      if (answer.name === hostname && answer.type === recordType) {
        cleanup();
        // eslint-disable-next-line no-restricted-syntax
        callback(null, answer.data, answer.type === "AAAA" ? 6 : 4);
      }
    }
  });

  function cleanup() {
    mdns.destroy();
    clearInterval(timer);
  }

  function query() {
    if (++attempts >= MAX_ATTEMPTS) {
      cleanup();
      callback(new Error("Query timed out"), "", 0);
      return;
    }

    mdns.query([{ type: recordType, name: hostname }]);
  }
}
