// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlotViewport } from "@foxglove/studio-base/components/TimeBasedChart/types";

import {
  unregister,
  compressClients,
  MESSAGE_CULL_THRESHOLD,
  register,
  refreshClient,
  updateVariables,
  updateParams,
  updateView,
  getClientData,
} from "./clients";
import { initProcessor, initClient, rebuildClient } from "./state";
import {
  FAKE_TOPIC,
  FAKE_SCHEMA,
  FAKE_PATH,
  CLIENT_ID,
  createClient,
  createData,
  createPath,
  createState,
  createMessages,
  createParams,
} from "./testing";
import { State } from "./types";
import { DatasetsByPath, PlotPath, TypedDataSet } from "../internalTypes";

describe("refreshClient", () => {
  it("ignores client without params", () => {
    const client = initClient(CLIENT_ID, undefined);
    const initial: State = { ...initProcessor(), clients: [client] };
    const [newClient, effects] = refreshClient(client, initial);
    expect(newClient).toEqual(client);
    expect(effects).toEqual([]);
  });

  it("regenerates plots and triggers a rebuild", () => {
    const initial = createState(FAKE_PATH);
    const {
      clients: [client],
    } = initial;
    if (client == undefined) {
      throw new Error("client missing somehow");
    }
    const [newClient, effects] = refreshClient(client, initial);
    expect(effects).toEqual([rebuildClient(client.id)]);
    // we aren't testing accumulate(); just check whether the reference changed
    expect(newClient.blocks).not.toBe(client.blocks);
    expect(newClient.current).not.toBe(client.current);
  });
});

