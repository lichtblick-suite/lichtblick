// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  dropEstimate: number;
}

export interface Connection {
  transportType(): string;

  connected(): boolean;

  header(): Map<string, string>;

  stats(): ConnectionStats;

  close(): void;

  getTransportInfo(): string;
}
