/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import delay from "@foxglove/studio-base/util/delay";

import Rpc, { Channel, createLinkedChannels } from "./Rpc";

describe("Rpc", () => {
  it("only allows setting Rpc once per channel", () => {
    const { local: mainChannel } = createLinkedChannels();
    new Rpc(mainChannel);
    expect(() => new Rpc(mainChannel)).toThrow();
  });

  it("can send and receive", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive<{ foo: string }, { bar: string }>("foo", (msg) => {
      return { bar: msg.foo };
    });
    const result = await local.send("foo", { foo: "baz" });
    expect(result).toEqual({ bar: "baz" });
  });

  it("can send and receive with a promise", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive<{ foo: string }, Promise<{ bar: string }>>("foo", async (msg) => {
      await delay(10);
      return { bar: msg.foo };
    });
    const result = await local.send("foo", { foo: "baz" });
    expect(result).toEqual({ bar: "baz" });
  });

  it("rejects on send if receive rejects async", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive("foo", async (_msg) => {
      await delay(10);
      throw new Error("boom");
    });
    await expect(local.send("foo", { foo: "baz" })).rejects.toThrow("boom");
  });

  it("rejects on send if receive rejects sync", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive("foo", (_msg) => {
      throw new Error("boom");
    });
    await expect(local.send("foo", { foo: "baz" })).rejects.toThrow("boom");
  });

  it("rejects on send if there is no receiver", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    new Rpc(workerChannel);
    await expect(local.send("foo", { foo: "baz" })).rejects.toThrow("no receiver");
  });

  it("can send and receive transferables", async () => {
    const expectedTransfer = new ArrayBuffer(1);
    const mainChannel: Channel = {
      onmessage: undefined,
      postMessage(data: any, _transfer?: ArrayBuffer[]) {
        const ev = new MessageEvent("message", { data });
        if (workerChannel.onmessage) {
          workerChannel.onmessage(ev);
        }
      },
      terminate: () => {
        // no-op
      },
    };

    const workerChannel: Channel = {
      onmessage: undefined,
      postMessage(data: any, transfer?: ArrayBuffer[]) {
        const ev = new MessageEvent("message", { data });
        expect(transfer).toHaveLength(1);
        expect(transfer![0]).toBe(expectedTransfer);
        if (mainChannel.onmessage) {
          mainChannel.onmessage(ev);
        }
      },
      terminate: () => {
        // no-op
      },
    };

    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive<{ foo: string }, Promise<{ bar: string }>>("foo", async (msg) => {
      await delay(10);
      return {
        bar: msg.foo,
        [Rpc.transferables]: [expectedTransfer],
      };
    });
    const result = await local.send("foo", { foo: "baz" });
    expect(result).toEqual({ bar: "baz" });
  });

  it("can resolve when receiver returns undefined", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive("foo", () => {
      // no-op
    });
    expect(await local.send("foo")).toBeUndefined();
  });

  it("can resolve multiple operations", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const local = new Rpc(mainChannel);
    const worker = new Rpc(workerChannel);
    worker.receive("foo", async (count) => {
      await delay(10);
      return count;
    });
    const one = local.send("foo", 1);
    const two = local.send("foo", 2);
    const three = local.send("foo", 3);
    const result = await Promise.all([one, two, three]);
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws when registering a receiver twice", () => {
    const rpc = new Rpc(createLinkedChannels().local);
    rpc.receive("foo", () => {
      // no-op
    });
    expect(() =>
      rpc.receive("foo", () => {
        // no-op
      }),
    ).toThrow();
  });
});