describe("updateVariables", () => {
  const vars = {
    foo: "bar",
  };
  it("does nothing when client does not use variables", () => {
    const before = createState(FAKE_PATH);
    const [after] = updateVariables(vars, before);
    expect(after.clients[0]).toEqual(before.clients[0]);
  });
  it("does nothing when client has no params", () => {
    const client = initClient(CLIENT_ID, undefined);
    const before: State = { ...initProcessor(), clients: [client] };
    const [after] = updateVariables(vars, before);
    expect(after.clients[0]).toEqual(before.clients[0]);
  });
  it("does nothing when client has invalid path", () => {
    const before = createState("你好");
    const [after] = updateVariables(vars, before);
    expect(after.clients[0]).toEqual(before.clients[0]);
  });
  it("refreshes the client when it does use variables", () => {
    const before = createState(`/topic.field[:]{id==$foo}`);
    const [after, effects] = updateVariables(vars, before);
    expect(after.clients[0]).not.toBe(before.clients[0]);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
});

describe("updateParams", () => {
  it("ignores missing id", () => {
    const before = createState();
    const [after] = updateParams("123", createParams(), before);
    expect(after.clients[0]).toEqual(before.clients[0]);
  });
  it("updates client", () => {
    const before = createState(FAKE_PATH);
    const params = createParams("/some.test");
    const [after, effects] = updateParams(CLIENT_ID, params, before);
    expect(after.clients[0]?.params).not.toEqual(before.clients[0]?.params);
    expect(after.clients[0]?.topics).toEqual(["/some"]);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
  it("moves data out of pending", () => {
    const before = {
      ...createState(),
      pending: createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1),
    };
    const [after, effects] = updateParams(CLIENT_ID, createParams(FAKE_PATH), before);
    expect(after.pending[FAKE_TOPIC]).toEqual(undefined);
    expect(after.blocks[FAKE_TOPIC]?.length).toEqual(1);
    expect(effects[0]).toEqual(rebuildClient(CLIENT_ID));
  });
});

describe("updateView", () => {
  const view: PlotViewport = {
    width: 0,
    height: 0,
    bounds: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
    },
  };
  it("ignores missing id", () => {
    const before = createState();
    const [after] = updateView("123", view, before);
    expect(after.clients[0]).toEqual(before.clients[0]);
  });
  it("updates client", () => {
    const before = createState(FAKE_PATH);
    const [after, effects] = updateView(CLIENT_ID, view, before);
    expect(after.clients[0]?.view).toEqual(view);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
});

describe("register", () => {
  it("ignores missing params", () => {
    const [after, effects] = register(CLIENT_ID, undefined, initProcessor());
    expect(after.clients.length).toEqual(1);
    expect(effects).toEqual([]);
  });
  it("updates the client's params after registration", () => {
    const [after, effects] = register(CLIENT_ID, createParams(FAKE_PATH), initProcessor());
    expect(after.clients.length).toEqual(1);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
});

describe("unregister", () => {
  it("removes an existing client", () => {
    const after = unregister(CLIENT_ID, createState());
    expect(after.clients.length).toEqual(0);
  });
});

describe("compressClients", () => {
  it("does nothing if not live", () => {
    const before = { ...createState(), isLive: false };
    const [after, effects] = compressClients(before);
    expect(effects.length).toEqual(0);
    expect(after).toEqual(before);
  });
  it("removes excess current messages", () => {
    const before = {
      ...createState(FAKE_PATH),
      isLive: true,
      current: createMessages(FAKE_TOPIC, FAKE_SCHEMA, MESSAGE_CULL_THRESHOLD + 1),
    };
    const [after, effects] = compressClients(before);
    expect(after.current[FAKE_TOPIC]?.length).toEqual(MESSAGE_CULL_THRESHOLD);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
  it("does not remove messages < MESSAGE_CULL_THRESHOLD", () => {
    const before = {
      ...createState(FAKE_PATH),
      isLive: true,
      current: createMessages(FAKE_TOPIC, FAKE_SCHEMA, MESSAGE_CULL_THRESHOLD - 1),
    };
    const [after, effects] = compressClients(before);
    expect(after.current[FAKE_TOPIC]?.length).toEqual(MESSAGE_CULL_THRESHOLD - 1);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
  });
});

describe("getClientData", () => {
  it("returns undefined if no params or view", () => {
    expect(getClientData({ ...createClient(), view: undefined })).toEqual(undefined);
  });

  const getDataset = (datasets: DatasetsByPath | undefined): TypedDataSet | undefined => {
    if (datasets == undefined) {
      return undefined;
    }

    const first: PlotPath | undefined = datasets.keys().next().value;
    if (first == undefined) {
      return undefined;
    }
    return datasets.get(first);
  };
  it("returns only block data if block contains current", () => {
    const initialClient = createClient(FAKE_PATH);
    const path = createPath(FAKE_PATH);
    const client = {
      ...initialClient,
      params: createParams(FAKE_PATH),
      view: {
        width: 0,
        height: 0,
        bounds: {
          x: { min: 0, max: 0 },
          y: { min: 0, max: 0 },
        },
      },
      blocks: {
        ...initialClient.blocks,
        data: {
          ...createData(path, 1),
          bounds: {
            x: { min: 0, max: 10 },
            y: { min: 0, max: 0 },
          },
        },
      },
      current: {
        ...initialClient.current,
        data: {
          ...createData(path, 2),
          bounds: {
            x: { min: 2, max: 8 },
            y: { min: 0, max: 0 },
          },
        },
      },
    };
    const result = getClientData(client);
    expect(getDataset(result?.datasets)?.data.length).toEqual(1);
  });
  it("returns both kinds of data if they do not overlap", () => {
    const initialClient = createClient(FAKE_PATH);
    const path = createPath(FAKE_PATH);
    const client = {
      ...initialClient,
      params: createParams(FAKE_PATH),
      view: {
        width: 0,
        height: 0,
        bounds: {
          x: { min: 0, max: 0 },
          y: { min: 0, max: 0 },
        },
      },
      blocks: {
        ...initialClient.blocks,
        data: {
          ...createData(path, 1),
          bounds: {
            x: { min: 0, max: 2 },
            y: { min: 0, max: 0 },
          },
        },
      },
      current: {
        ...initialClient.current,
        data: {
          ...createData(path, 2),
          bounds: {
            x: { min: 4, max: 8 },
            y: { min: 0, max: 0 },
          },
        },
      },
    };
    const result = getClientData(client);
    // there are 3 slices because mergeTyped adds a slice with NaN to cause a
    // split in the line
    expect(getDataset(result?.datasets)?.data.length).toEqual(3);
  });
});
