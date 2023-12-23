// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";

import {
  pathToPayload,
  resetClientBlocks,
  updateBlocks,
  registerClient,
  initDatasets,
  updateParams,
} from "./clients";
import { FAKE_TOPIC, FAKE_PATH, CLIENT_ID, createParams } from "./processor/testing";
import { createBlock } from "./testing";

describe("pathToPayload", () => {
  const call = (path: string) => {
    const parsed = parseRosPath(path);
    if (parsed == undefined) {
      throw new Error(`invalid path: ${path}`);
    }

    return pathToPayload(parsed);
  };
  it("ignores path without a property", () => {
    expect(call("/foo")).toEqual(undefined);
  });
  it("subscribes to one field", () => {
    expect(call("/foo.bar")).toEqual({
      topic: "/foo",
      fields: ["bar", "header"],
    });
  });
  it("subscribes to field and filter", () => {
    expect(call("/foo{baz==2}.bar")).toEqual({
      topic: "/foo",
      fields: ["baz", "bar", "header"],
    });
  });
  it("subscribes to multiple filters", () => {
    expect(call("/foo{baz==2}{fox==3}.bar")).toEqual({
      topic: "/foo",
      fields: ["baz", "fox", "bar", "header"],
    });
  });
  it("should ignore filters that come later", () => {
    expect(call("/foo{fox==3}.bar{blah==2}")).toEqual({
      topic: "/foo",
      fields: ["fox", "bar", "header"],
    });
  });
});

const FAKE_PARAMS = createParams(FAKE_PATH);

describe("updateBlocks", () => {
  it("should produce an update for a client", () => {
    const before = updateParams(CLIENT_ID, FAKE_PARAMS, registerClient(CLIENT_ID, initDatasets()));
    const [after, update] = updateBlocks([createBlock(1)], before);
    // processBlocks has its own test suite--no need to inspect this state more
    // than this
    expect(after.clients[CLIENT_ID]?.blockState).not.toEqual(before.clients[CLIENT_ID]?.blockState);
    // We do want to make sure updateBlocks produces an update for this
    // client, however
    expect(update.updates[0]).toEqual({
      id: CLIENT_ID,
      update: {
        blockRange: [0, 1],
        topic: FAKE_TOPIC,
        shouldReset: true,
      },
    });
  });
});

describe("updateParams", () => {
  it("should ignore a missing client", () => {
    const before = initDatasets();
    const after = updateParams("missing", FAKE_PARAMS, before);
    expect(after).toEqual(before);
  });

  it("should update a client's params", () => {
    const before = registerClient(CLIENT_ID, initDatasets());
    const after = updateParams(CLIENT_ID, FAKE_PARAMS, before);
    expect(after.clients[CLIENT_ID]?.params).toEqual(FAKE_PARAMS);
    expect(after.clients[CLIENT_ID]?.blockState).not.toEqual(before.clients[CLIENT_ID]?.blockState);
  });
});

describe("resetClientBlocks", () => {
  it("should reset a client's state", () => {
    const [before] = updateBlocks(
      [createBlock(1)],
      updateParams(CLIENT_ID, FAKE_PARAMS, registerClient(CLIENT_ID, initDatasets())),
    );
    // The only change to the state will be in the blocks state machine, which
    // has its own coverage
    const [, update] = resetClientBlocks(CLIENT_ID, before);
    // We do want to make sure all of the blocks are reprocessed, though
    expect(update.updates[0]).toEqual({
      id: CLIENT_ID,
      update: {
        blockRange: [0, 1],
        topic: FAKE_TOPIC,
        shouldReset: true,
      },
    });
  });
});
