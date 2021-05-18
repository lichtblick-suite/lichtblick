// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageReader } from "rosbag";

import { RosMsgDefinition } from "@foxglove/rosmsg";

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  dropEstimate: number;
}

export interface Connection {
  on(
    eventName: "header",
    listener: (
      header: Map<string, string>,
      msgDef: RosMsgDefinition[],
      msgReader: MessageReader,
    ) => void,
  ): this;
  on(eventName: "message", listener: (msg: unknown, data: Uint8Array) => void): this;

  transportType(): string;

  connect(): Promise<void>;

  connected(): boolean;

  header(): Map<string, string>;

  stats(): ConnectionStats;

  messageDefinition(): RosMsgDefinition[];

  messageReader(): MessageReader | undefined;

  close(): void;

  getTransportInfo(): string;
}
