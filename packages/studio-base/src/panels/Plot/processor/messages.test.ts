// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { addBlock, addCurrent, receiveMetadata, evictCache, clearCurrent } from "./messages";
import { initProcessor, rebuildClient } from "./state";
import {
  createParams,
  createClient,
  createMessages,
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
    const after = receiveMetadata(FAKE_TOPICS, FAKE_DATATYPES, before);
    expect(after.metadata).not.toEqual(before);
  });
});

describe("evictCache", () => {
  it("removes unused topics", () => {
    const after = evictCache({
      ...createState("/foo.bar"),
      blocks: {
        "/bar.baz": [],
      },
    });
    expect(Object.entries(after.blocks).length).toEqual(0);
  });
});

describe("addBlock", () => {
  it("resets the requested topics", () => {
    const [after] = addBlock({}, [FAKE_TOPIC], {
      ...initProcessor(),
      blocks: createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1),
    });
    expect(Object.entries(after.blocks).length).toEqual(0);
  });
  it("concatenates messages", () => {
    const [after] = addBlock(createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1), [], {
      ...initProcessor(),
      blocks: createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1),
    });
    expect(after.blocks[FAKE_TOPIC]?.length).toEqual(2);
  });
  it("ignores client without params", () => {
    const before = {
      ...initProcessor(),
      clients: [createClient()],
    };
    const [after, effects] = addBlock({}, [], before);
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
    const [after, effects] = addBlock({}, [], before);
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(0);
  });
  it("ignores client with no related topics", () => {
    const before: State = createState("/bar.baz");
    const [after, effects] = addBlock(createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1), [], before);
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(0);
  });
  it("builds plot data for client", () => {
    const before: State = receiveMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addBlock(createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1), [], before);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.blocks).not.toEqual(before.clients[0]?.blocks);
  });
  it("clears out the plot data for a client", () => {
    const before: State = receiveMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addBlock(
      createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1),
      [FAKE_TOPIC],
      before,
    );
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.blocks).not.toEqual(before.clients[0]?.blocks);
    expect(after.clients[0]?.blocks.cursors?.[FAKE_TOPIC]).toEqual(1);
  });
});

describe("addCurrent", () => {
  it("concatenates messages", () => {
    const [after] = addCurrent(createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1), {
      ...createState(FAKE_PATH),
      current: createMessages(FAKE_TOPIC, FAKE_SCHEMA, 1),
    });
    expect(after.current[FAKE_TOPIC]?.length).toEqual(2);
  });
  it("ignores client without params", () => {
    const before = {
      ...initProcessor(),
      clients: [createClient()],
    };
    const [after, effects] = addCurrent([], before);
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
    const [after, effects] = addCurrent(createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1), before);
    expect(after.clients[0]).toEqual(before.clients[0]);
    expect(effects.length).toEqual(1);
    expect(effects[0]?.type).toEqual(SideEffectType.Send);
  });
  it("builds plot data for client", () => {
    const before: State = receiveMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const [after, effects] = addCurrent(createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1), before);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.current).not.toEqual(before.clients[0]?.current);
  });
});

describe("clearCurrent", () => {
  it("clears existing client state", () => {
    const [before] = addCurrent(
      createMessageEvents(FAKE_TOPIC, FAKE_SCHEMA, 1),
      createState(FAKE_PATH),
    );
    const [after, effects] = clearCurrent(before);
    expect(effects).toEqual([rebuildClient(CLIENT_ID)]);
    expect(after.clients[0]?.current).not.toEqual(before.clients[0]?.current);
    expect(after.clients[0]?.current.data).toEqual(EmptyPlotData);
  });
});
