// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import NativeStorageAppConfiguration from "./NativeStorageAppConfiguration";
import { Storage } from "../../common/types";

type MockStorage = {
  [K in keyof Storage]: jest.Mock<ReturnType<Storage[K]>, Parameters<Storage[K]>>;
};

function makeMockContext(): Storage & MockStorage {
  function raise(name: string) {
    throw new Error(`Unexpected call to ${name}`);
  }

  return {
    list: jest.fn().mockImplementation(() => {
      raise("list");
    }),
    all: jest.fn().mockImplementation(() => {
      raise("all");
    }),
    get: jest.fn().mockImplementation(() => {
      raise("get");
    }),
    put: jest.fn().mockImplementation(() => {
      raise("put");
    }),
    delete: jest.fn().mockImplementation(() => {
      raise("delete");
    }),
  };
}

describe("NativeStorageAppConfiguration", () => {
  it("loads state upon construction and returns values from cached state", async () => {
    const ctx = makeMockContext();
    ctx.get.mockImplementationOnce(async () => {
      return JSON.stringify({ abc: 123 });
    });

    const config = await NativeStorageAppConfiguration.Initialize(ctx);
    expect(config.get("abc")).toEqual(123);
    expect(config.get("abc")).toEqual(123);
    // ctx.get is intentionally unbound in the expect() call
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ctx.get).toHaveBeenCalledTimes(1);
  });

  it("preserves stored value when default is provided", async () => {
    const ctx = makeMockContext();
    ctx.get.mockImplementationOnce(async () => {
      return JSON.stringify({ abc: 123 });
    });

    const config = await NativeStorageAppConfiguration.Initialize(ctx, {
      defaults: {
        abc: "foo",
      },
    });
    expect(config.get("abc")).toEqual(123);
  });

  it("uses default value when no value is set", async () => {
    const ctx = makeMockContext();
    ctx.get.mockImplementationOnce(async () => {
      return JSON.stringify({ abc: 123 });
    });

    const config = await NativeStorageAppConfiguration.Initialize(ctx, {
      defaults: {
        foo: "bar",
      },
    });
    expect(config.get("foo")).toEqual("bar");
  });

  it("serializes reads and writes", async () => {
    const ctx = makeMockContext();

    let value = JSON.stringify({ abc: 123 });
    ctx.get.mockImplementation(async () => value);
    ctx.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    // construction calls storage.get()
    const config = await NativeStorageAppConfiguration.Initialize(ctx);
    expect(config.get("abc")).toEqual(123);

    // each set calls storage.get() before adding its value
    // Note: this test doesn't really force the calls to be interleaved -
    // Jest provides no way to assert that a promise is blocked and will not resolve
    await Promise.all([config.set("abc", 234), config.set("xyz", true)]);

    expect(config.get("abc")).toEqual(234);
    expect(config.get("xyz")).toEqual(true);
    expect(ctx.put.mock.calls).toEqual([
      ["settings", "settings.json", JSON.stringify({ abc: 234 })],
      ["settings", "settings.json", JSON.stringify({ abc: 234, xyz: true })],
    ]);
  });

  it("calls listeners when values change", async () => {
    const ctx = makeMockContext();

    let value = JSON.stringify({ abc: 123 });
    ctx.get.mockImplementation(async () => value);
    ctx.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    const config = await NativeStorageAppConfiguration.Initialize(ctx);

    const listener = jest.fn();
    config.addChangeListener("abc", listener);

    expect(config.get("abc")).toEqual(123);
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
    ctx.get.mockImplementation(async () => value);
    ctx.put.mockImplementation(async (_datastore, _key, newValue) => {
      if (typeof newValue !== "string") {
        throw new Error("Expected storage.put to be given a string");
      }
      value = newValue;
    });

    const config = await NativeStorageAppConfiguration.Initialize(ctx);

    const listener1 = jest.fn();
    const listener2 = jest.fn();
    listener1.mockImplementation(() => {
      config.removeChangeListener("abc", listener1);
      config.addChangeListener("abc", listener2);
    });
    config.addChangeListener("abc", listener1);

    expect(config.get("abc")).toEqual(123);
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
