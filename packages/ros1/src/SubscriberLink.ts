// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Client } from "./Client";

export class SubscriberLink {
  readonly connectionId: number;
  destinationCallerId: string;
  client: Client;

  constructor(connectionId: number, destinationCallerId: string, client: Client) {
    this.connectionId = connectionId;
    this.destinationCallerId = destinationCallerId;
    this.client = client;
  }
}
