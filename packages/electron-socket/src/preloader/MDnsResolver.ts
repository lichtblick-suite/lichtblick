// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dns from "dns";

import { mdns4Request } from "./mdns";

export type DnsCacheEntry = {
  address: string;
  family: number;
  expires: Date;
};

// Implements mDNS resolution with caching. Concurrent requests for the same
// hostname will block on the first request
export class MDnsResolver {
  pendingLookups = new Map<string, Promise<DnsCacheEntry | undefined>>();
  dnsCache = new Map<string, DnsCacheEntry>();

  async mdnsLookup(
    hostname: string,
    options: dns.LookupOneOptions,
  ): Promise<DnsCacheEntry | undefined> {
    // Cache check
    let entry = this._getEntry(hostname);
    if (entry != undefined) {
      return entry;
    }

    // Check if there is already a pending request for this hostname
    let pending = this.pendingLookups.get(hostname);
    if (pending != undefined) {
      return pending;
    }

    // Start an mDNS request
    pending = this._doMdnsLookup(hostname, options);
    this.pendingLookups.set(hostname, pending);

    entry = await pending;
    this.pendingLookups.delete(hostname);
    return entry;
  }

  private async _doMdnsLookup(
    hostname: string,
    _options: dns.LookupOneOptions,
  ): Promise<DnsCacheEntry | undefined> {
    const DEFAULT_TTL_SEC = 120;

    try {
      const res = await mdns4Request(hostname);
      if (res == undefined) {
        return undefined;
      }
      const answer = res.answer;
      const address = answer.data;
      const family = answer.type === "AAAA" ? 6 : 4;

      if (answer.ttl === 0) {
        this.dnsCache.delete(hostname);
      } else {
        this._addEntry(hostname, address, family, answer.ttl ?? DEFAULT_TTL_SEC);
      }

      return this._getEntry(hostname);
    } catch {
      return undefined;
    }
  }

  private _addEntry(hostname: string, address: string, family: number, ttl: number): void {
    const TTL_MULTIPLIER = 60;

    // Scan for any entries that should be expired
    const now = new Date();
    this.dnsCache.forEach((entry, key) => {
      if (entry.expires <= now) {
        this.dnsCache.delete(key);
      }
    });

    const expires = new Date(+now + ttl * TTL_MULTIPLIER * 1000);
    this.dnsCache.set(hostname, { address, family, expires });
  }

  private _getEntry(hostname: string): DnsCacheEntry | undefined {
    // Check if this entry exists
    const entry = this.dnsCache.get(hostname);
    if (entry == undefined) {
      return undefined;
    }

    // Check if this entry is expired
    const now = new Date();
    if (entry.expires <= now) {
      this.dnsCache.delete(hostname);
      return undefined;
    }

    return entry;
  }
}
