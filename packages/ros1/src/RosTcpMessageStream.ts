// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter, ListenerFn } from "eventemitter3";

import { concatData } from "./concatData";

export declare interface RosTcpMessageStream {
  on(event: "message", listener: (message: Uint8Array) => void): this;
  on(event: string, listener: ListenerFn): this;
}

// A stateful transformer that takes a raw TCPROS data stream and parses the
// TCPROS format of 4 byte length prefixes followed by message payloads into one
// complete message per "message" event, discarding the length prefix
export class RosTcpMessageStream extends EventEmitter {
  #inMessage = false;
  #bytesNeeded = 4;
  #chunks: Uint8Array[] = [];

  addData(chunk: Uint8Array): void {
    let idx = 0;
    while (idx < chunk.length) {
      if (chunk.length - idx < this.#bytesNeeded) {
        // If we didn't receive enough bytes to complete the current message or
        // message length field, store this chunk and continue on
        this.#chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset + idx));
        this.#bytesNeeded -= chunk.length - idx;
        return;
      }

      // Store the final chunk needed to complete the current message or message
      // length field
      this.#chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset + idx, this.#bytesNeeded));
      idx += this.#bytesNeeded;

      const payload = concatData(this.#chunks);
      this.#chunks = [];

      if (this.#inMessage) {
        // Produce a Uint8Array representing a single message and transition to
        // reading a message length field
        this.#bytesNeeded = 4;
        this.emit("message", payload);
      } else {
        // Decoded the message length field and transition to reading a message
        this.#bytesNeeded = new DataView(
          payload.buffer,
          payload.byteOffset,
          payload.byteLength,
        ).getUint32(0, true);
      }

      this.#inMessage = !this.#inMessage;
    }
  }
}
