// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseInputUrl } from "@foxglove-studio/app/util/url";

describe("util/url", () => {
  describe("parseInputUrl", () => {
    it("accepts undefined, empty, and malformed input", () => {
      expect(parseInputUrl()).toBeUndefined();
      expect(parseInputUrl("")).toBeUndefined();
    });

    it("accepts fully formed URL input", () => {
      expect(parseInputUrl("http://server.com:11311/")).toEqual("http://server.com:11311/");
      expect(parseInputUrl("https://server.com:11311/")).toEqual("https://server.com:11311/");
    });

    it("accepts shorthand URL inputs", () => {
      expect(parseInputUrl("http://localhost:11311")).toEqual("http://localhost:11311/");
      expect(parseInputUrl("http://localhost")).toEqual("http://localhost/");
      expect(parseInputUrl("https://localhost")).toEqual("https://localhost/");
      expect(parseInputUrl("localhost:11311")).toEqual("https://localhost:11311/");
      expect(parseInputUrl("localhost")).toEqual("https://localhost/");
      expect(parseInputUrl("localhost:11311", "http:")).toEqual("http://localhost:11311/");
      expect(parseInputUrl("localhost", "http:")).toEqual("http://localhost/");
    });
  });
});
