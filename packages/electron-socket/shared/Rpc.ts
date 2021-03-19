// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Cloneable =
  | void
  | undefined
  | boolean
  | number
  | string
  | Uint8Array
  | Cloneable[]
  | { [key: string]: Cloneable };

export type RpcCall = [methodName: string, callId: number, ...args: Cloneable[]];

export type RpcResponse = [callId: number, ...args: Cloneable[]];

export type RpcEvent = [eventName: string, ...args: Cloneable[]];

export type RpcHandler = (callId: number, args: Cloneable[]) => void;
