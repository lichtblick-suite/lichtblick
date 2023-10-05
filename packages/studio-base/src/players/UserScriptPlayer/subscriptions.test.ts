// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SubscribePayload } from "@foxglove/studio-base/players/types";

import { remapVirtualSubscriptions, getPreloadTypes } from "./subscriptions";

describe("getPreloadTypes", () => {
  it("leave a partial subscription in place", () => {
    expect(
      getPreloadTypes([
        {
          topic: "/test",
          preloadType: "partial",
        },
      ]),
    ).toEqual({
      "/test": {
        topic: "/test",
        preloadType: "partial",
      },
    });
  });

  it("upgrades to a full subscription from partial", () => {
    expect(
      getPreloadTypes([
        {
          topic: "/test",
          preloadType: "full",
        },
        {
          topic: "/test",
          preloadType: "partial",
        },
      ]),
    ).toEqual({
      "/test": {
        topic: "/test",
        preloadType: "full",
      },
    });
  });
});

describe("remapVirtualSubscriptions", () => {
  const call = (
    subscriptions: SubscribePayload[],
    inputsByOutputTopic: Record<string, readonly string[]>,
  ) => remapVirtualSubscriptions(subscriptions, new Map(Object.entries(inputsByOutputTopic)));

  it("ignores unrelated subscriptions", () => {
    expect(
      call(
        [
          {
            topic: "/test",
          },
        ],
        {},
      ),
    ).toEqual([
      {
        topic: "/test",
      },
    ]);
  });

  it("ignores virtual topics without inputs", () => {
    expect(
      call(
        [
          {
            topic: "/test",
          },
        ],
        {
          "/test": [],
        },
      ),
    ).toEqual([]);
  });

  it("upgrades to a full subscription from partial", () => {
    expect(
      call(
        [
          {
            topic: "/test",
            preloadType: "full",
          },
          {
            topic: "/test",
            preloadType: "partial",
          },
        ],
        {
          "/test": ["/test2"],
        },
      ),
    ).toEqual([
      {
        topic: "/test2",
        preloadType: "full",
      },
      {
        topic: "/test2",
        preloadType: "partial",
      },
    ]);
  });

  it("upgrades to a whole-message subscription from fields", () => {
    expect(
      call(
        [
          {
            topic: "/test",
            fields: ["one", "two"],
          },
        ],
        {
          "/test": ["/test2"],
        },
      ),
    ).toEqual([
      {
        topic: "/test2",
        preloadType: "partial",
      },
    ]);
  });

  it("upgrades to a full subscription from fields even when user also subscribes to input", () => {
    expect(
      call(
        [
          {
            topic: "/test",
            fields: ["one", "two"],
          },
          {
            topic: "/test2",
            fields: ["one", "two"],
          },
        ],
        {
          "/test": ["/test2"],
        },
      ),
    ).toEqual([
      {
        topic: "/test2",
        preloadType: "partial",
      },
    ]);
  });
  it("should not coalesce sliced input subscriptions and whole message input subscriptions across preload types", () => {
    const subscriptions: SubscribePayload[] = [
      {
        topic: "/output",
        preloadType: "partial",
      },
      {
        topic: "/input",
        preloadType: "full",
        fields: ["one", "two"],
      },
    ];
    const inputsByOutputTopic = {
      "/output": ["/input"],
    };
    const expected = [
      {
        topic: "/input",
        preloadType: "full",
        fields: ["one", "two"],
      },
      {
        topic: "/input",
        preloadType: "partial",
      },
    ];
    expect(call(subscriptions, inputsByOutputTopic)).toEqual(expected);
  });
});
