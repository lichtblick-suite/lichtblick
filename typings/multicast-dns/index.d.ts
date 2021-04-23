// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "multicast-dns" {
  import { AddressInfo } from "dgram";
  import * as packet from "dns-packet";

  type Callback = (err: Error) => unknown;

  interface MulticastDnsOptions {
    /**
     * Use UDP multicasting?
     */
    multicast?: boolean;

    /**
     * Interface on which to listen and perform mdns operations.
     */
    interface?: string;

    /**
     * The UDP port to listen on.
     */
    port?: number;

    /**
     * The IP address to listen on.
     */
    ip?: string;

    /**
     * The multicast TTL.
     */
    ttl?: number;

    /**
     * Whether to receive your own packets.
     */
    loopback?: boolean;

    /**
     * Whether to set the reuseAddr option when creating the UDP socket.
     * (requires node >=0.11.13)
     */
    reuseAddr?: boolean;
  }

  interface MulticastDns extends NodeJS.EventEmitter {
    on(event: "response", cb: (response: packet.Packet) => unknown): this;
    on(event: "query", cb: (query: packet.Packet) => unknown): this;

    send(value: packet.Packet, cb?: Callback): void;
    send(value: packet.Packet, rinfo: AddressInfo, cb?: Callback): void;

    response(res: packet.Packet, cb?: Callback): void;
    response(res: packet.Packet, rinfo: AddressInfo, cb?: Callback): void;

    respond(res: packet.Packet, cb?: Callback): void;
    respond(res: packet.Packet, rinfo: AddressInfo, cb?: Callback): void;

    query(query: string | packet.Packet | packet.Question[], cb?: Callback): void;
    query(query: packet.Packet | packet.Question[], rinfo: AddressInfo, cb?: Callback): void;
    query(name: string, type: packet.RecordType, cb?: Callback): void;
    query(name: string, type: packet.RecordType, rinfo: AddressInfo, cb?: Callback): void;

    destroy(cb?: Callback): void;
  }

  export default function (opts?: MulticastDnsOptions): MulticastDns;
}
