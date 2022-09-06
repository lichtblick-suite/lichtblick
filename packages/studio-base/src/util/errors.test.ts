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

import { AppError } from "@foxglove/studio-base/util/errors";

describe("errors", () => {
  describe("AppError", () => {
    it("is an instanceof itself", () => {
      const err = new AppError("example");
      expect(err.name).toBe("AppError");
      expect(err).toBeInstanceOf(AppError);
    });
    it("copies the original error", () => {
      const err = new Error("simple error");
      const { message } = new AppError(err);
      expect(message.includes(err.message)).toBeTruthy();
    });
    it("captures extra info", () => {
      const extraInfo = { foo: "bar" };
      const err = new AppError(new Error("simple error"), extraInfo);
      expect(err.extraInfo).toEqual(extraInfo);
    });
    it("uses 'details' as the message if it is a string", () => {
      const { message } = new AppError("internal error");
      expect(message).toEqual("internal error");
    });
    it("returns 'Unknown Error' if the details object is a React Node", () => {
      const { message } = new AppError(React.createElement(""));
      expect(message).toEqual("Unknown Error");
    });
    it("stringifies extraInfo when possible", () => {
      const { message } = new AppError("internal error", { foo: "bar" });
      expect(message.includes('{"foo":"bar"}')).toBeTruthy();
    });
    it("catches cyclic object values in extraInfo", () => {
      const obj: {
        [key: string]: unknown;
      } = {};
      obj.foo = obj;
      const { message } = new AppError("internal error", obj);
      expect(message.includes("[ Either cyclic object or object with BigInt(s) ]")).toBeTruthy();
    });
    it("catches BigInt values in extraInfo", () => {
      const { message } = new AppError("internal error", { val: BigInt(10) });
      expect(message.includes("[ Either cyclic object or object with BigInt(s) ]")).toBeTruthy();
    });
  });
});
