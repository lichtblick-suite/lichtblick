// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";
import { MessageReader, RosMsgDefinition } from "rosbag";

import { Connection } from "./Connection";
import { PublisherLink } from "./PublisherLink";
import { RosFollowerClient } from "./RosFollowerClient";

type PublisherStats = [
  connectionId: number,
  bytesReceived: number,
  messagesReceived: number,
  estimatedDrops: number,
  connected: 0,
];

// e.g. [1, "http://host:54893/", "i", "TCPROS", "/chatter", 1, "TCPROS connection on port 59746 to [host:34318 on socket 11]"]
type PublisherInfo = [
  connectionId: number,
  publisherXmlRpcUri: string,
  direction: "i",
  transport: string,
  topicName: string,
  connected: number,
  connectionInfo: string,
];

export declare interface Subscription {
  on(
    event: "header",
    listener: (
      header: Map<string, string>,
      msgDef: RosMsgDefinition[],
      msgReader: MessageReader,
    ) => void,
  ): this;
  on(
    event: "message",
    listener: (msg: unknown, data: Uint8Array, publisher: PublisherLink) => void,
  ): this;
}

export class Subscription extends EventEmitter {
  readonly name: string;
  readonly md5sum: string;
  readonly dataType: string;
  #publishers = new Map<number, PublisherLink>();

  constructor(name: string, md5sum: string, dataType: string) {
    super();
    this.name = name;
    this.md5sum = md5sum;
    this.dataType = dataType;
  }

  close(): void {
    this.removeAllListeners();
    for (const pub of this.#publishers.values()) {
      pub.connection.close();
    }
    this.#publishers.clear();
  }

  publishers(): Readonly<Map<number, PublisherLink>> {
    return this.#publishers;
  }

  addPublisher(
    connectionId: number,
    rosFollowerClient: RosFollowerClient,
    connection: Connection,
  ): void {
    const publisher = new PublisherLink(connectionId, this, rosFollowerClient, connection);
    this.#publishers.set(connectionId, publisher);

    connection.on("header", (header, def, reader) => this.emit("header", header, def, reader));
    connection.on("message", (msg, data) => this.emit("message", msg, data, publisher));
  }

  removePublisher(connectionId: number): boolean {
    this.#publishers.get(connectionId)?.connection.close();
    return this.#publishers.delete(connectionId);
  }

  getInfo(): PublisherInfo[] {
    return Array.from(this.#publishers.values()).map(
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
    const pubStats = Array.from(this.#publishers.values()).map(
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

  receivedBytes(): number {
    let bytes = 0;
    for (const pub of this.#publishers.values()) {
      bytes += pub.connection.stats().bytesReceived;
    }
    return bytes;
  }
}
