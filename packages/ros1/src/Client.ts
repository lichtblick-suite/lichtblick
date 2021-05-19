// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export interface ClientStats {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
}

export interface Client {
  on(eventName: "close", listener: () => void): this;
  on(eventName: "subscribe", listener: (topic: string, destinationCallerId: string) => void): this;

  transportType(): string;

  connected(): boolean;

  stats(): ClientStats;

  write(data: Uint8Array): Promise<void>;

  close(): void;

  getTransportInfo(): string;

  toString(): string;
}
