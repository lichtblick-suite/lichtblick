// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Socket } from "net";

import { TcpServerElectron } from "./TcpServerElectron";
import { TcpSocketElectron } from "./TcpSocketElectron";
import { getTransform, nextId, registerEntity } from "./registry";

export { registerTransform } from "./registry";

export function createSocket(transformName?: string): MessagePort {
  const channel = new MessageChannel();
  const transform = transformName != undefined ? getTransform(transformName) : undefined;
  const id = nextId();
  const socket = new TcpSocketElectron(id, channel.port2, new Socket(), transform);
  registerEntity(id, socket);
  return channel.port1;
}

export function createServer(transformName?: string): MessagePort {
  const channel = new MessageChannel();
  const transform = transformName != undefined ? getTransform(transformName) : undefined;
  const id = nextId();
  const server = new TcpServerElectron(id, channel.port2, transform);
  registerEntity(id, server);
  return channel.port1;
}
