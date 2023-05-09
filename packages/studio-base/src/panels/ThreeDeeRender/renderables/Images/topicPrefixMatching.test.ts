// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getTopicMatchPrefix, sortPrefixMatchesToFront } from "./topicPrefixMatching";

describe("getTopicMatchPrefix", () => {
  it("returns up until the last / if topic follows ROS naming conventions", () => {
    expect(getTopicMatchPrefix("/a/image_raw")).toBe("/a/");
    expect(getTopicMatchPrefix("/a/")).toBe(undefined);
    expect(getTopicMatchPrefix("ab/c")).toBe("ab/");
  });
});

describe("sortPrefixMatchesToFront", () => {
  it("sorts items with matching prefix to the front", () => {
    const array = [
      { topic: "/a/annotations" },
      { topic: "/b/annotations" },
      { topic: "/a/camera_info" },
      { topic: "/a/annotations2" },
    ];
    sortPrefixMatchesToFront(array, "/a/image_raw", (item) => item.topic);
    expect(array).toEqual([
      { topic: "/a/annotations" },
      { topic: "/a/camera_info" },
      { topic: "/a/annotations2" },
      { topic: "/b/annotations" },
    ]);
  });
});
