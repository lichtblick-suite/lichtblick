// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

describe("custom expectations", () => {
  describe("toContainOnly", () => {
    it("passes when arrays match", () => {
      expect([1]).toContainOnly([1]);
      expect([1, 2]).not.toContainOnly([1]);
      expect([2]).not.toContainOnly([1]);
      expect([{ foo: "bar" }]).toContainOnly([{ foo: "bar" }]);
      expect([{ foo: "bar" }, 2, { foo: "baz" }]).toContainOnly([
        2,
        { foo: "baz" },
        { foo: "bar" },
      ]);
    });

    it("throws when arrays do not match", () => {
      expect(() => {
        expect([{ foo: "bar" }]).toContainOnly([{ foo: "bar2" }]);
      }).toThrow();
      expect(() => {
        expect([{ foo: "bar" }]).toContainOnly([{ foo: "bar" }, { foo: "baz" }]);
      }).toThrow();
    });

    it("handles same-length arrays", () => {
      expect([1, 1]).toContainOnly([1, 1]);
      expect([1, 1]).not.toContainOnly([1, 2]);
      expect([1, 2]).not.toContainOnly([1, 1]);
    });
  });

  describe("toBeNullOrUndefined", () => {
    it("passes only when given null or undefined", () => {
      expect(null).not.toEqual(undefined); // eslint-disable-line no-restricted-syntax
      expect(null).toBeNullOrUndefined(); // eslint-disable-line no-restricted-syntax
      expect(undefined).toBeNullOrUndefined();
      expect(0).not.toBeNullOrUndefined();
      expect("").not.toBeNullOrUndefined();
      expect([]).not.toBeNullOrUndefined();
      expect({}).not.toBeNullOrUndefined();
    });
  });
});

// eslint-disable-next-line jest/no-export
export {}; // for isolatedModules
