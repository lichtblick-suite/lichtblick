// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { addBlockData, addCurrentData, updateMetadata, clearCurrentData } from "./messages";
import { initProcessor, rebuildClient } from "./state";
import {
  createParams,
  createClient,
  createBlockUpdate,
  createMessageEvents,
  createState,
  FAKE_PATH,
  CLIENT_ID,
  FAKE_TOPIC,
  FAKE_TOPICS,
  FAKE_DATATYPES,
  FAKE_SCHEMA,
} from "./testing";
import { SideEffectType, State } from "./types";
import { EmptyPlotData } from "../plotData";

describe("receiveMetadata", () => {
  it("updates metadata", () => {
    const before = initProcessor();
    const after = updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, before);
    expect(after.metadata).not.toEqual(before);
  });
});

describe("addBlockData", () => {
  it("adds messages to pending if no client matches", () => {
    const [after] = addBlockData(
      createBlockUpdate("no-client", FAKE_TOPIC, FAKE_SCHEMA, 1),
      initProcessor(),
    );
    expect(after.pending.length).toEqual(1);
  });
  it("ignores client without params", () => {
    const before = {
      ...initProcessor(),
      clients: [createClient()],
    };
    const [after, effects] = addBlockData(
      createBlockUpdate(CLIENT_ID, FAKE_TOPIC, FAKE_SCHEMA, 1),
      before,
    );
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(0);
  });
  it("ignores client with single message params", () => {
    const before: State = {
      ...initProcessor(),
      clients: [
        {
          ...createClient(),
          params: {
            ...createParams(FAKE_PATH),
            xAxisVal: "index",
          },
        },
      ],
    };
    const [after, effects] = addBlockData(
      createBlockUpdate(CLIENT_ID, FAKE_TOPIC, FAKE_SCHEMA, 1),
      before,
    );
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(0);
  });
  it("builds plot data for client", () => {
    const before: State = updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addBlockData(
      createBlockUpdate(CLIENT_ID, FAKE_TOPIC, FAKE_SCHEMA, 1),
      before,
    );
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.blocks).not.toEqual(before.clients[0]?.blocks);
  });
  it("clears out the plot data for a client", () => {
    const before: State = updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addBlockData(
      createBlockUpdate(CLIENT_ID, FAKE_TOPIC, FAKE_SCHEMA, 1, { shouldReset: true }),
      before,
    );
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.blocks).not.toEqual(before.clients[0]?.blocks);
  });
});

describe("addCurrentData", () => {
  it("ignores client without params", () => {
    const before = {
      ...initProcessor(),
      clients: [createClient()],
    };
    const [after, effects] = addCurrentData([], undefined, before);
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(0);
  });
  it("updates a client with single message plot", () => {
    const before: State = {
      ...initProcessor(),
      clients: [
        {
          ...createClient(),
          params: {
            ...createParams(FAKE_PATH),
            xAxisVal: "index",
          },
        },
      ],
    };
    const [after, effects] = addCurrentData(
      createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1),
      undefined,
      before,
    );
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(1);
    expect(effects[0]?.type).toEqual(SideEffectType.Send);
  });
  it("builds plot data for client", () => {
    const before: State = updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addCurrentData(
      createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1),
      undefined,
      before,
    );
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.current).not.toEqual(before.clients[0]?.current);
  });
  it("builds plot data for single client if id provided", () => {
    const state = createState(FAKE_PATH);
    const twoClients = {
      ...state,
      clients: [
        ...state.clients,
        {
          ...createClient(FAKE_PATH),
          id: "other-id",
        },
      ],
    };
    const before: State = updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, twoClients);
    const [after, effects] = addCurrentData(
      createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1),
      // Only send to one client
      CLIENT_ID,
      before,
    );
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[1]?.current).toEqual(before.clients[1]?.current);
  });
});

describe("clearCurrentData", () => {
  it("clears existing client state", () => {
    const [before] = addCurrentData(
      createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1),
      undefined,
      updateMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH)),
    );
    const [after, effects] = clearCurrentData(before);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.current).not.toEqual(before.clients[0]?.current);
    expect(after.clients[0]?.current.data).toEqual(EmptyPlotData);
  });
});
