// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Client } from "./Client";
import { Publication } from "./Publication";

export interface Publisher {
  on(
    eventName: "connection",
    listener: (
      topic: string,
      connectionId: number,
      destinationCallerId: string,
      client: Client,
    ) => void,
  ): this;

  publish(publication: Publication, message: unknown): Promise<void>;

  transportType(): string;

  listening(): boolean;

  close(): void;
}
