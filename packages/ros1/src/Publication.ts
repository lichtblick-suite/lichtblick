// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SubscriberLink } from "./SubscriberLink";

// [connectionId, bytesSent, messageDataSent, messagesSent, connected]
type SubscriberStats = [number, number, number, number, 0];

// [connectionId, destinationCallerId, direction, transport, topicName, connected, connectionInfo]
// e.g. [2, "/listener", "o", "TCPROS", "/chatter", true, "TCPROS connection on port 55878 to [127.0.0.1:44273 on socket 7]"]
type SubscriberInfo = [number, string, "o", string, string, number, string];

export class Publication {
  readonly name: string;
  readonly md5sum: string;
  readonly dataType: string;
  #subscribers = new Map<number, SubscriberLink>();

  constructor(name: string, md5sum: string, dataType: string) {
    this.name = name;
    this.md5sum = md5sum;
    this.dataType = dataType;
  }

  close(): void {
    for (const sub of this.#subscribers.values()) {
      sub.connection.close();
    }
    this.#subscribers.clear();
  }

  getInfo(): SubscriberInfo[] {
    return Array.from(this.#subscribers.values()).map(
      (sub): SubscriberInfo => {
        return [
          sub.connectionId,
          sub.destinationCallerId,
          "o",
          sub.connection.transportType(),
          this.name,
          1,
          sub.connection.getTransportInfo(),
        ];
      },
    );
  }

  getStats(): [string, SubscriberStats[]] {
    const subStats = Array.from(this.#subscribers.values()).map(
      (sub): SubscriberStats => {
        const stats = sub.connection.stats();
        return [sub.connectionId, stats.bytesSent, stats.bytesSent, stats.messagesSent, 0];
      },
    );
    return [this.name, subStats];
  }
}
