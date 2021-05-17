// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseInputUrl } from "@foxglove/studio-base/util/url";

const DEFAULT_PROTOS = {
  "http:": { port: 80 },
  "https:": { port: 443 },
  "ws:": { port: 9090 },
  "wss:": { port: 9090 },
  "ros:": { protocol: "http:", port: 11311 },
  "custom:": { protocol: "custom2:", port: 9000 },
};

describe("util/url", () => {
  describe("parseInputUrl", () => {
    it("accepts empty, and malformed input", () => {
      expect(parseInputUrl("")).toBeUndefined();
      expect(parseInputUrl("localhost", "test:", DEFAULT_PROTOS)).toEqual(undefined);
    });

    it("accepts fully formed URL input", () => {
      expect(parseInputUrl("http://server.com:11311/", "test:", DEFAULT_PROTOS)).toEqual(
        "http://server.com:11311/",
      );
      expect(parseInputUrl("https://server.com:11311/", "http:", DEFAULT_PROTOS)).toEqual(
        "https://server.com:11311/",
      );
    });

    it("accepts shorthand URL inputs", () => {
      expect(parseInputUrl("http://localhost:11311", "test:", DEFAULT_PROTOS)).toEqual(
        "http://localhost:11311/",
      );
      expect(parseInputUrl("http://localhost", "test:", DEFAULT_PROTOS)).toEqual(
        "http://localhost/",
      );
      expect(parseInputUrl("https://localhost", "test:", DEFAULT_PROTOS)).toEqual(
        "https://localhost/",
      );
      expect(parseInputUrl("localhost:11", "ros:", DEFAULT_PROTOS)).toEqual("http://localhost:11/");
      expect(parseInputUrl("localhost", "test:", DEFAULT_PROTOS)).toEqual(undefined);
      expect(parseInputUrl("localhost", "ros:", DEFAULT_PROTOS)).toEqual("http://localhost:11311/");
      expect(parseInputUrl("localhost:11311", "http:", DEFAULT_PROTOS)).toEqual(
        "http://localhost:11311/",
      );
      expect(parseInputUrl("localhost", "http:", DEFAULT_PROTOS)).toEqual("http://localhost/");
      expect(parseInputUrl("localhost", "http:", DEFAULT_PROTOS)).toEqual("http://localhost/");
      expect(parseInputUrl("localhost", "http:", DEFAULT_PROTOS)).toEqual("http://localhost/");
      expect(parseInputUrl("localhost:11312", "http:", DEFAULT_PROTOS)).toEqual(
        "http://localhost:11312/",
      );
      expect(parseInputUrl("127.0.0.1", "https:", DEFAULT_PROTOS)).toEqual("https://127.0.0.1/");
      expect(parseInputUrl("127.0.0.1", "https:", DEFAULT_PROTOS)).toEqual("https://127.0.0.1/");
      expect(parseInputUrl("127.0.0.1", "ws:", DEFAULT_PROTOS)).toEqual("ws://127.0.0.1:9090/");
      expect(parseInputUrl("127.0.0.1", "wss:", DEFAULT_PROTOS)).toEqual("wss://127.0.0.1:9090/");
      expect(parseInputUrl("127.0.0.1", "ros:", DEFAULT_PROTOS)).toEqual("http://127.0.0.1:11311/");

      expect(parseInputUrl("a", "custom:", DEFAULT_PROTOS)).toEqual("custom2://a:9000");
      expect(parseInputUrl("a", "custom2:", DEFAULT_PROTOS)).toEqual(undefined);
    });
  });
});
