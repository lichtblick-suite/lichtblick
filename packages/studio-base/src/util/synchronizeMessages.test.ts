// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Time } from "@foxglove/rostime";

import synchronizeMessages, { getSynchronizingReducers } from "./synchronizeMessages";

function message(topic: string, stamp?: Time) {
  return {
    topic,
    receiveTime: { sec: 0, nsec: 0 },
    message: { header: { stamp } },
  };
}

describe("synchronizeMessages", () => {
  it("returns nothing for empty frame", () => {
    expect(synchronizeMessages({})).toEqual(undefined);
    expect(synchronizeMessages({ "/foo": [] })).toEqual(undefined);
  });

  it("returns nothing for missing header", () => {
    expect(
      synchronizeMessages({
        "/foo": [message("/foo", undefined)],
      }),
    ).toEqual(undefined);

    expect(
      synchronizeMessages(
        {
          "/foo": [message("/foo", { sec: 1, nsec: 2 })],
        },
        () => undefined,
      ),
    ).toEqual(undefined);
  });

  it("works with single message", () => {
    const itemsByPath = {
      "/foo": [message("/foo", { sec: 1, nsec: 2 })],
    };
    expect(synchronizeMessages(itemsByPath)).toEqual(itemsByPath);
  });

  it("works with multiple messages", () => {
    const itemsByPath = {
      "/foo": [message("/foo", { sec: 1, nsec: 0 })],
      "/bar": [message("/bar", { sec: 1, nsec: 0 })],
      "/baz": [message("/baz", { sec: 1, nsec: 0 })],
    };
    expect(synchronizeMessages(itemsByPath)).toEqual(itemsByPath);
  });

  it("returns nothing for different stamps and missing messages", () => {
    expect(
      synchronizeMessages({
        "/foo": [message("/foo", { sec: 1, nsec: 0 })],
        "/bar": [message("/bar", { sec: 2, nsec: 0 })],
      }),
    ).toBeNullOrUndefined();

    expect(
      synchronizeMessages({
        "/foo": [message("/foo", { sec: 1, nsec: 0 })],
        "/bar": [message("/bar", { sec: 1, nsec: 0 })],
        "/baz": [],
      }),
    ).toBeNullOrUndefined();
  });

  it("returns latest of multiple matches regardless of order", () => {
    expect(
      synchronizeMessages({
        "/foo": [message("/foo", { sec: 1, nsec: 0 }), message("/foo", { sec: 2, nsec: 0 })],
        "/bar": [
          message("/bar", { sec: 2, nsec: 0 }),
          message("/bar", { sec: 0, nsec: 0 }),
          message("/bar", { sec: 1, nsec: 0 }),
        ],
      }),
    ).toEqual({
      "/foo": [message("/foo", { sec: 2, nsec: 0 })],
      "/bar": [message("/bar", { sec: 2, nsec: 0 })],
    });
  });
});

describe("getSynchronizingReducers", () => {
  it("restores all existing messages on the requested topics", () => {
    const { restore } = getSynchronizingReducers(["/a", "/b"]);

    expect(restore(undefined)).toEqual({
      messagesByTopic: {
        "/a": [],
        "/b": [],
      },
      synchronizedMessages: undefined,
    });

    expect(
      restore({
        messagesByTopic: {
          "/a": [message("/a", { sec: 1, nsec: 0 }), message("/a", { sec: 2, nsec: 0 })],
          "/c": [message("/c", { sec: 1, nsec: 0 })],
        },
        synchronizedMessages: undefined,
      }),
    ).toEqual({
      messagesByTopic: {
        "/a": [message("/a", { sec: 1, nsec: 0 }), message("/a", { sec: 2, nsec: 0 })],
        "/b": [],
      },
      synchronizedMessages: undefined,
    });
  });

  it("restores synchronized messages, removing old unneeded messages", () => {
    const { restore } = getSynchronizingReducers(["/a", "/b"]);
    expect(
      restore({
        messagesByTopic: {
          "/a": [message("/a", { sec: 1, nsec: 0 }), message("/a", { sec: 2, nsec: 0 })],
          "/b": [message("/b", { sec: 2, nsec: 0 })],
          "/c": [message("/c", { sec: 1, nsec: 0 })],
        },
        synchronizedMessages: undefined,
      }),
    ).toEqual({
      messagesByTopic: {
        "/a": [message("/a", { sec: 2, nsec: 0 })],
        "/b": [message("/b", { sec: 2, nsec: 0 })],
      },
      synchronizedMessages: {
        "/a": message("/a", { sec: 2, nsec: 0 }),
        "/b": message("/b", { sec: 2, nsec: 0 }),
      },
    });
  });

  it("keeps old messages when adding a new ones if stamps don't match", () => {
    const { addMessage } = getSynchronizingReducers(["/a", "/b"]);
    expect(
      addMessage(
        {
          messagesByTopic: {
            "/a": [message("/a", { sec: 1, nsec: 0 })],
            "/b": [message("/b", { sec: 2, nsec: 0 })],
          },
          synchronizedMessages: undefined,
        },
        message("/a", { sec: 3, nsec: 0 }),
      ),
    ).toEqual({
      messagesByTopic: {
        "/a": [message("/a", { sec: 1, nsec: 0 }), message("/a", { sec: 3, nsec: 0 })],
        "/b": [message("/b", { sec: 2, nsec: 0 })],
      },
      synchronizedMessages: undefined,
    });
  });

  it("synchronizes when adding a new message, removing old unneeded messages", () => {
    const { addMessage } = getSynchronizingReducers(["/a", "/b"]);
    expect(
      addMessage(
        {
          messagesByTopic: {
            "/a": [message("/a", { sec: 1, nsec: 0 })],
            "/b": [message("/b", { sec: 2, nsec: 0 })],
          },
          synchronizedMessages: undefined,
        },
        message("/a", { sec: 2, nsec: 0 }),
      ),
    ).toEqual({
      messagesByTopic: {
        "/a": [message("/a", { sec: 2, nsec: 0 })],
        "/b": [message("/b", { sec: 2, nsec: 0 })],
      },
      synchronizedMessages: {
        "/a": message("/a", { sec: 2, nsec: 0 }),
        "/b": message("/b", { sec: 2, nsec: 0 }),
      },
    });
  });
});
