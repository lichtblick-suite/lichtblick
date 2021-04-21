// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Transform } from "stream";

export type CreateTransform = () => Transform;

interface Disposable {
  dispose(): void;
}

// Store references to created sockets and servers
const entities = new Map<number, Disposable>();
let curId = 0;

// Return an incrementing unique integer identifier
export function nextId(): number {
  return curId++;
}

// Store a reference to an entity that can be disposed later
export function registerEntity(id: number, entity: Disposable): void {
  entities.set(id, entity);
}
