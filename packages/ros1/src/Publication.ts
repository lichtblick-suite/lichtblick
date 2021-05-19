// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageWriter, RosMsgDefinition } from "rosbag";

import { Client } from "./Client";
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
  readonly latching: boolean;
  readonly messageDefinition: RosMsgDefinition[];
  readonly messageDefinitionText: string;
  readonly messageWriter: MessageWriter;
  private _latched = new Map<string, Uint8Array>();
  private _subscribers = new Map<number, SubscriberLink>();

  constructor(
    name: string,
    md5sum: string,
    dataType: string,
    latching: boolean,
    messageDefinition: RosMsgDefinition[],
    messageDefinitionText: string,
    messageWriter: MessageWriter,
  ) {
    this.name = name;
    this.md5sum = md5sum;
    this.dataType = dataType;
    this.latching = latching;
    this.messageDefinition = messageDefinition;
    this.messageDefinitionText = messageDefinitionText;
    this.messageWriter = messageWriter;
  }

  subscribers(): Readonly<Map<number, SubscriberLink>> {
    return this._subscribers;
  }

  addSubscriber(connectionId: number, destinationCallerId: string, client: Client): void {
    const subscriber = new SubscriberLink(connectionId, destinationCallerId, client);
    this._subscribers.set(connectionId, subscriber);

    client.on("close", () => {
      this._subscribers.delete(connectionId);
    });
  }

  async write(transportType: string, data: Uint8Array): Promise<void> {
    if (this.latching) {
      this._latched.set(transportType, data);
    }

    const tasks: Promise<void>[] = [];
    for (const sub of this._subscribers.values()) {
      if (sub.client.transportType() === transportType) {
        tasks.push(sub.client.write(data));
      }
    }
    await Promise.allSettled(tasks);
  }

  close(): void {
    for (const sub of this._subscribers.values()) {
      sub.client.close();
    }
    this._subscribers.clear();
  }

  latchedMessage(transportType: string): Uint8Array | undefined {
    return this._latched.get(transportType);
  }

  getInfo(): SubscriberInfo[] {
    return Array.from(this._subscribers.values()).map((sub): SubscriberInfo => {
      return [
        sub.connectionId,
        sub.destinationCallerId,
        "o",
        sub.client.transportType(),
        this.name,
        1,
        sub.client.getTransportInfo(),
      ];
    });
  }

  getStats(): [string, SubscriberStats[]] {
    const subStats = Array.from(this._subscribers.values()).map((sub): SubscriberStats => {
      const stats = sub.client.stats();
      return [sub.connectionId, stats.bytesSent, stats.bytesSent, stats.messagesSent, 0];
    });

    return [this.name, subStats];
  }
}
