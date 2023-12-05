// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";
import { SubscribePayload } from "@foxglove/studio-base/players/types";

import { initBlockState, processBlocks, refreshBlockTopics } from "./blocks";

const FAKE_TOPIC = "/foo";
const createSubscription = (topic: string): SubscribePayload => ({
  topic,
});

const createBlock = (value: unknown): MessageBlock => ({
  [FAKE_TOPIC]: [
    {
      topic: FAKE_TOPIC,
      schemaName: "",
      sizeInBytes: 0,
      message: value,
      receiveTime: fromSec(0),
    },
  ],
});

describe("refreshBlockTopics", () => {
  it("should clear out unused topics and add new ones", () => {
    const { messages, cursors } = refreshBlockTopics([createSubscription(FAKE_TOPIC)], {
      messages: [
        {
          "/bar": "baz",
        },
      ],
      cursors: {
        "/bar": 0,
      },
    });
    expect(messages).toEqual([{ [FAKE_TOPIC]: undefined }]);
    expect(cursors).toEqual({ [FAKE_TOPIC]: 0 });
  });
});

// This functionality is far more complex than it appears at first glance and
// it is worth documenting why this is the case here rather than in some
// external document that will probably not be updated.
//
// I came up with a concise way of describing this problem to make the state
// machine's behavior easier to understand. Message blocks can be represented
// as a 1D array of cells, each of which can be in one of four states:
// s = same
// c = changed
// n = new
// e = empty
//
// Blocks are accumulated and sent using a cursor system, here represented by
// the pipe character ("|"). This indicates that all of the data prior to the
// cursor has been sent.
//
// For example:
// ssss|nnneee
// |    |  |
// |    |  empty data that has not been loaded
// |    new data
// unchanged
//
// processBlocks does the following:
// * moves the cursor forward according to a set of rules and returns the new
//   data as a set of bundles that can be forwarded to the plot worker
// * indicates whether the existing data already sent should be cleared
// * stores the first message of each block that was sent so we can detect
//   changed blocks
//
// In this case, processBlocks would return a new state that looks like this:
// sssssss|eee
//
// In instances where the data should be cleared, we append an asterisk ("*")
// to the end of the state string.
//
// Some examples:
// ssss|nnneee -> sssssss|eee (data accumulating normally)
// s|nene -> sses|e (skipping empty data)
// cs|nnneee -> s|snnneee* (a block was changed before the cursor)
// sss|ccsss -> sssss|sss (a block was changed after the cursor)
//
// We use this system for describing each test case.
describe("processBlocks", () => {
  const subscriptions: SubscribePayload[] = [createSubscription(FAKE_TOPIC)];
  const initial = refreshBlockTopics(subscriptions, initBlockState());
  const block = createBlock(1);

  it("should send data as it arrives", () => {
    // |ne -> s|e
    const first = processBlocks([block, {}], subscriptions, initial);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = first;
      expect(messages[0]?.[FAKE_TOPIC]).toEqual(1);
      expect(cursors[FAKE_TOPIC]).toEqual(1);
      expect(resetTopics).toEqual([]);
      expect(newData).toEqual([block]);
    }

    // s|n -> ss|
    const second = processBlocks([block, block], subscriptions, first.state);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = second;
      expect(messages[1]?.[FAKE_TOPIC]).toEqual(1);
      expect(cursors[FAKE_TOPIC]).toEqual(2);
      expect(resetTopics).toEqual([]);
      expect(newData).toEqual([block]);
    }
  });

  it("should skip empty blocks", () => {
    // |nene -> ses|e
    const {
      state: { messages, cursors },
      resetTopics,
      newData,
    } = processBlocks([block, {}, block, {}], subscriptions, initial);
    expect(messages[2]?.[FAKE_TOPIC]).toEqual(1);
    expect(cursors[FAKE_TOPIC]).toEqual(3);
    expect(resetTopics).toEqual([]);
    expect(newData).toEqual([block, block]);
  });

  it("should not send data beyond changed data", () => {
    const newBlock = createBlock(2);

    // we have loaded a full range of data
    // |nnn -> sss|
    const before = processBlocks([block, block, block], subscriptions, initial);

    // change some of it
    // ccs| -> ss|s
    const first = processBlocks([newBlock, newBlock, block], subscriptions, before.state);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = first;
      expect(messages[1]?.[FAKE_TOPIC]).toEqual(2);
      expect(cursors[FAKE_TOPIC]).toEqual(2);
      expect(resetTopics).toEqual([FAKE_TOPIC]);
      expect(newData).toEqual([newBlock, newBlock]);
    }

    // ss|c -> sss|
    const second = processBlocks([newBlock, newBlock, newBlock], subscriptions, first.state);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = second;
      expect(messages[2]?.[FAKE_TOPIC]).toEqual(2);
      expect(cursors[FAKE_TOPIC]).toEqual(3);
      expect(resetTopics).toEqual([]);
      expect(newData).toEqual([newBlock]);
    }
  });

  it("should resend all data up to and including change if there is a change in the middle", () => {
    const newBlock = createBlock(2);

    // |nnn -> sss|
    const before = processBlocks([block, block, block], subscriptions, initial);

    // scs| -> ss|s*
    const first = processBlocks([block, newBlock, block], subscriptions, before.state);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = first;
      expect(messages[1]?.[FAKE_TOPIC]).toEqual(2);
      expect(cursors[FAKE_TOPIC]).toEqual(2);
      expect(resetTopics).toEqual([FAKE_TOPIC]);
      expect(newData).toEqual([block, newBlock]);
    }

    // if we get new blocks but there were no more changes, just send the rest
    // ss|s -> sss|
    const second = processBlocks([block, newBlock, block], subscriptions, first.state);
    {
      const {
        state: { messages, cursors },
        resetTopics,
        newData,
      } = second;
      expect(messages[2]?.[FAKE_TOPIC]).toEqual(1);
      expect(cursors[FAKE_TOPIC]).toEqual(3);
      expect(resetTopics).toEqual([]);
      expect(newData).toEqual([block]);
    }
  });

  it("should start from beginning when blocks before cursor are emptied", () => {
    // ssss| -> s|eee
    const { state } = processBlocks([block, block, block, block], subscriptions, initial);
    const {
      state: { messages, cursors },
      resetTopics,
      newData,
    } = processBlocks([block, {}, {}, {}], subscriptions, state);
    expect(messages[0]?.[FAKE_TOPIC]).toEqual(1);
    expect(cursors[FAKE_TOPIC]).toEqual(1);
    expect(resetTopics).toEqual([FAKE_TOPIC]);
    expect(newData).toEqual([block]);
  });
});
