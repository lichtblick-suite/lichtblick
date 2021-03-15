// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PublisherLink } from "./PublisherLink";

// [connectionId, bytesReceived, messagesReceived, drops, connected]
type PublisherStats = [number, number, number, number, 0];

// [connectionId, publisherXmlRpcUri, direction, transport, topicName, connected, connectionInfo]
// e.g. [1, "http://host:54893/", "i", "TCPROS", "/chatter", 1, "TCPROS connection on port 59746 to [host:34318 on socket 11]"]
type PublisherInfo = [number, string, "i", string, string, number, string];

export class Subscription {
  readonly name: string;
  readonly md5sum: string;
  readonly dataType: string;
  publishers: PublisherLink[] = [];

  constructor(name: string, md5sum: string, dataType: string) {
    this.name = name;
    this.md5sum = md5sum;
    this.dataType = dataType;
  }

  getInfo(): PublisherInfo[] {
    return this.publishers.map(
      (pub): PublisherInfo => {
        return [
          pub.connectionId,
          pub.publisherXmlRpcUrl().toString(),
          "i",
          pub.connection.transportType(),
          this.name,
          1,
          pub.connection.getTransportInfo(),
        ];
      },
    );
  }

  getStats(): [string, PublisherStats[]] {
    const pubStats = this.publishers.map(
      (pub): PublisherStats => {
        const stats = pub.connection.stats();
        return [
          pub.connectionId,
          stats.bytesReceived,
          stats.messagesReceived,
          stats.dropEstimate,
          0,
        ];
      },
    );
    return [this.name, pubStats];
  }
}
