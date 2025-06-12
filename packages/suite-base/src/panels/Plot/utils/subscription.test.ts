// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseMessagePath } from "@lichtblick/message-path";

import { pathToSubscribePayload } from "./subscription";

describe("subscription", () => {
  describe("pathToPayload", () => {
    const toPayload = (path: string) => {
      const parsed = parseMessagePath(path);
      if (parsed == undefined) {
        throw new Error(`invalid path: ${path}`);
      }

      return pathToSubscribePayload(parsed, "full");
    };

    it("ignores path without a property", () => {
      expect(toPayload("/foo")).toEqual(undefined);
      expect(toPayload("/foo.")).toEqual(undefined);
    });

    it("subscribes to one field", () => {
      expect(toPayload("/foo.bar")).toEqual({
        topic: "/foo",
        preloadType: "full",
        fields: ["header", "bar"],
      });
    });

    it("subscribes to field and filter", () => {
      expect(toPayload("/foo{baz==2}.bar")).toEqual({
        topic: "/foo",
        preloadType: "full",
        fields: ["header", "bar", "baz"],
      });
    });

    it("subscribes to multiple filters", () => {
      expect(toPayload("/foo{baz==2}{fox==3}.bar")).toEqual({
        topic: "/foo",
        preloadType: "full",
        fields: ["header", "bar", "baz", "fox"],
      });
    });

    it("should ignore filters that come later", () => {
      expect(toPayload("/foo{fox==3}.bar{blah==2}")).toEqual({
        topic: "/foo",
        preloadType: "full",
        fields: ["header", "bar", "fox"],
      });
    });
  });
});
