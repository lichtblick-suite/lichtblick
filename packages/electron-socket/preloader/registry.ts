// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Transform } from "stream";

interface Disposable {
  dispose(): void;
}

// Store references to created sockets and servers
const entities = new Map<number, Disposable>();
let curId = 0;

// A registry of node.js Transform classes that can be applied to sockets. This
// allows for incoming socket data to be transformed before it is sent to the
// renderer process
const transforms = new Map<string, Transform>();

// Return an incrementing unique integer identifier
export function nextId(): number {
  return curId++;
}

// Store a reference to an entity that can be disposed later
export function registerEntity(id: number, entity: Disposable): void {
  entities.set(id, entity);
}

// Register a node.js Transform class that can later be applied to newly created
// sockets
export function registerTransform(name: string, transform: Transform): void {
  transforms.set(name, transform);
}

export function getTransform(name: string): Transform | undefined {
  return transforms.get(name);
}
