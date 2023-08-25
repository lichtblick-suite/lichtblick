// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { subscribePayloadFromMessagePath } from "@foxglove/studio-base/players/subscribePayloadFromMessagePath";

describe("subscribePayloadFromMessagePath", () => {
  it("handles whole topic paths", () => {
    const result = subscribePayloadFromMessagePath("topic", "partial");
    expect(result).toEqual({ topic: "topic", preloadType: "partial" });
  });

  it("handles specific field paths", () => {
    const result = subscribePayloadFromMessagePath("topic.field");
    expect(result).toEqual({ topic: "topic", fields: ["field"], preloadType: "partial" });
  });

  it("handles nested field paths", () => {
    const result = subscribePayloadFromMessagePath("topic.field.subfield");
    expect(result).toEqual({ topic: "topic", fields: ["field"], preloadType: "partial" });
  });

  it("handles complex paths", () => {
    const result = subscribePayloadFromMessagePath("topic{x==1}.field[:].subfield");
    expect(result).toEqual({ topic: "topic", fields: ["field"], preloadType: "partial" });
  });
});
