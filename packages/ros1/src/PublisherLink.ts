// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { Connection } from "./Connection";
import { RosFollowerClient } from "./RosFollowerClient";

// Handles a connection to a single publisher on a given topic.
export class PublisherLink {
  readonly connectionId: number;
  readonly rosFollowerClient: RosFollowerClient;
  readonly connection: Connection;

  constructor(connectionId: number, rosFollowerClient: RosFollowerClient, connection: Connection) {
    this.connectionId = connectionId;
    this.rosFollowerClient = rosFollowerClient;
    this.connection = connection;
  }

  publisherXmlRpcUrl(): URL {
    return this.rosFollowerClient.url();
  }
}
