// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OsContext } from "@foxglove-studio/app/OsContext";
import OsContextAppConfiguration from "@foxglove-studio/app/services/OsContextAppConfiguration";
import signal from "@foxglove-studio/app/util/signal";

type MockStorage = {
  [K in keyof OsContext["storage"]]: jest.Mock<
    ReturnType<OsContext["storage"][K]>,
    Parameters<OsContext["storage"][K]>
  >;
};
function makeMockContext(): Pick<OsContext, "storage"> & { storage: MockStorage } {
  function raise(name: string) {
    throw new Error(`Unexpected call to ${name}`);
  }
  return {
    storage: {
      list: jest.fn().mockImplementation(() => raise("list")),
      all: jest.fn().mockImplementation(() => raise("all")),
      get: jest.fn().mockImplementation(() => raise("get")),
      put: jest.fn().mockImplementation(() => raise("put")),
      delete: jest.fn().mockImplementation(() => raise("delete")),
    },
  };
}

describe("OsContextAppConfiguration", () => {
  it("loads state upon construction and returns values from cached state", async () => {
    const ctx = makeMockContext();
    const called = signal();
    const result = signal<string>();
    ctx.storage.get.mockImplementationOnce(async () => {
      called.resolve();
      return result;
    });

    const config = new OsContextAppConfiguration(ctx);
    await called;

    result.resolve(JSON.stringify({ abc: 123 }));
    await expect(config.get("abc")).resolves.toEqual(123);
    await expect(config.get("abc")).resolves.toEqual(123);
    expect((ctx.storage as MockStorage).get).toHaveBeenCalledTimes(1);
  });

  it("serializes reads and writes", async () => {
    const ctx = makeMockContext();

    let value = JSON.stringify({ abc: 123 });
    ctx.storage.get.mockImplementation(async () => value);
    ctx.storage.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    // construction calls storage.get()
    const config = new OsContextAppConfiguration(ctx);
    await expect(config.get("abc")).resolves.toEqual(123);

    // each set calls storage.get() before adding its value
    // Note: this test doesn't really force the calls to be interleaved -
    // Jest provides no way to assert that a promise is blocked and will not resolve
    await Promise.all([config.set("abc", 234), config.set("xyz", [true, false])]);

    await expect(config.get("abc")).resolves.toEqual(234);
    await expect(config.get("xyz")).resolves.toEqual([true, false]);
    expect(ctx.storage.put.mock.calls).toEqual([
      ["settings", "settings.json", JSON.stringify({ abc: 234 })],
      ["settings", "settings.json", JSON.stringify({ abc: 234, xyz: [true, false] })],
    ]);
  });

  it("calls listeners when values change", async () => {
    const ctx = makeMockContext();

    let value = JSON.stringify({ abc: 123 });
    ctx.storage.get.mockImplementation(async () => value);
    ctx.storage.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    const config = new OsContextAppConfiguration(ctx);

    const listener = jest.fn();
    config.addChangeListener("abc", listener);

    await expect(config.get("abc")).resolves.toEqual(123);
    expect(listener).toHaveBeenCalledTimes(0);

    await config.set("abc", 1);
    expect(listener).toHaveBeenCalledTimes(1);

    config.removeChangeListener("abc", listener);
    await config.set("abc", 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("supports adding/removing listeners during listener callback", async () => {
    const ctx = makeMockContext();

    let value = JSON.stringify({ abc: 123 });
    ctx.storage.get.mockImplementation(async () => value);
    ctx.storage.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    const config = new OsContextAppConfiguration(ctx);

    const listener1 = jest.fn();
    const listener2 = jest.fn();
    listener1.mockImplementation(() => {
      config.removeChangeListener("abc", listener1);
      config.addChangeListener("abc", listener2);
    });
    config.addChangeListener("abc", listener1);

    await expect(config.get("abc")).resolves.toEqual(123);
    expect(listener1).toHaveBeenCalledTimes(0);
    expect(listener2).toHaveBeenCalledTimes(0);

    await config.set("abc", 1);
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(0);

    await config.set("abc", 2);
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
