// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { parse as parseMessageDefinition } from "@foxglove/rosmsg";

import { MessageWriter } from "./MessageWriter";

const getStringBytes = (str: string): Uint8Array => {
  const textData = new TextEncoder().encode(str);
  const output = new Uint8Array(4 + textData.length);
  new DataView(output.buffer).setInt32(0, textData.length, true);
  output.set(textData, 4);
  return output;
};

function concat(list: readonly Uint8Array[]): Uint8Array {
  const length = list.reduce((sum, entry) => sum + entry.length, 0);
  const output = new Uint8Array(length);
  let i = 0;
  for (const entry of list) {
    output.set(entry, i);
    i += entry.length;
  }
  return output;
}

function writeInt8(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setInt8(offset, value);
}

function writeInt16LE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setInt16(offset, value, true);
}

function writeUInt16LE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setUint16(offset, value, true);
}

function writeInt32LE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setInt32(offset, value, true);
}

function writeUInt32LE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setUint32(offset, value, true);
}

function writeFloatLE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setFloat32(offset, value, true);
}

function writeDoubleLE(data: Uint8Array, value: number, offset: number): void {
  new DataView(data.buffer, data.byteOffset).setFloat64(offset, value, true);
}

describe("MessageWriter", () => {
  describe("simple type", () => {
    const testNum = (
      type: string,
      size: number,
      expected: number,
      cb: (data: Uint8Array) => void,
    ): void => {
      const data = new Uint8Array(size);
      const message = { foo: expected };
      cb(data);
      it(`writes message ${JSON.stringify(message)} containing ${type}`, () => {
        const writer = new MessageWriter(parseMessageDefinition(`${type} foo`));
        expect(
          writer.writeMessage({
            foo: expected,
          }),
        ).toEqual(data);
      });
    };

    testNum("int8", 1, -3, (data) => writeInt8(data, -3, 0));
    testNum("uint8", 1, 13, (data) => writeInt8(data, 13, 0));
    testNum("int16", 2, -21, (data) => writeInt16LE(data, -21, 0));
    testNum("uint16", 2, 21, (data) => writeUInt16LE(data, 21, 0));
    testNum("int32", 4, -210010, (data) => writeInt32LE(data, -210010, 0));
    testNum("uint32", 4, 210010, (data) => writeUInt32LE(data, 210010, 0));
    testNum("float32", 4, 5.5, (data) => writeFloatLE(data, 5.5, 0));
    testNum("float64", 8, 0xdeadbeefcafebabe, (data) => writeDoubleLE(data, 0xdeadbeefcafebabe, 0));

    it("writes strings", () => {
      const writer = new MessageWriter(parseMessageDefinition("string name"));
      const buff = getStringBytes("test");
      expect(writer.writeMessage({ name: "test" })).toEqual(buff);
    });

    it("writes JSON", () => {
      const writer = new MessageWriter(
        parseMessageDefinition("#pragma rosbag_parse_json\nstring dummy"),
      );
      const buff = getStringBytes('{"foo":123,"bar":{"nestedFoo":456}}');
      expect(
        writer.writeMessage({
          dummy: { foo: 123, bar: { nestedFoo: 456 } },
        }),
      ).toEqual(buff);

      const writerWithNestedComplexType = new MessageWriter(
        parseMessageDefinition(`#pragma rosbag_parse_json
      string dummy
      Account account
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      `),
      );
      expect(
        writerWithNestedComplexType.writeMessage({
          dummy: { foo: 123, bar: { nestedFoo: 456 } },
          account: { name: '{"first":"First","last":"Last"}}', id: 100 },
        }),
      ).toEqual(
        concat([
          buff,
          getStringBytes('{"first":"First","last":"Last"}}'),
          new Uint8Array([100, 0x00]),
        ]),
      );

      const writerWithTrailingPragmaComment = new MessageWriter(
        parseMessageDefinition(`#pragma rosbag_parse_json
      string dummy
      Account account
      #pragma rosbag_parse_json
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      `),
      );
      expect(
        writerWithTrailingPragmaComment.writeMessage({
          dummy: { foo: 123, bar: { nestedFoo: 456 } },
          account: { name: '{"first":"First","last":"Last"}}', id: 100 },
        }),
      ).toEqual(
        concat([
          buff,
          getStringBytes('{"first":"First","last":"Last"}}'),
          new Uint8Array([100, 0x00]),
        ]),
      );
    });

    it("writes time", () => {
      const writer = new MessageWriter(parseMessageDefinition("time right_now"));
      const buff = new Uint8Array(8);
      const now = new Date();
      now.setSeconds(31);
      now.setMilliseconds(0);
      const seconds = Math.round(now.getTime() / 1000);
      writeUInt32LE(buff, seconds, 0);
      writeUInt32LE(buff, 1000000, 4);
      now.setMilliseconds(1);
      expect(
        writer.writeMessage({
          right_now: {
            nsec: 1000000,
            sec: seconds,
          },
        }),
      ).toEqual(buff);
    });
  });

  describe("array", () => {
    it("writes variable length string array", () => {
      const writer = new MessageWriter(parseMessageDefinition("string[] names"));
      const buff = concat([
        // variable length array has int32 as first entry
        new Uint8Array([0x03, 0x00, 0x00, 0x00]),
        getStringBytes("foo"),
        getStringBytes("bar"),
        getStringBytes("baz"),
      ]);
      expect(
        writer.writeMessage({
          names: ["foo", "bar", "baz"],
        }),
      ).toEqual(buff);
    });

    it("writes fixed length arrays", () => {
      const writer1 = new MessageWriter(parseMessageDefinition("string[1] names"));
      const writer2 = new MessageWriter(parseMessageDefinition("string[2] names"));
      const writer3 = new MessageWriter(parseMessageDefinition("string[3] names"));
      expect(
        writer1.writeMessage({
          names: ["foo", "bar", "baz"],
        }),
      ).toEqual(getStringBytes("foo"));
      expect(
        writer2.writeMessage({
          names: ["foo", "bar", "baz"],
        }),
      ).toEqual(concat([getStringBytes("foo"), getStringBytes("bar")]));
      expect(
        writer3.writeMessage({
          names: ["foo", "bar", "baz"],
        }),
      ).toEqual(concat([getStringBytes("foo"), getStringBytes("bar"), getStringBytes("baz")]));
    });

    it("does not write any data for a zero length array", () => {
      const writer = new MessageWriter(parseMessageDefinition("string[] names"));
      const buff = concat([
        // variable length array has int32 as first entry
        new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      ]);

      const resultBuff = writer.writeMessage({ names: [] });
      expect(resultBuff).toEqual(buff);
    });

    describe("typed arrays", () => {
      it("writes a uint8[]", () => {
        const writer = new MessageWriter(parseMessageDefinition("uint8[] values\nuint8 after"));
        const message = { values: Uint8Array.from([1, 2, 3]), after: 4 };
        const result = writer.writeMessage(message);
        const buff = new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
        expect(result).toEqual(buff);
      });

      it("writes a uint8[] with a fixed length", () => {
        const writer = new MessageWriter(parseMessageDefinition("uint8[3] values\nuint8 after"));
        const message = { values: Uint8Array.from([1, 2, 3]), after: 4 };
        const result = writer.writeMessage(message);
        const buff = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        expect(result).toEqual(buff);
      });
    });
  });

  describe("complex types", () => {
    it("writes single complex type", () => {
      const writer = new MessageWriter(
        parseMessageDefinition("string firstName \n string lastName\nuint16 age"),
      );
      const buff = concat([
        getStringBytes("foo"),
        getStringBytes("bar"),
        new Uint8Array([0x05, 0x00]),
      ]);
      const message = {
        firstName: "foo",
        lastName: "bar",
        age: 5,
      };
      expect(writer.writeMessage(message)).toEqual(buff);
    });

    it("writes nested complex types", () => {
      const messageDefinition = `
      string username
      Account account
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      `;
      const writer = new MessageWriter(parseMessageDefinition(messageDefinition));
      const buff = concat([
        getStringBytes("foo"),
        getStringBytes("bar"),
        new Uint8Array([100, 0x00]),
      ]);
      const message = {
        username: "foo",
        account: {
          name: "bar",
          id: 100,
        },
      };
      expect(writer.writeMessage(message)).toEqual(buff);
    });

    it("writes nested complex types with arrays", () => {
      const messageDefinition = `
      string username
      Account[] accounts
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      `;
      const writer = new MessageWriter(parseMessageDefinition(messageDefinition));
      const buff = concat([
        getStringBytes("foo"), // uint32LE length of array (2)
        new Uint8Array([0x02, 0x00, 0x00, 0x00]),
        getStringBytes("bar"),
        new Uint8Array([100, 0x00]),
        getStringBytes("baz"),
        new Uint8Array([101, 0x00]),
      ]);
      const message = {
        username: "foo",
        accounts: [
          {
            name: "bar",
            id: 100,
          },
          {
            name: "baz",
            id: 101,
          },
        ],
      };
      expect(writer.writeMessage(message)).toEqual(buff);
    });

    it("writes complex type with nested arrays", () => {
      const messageDefinition = `
      string username
      Account[] accounts
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      Photo[] photos

      =======
      MSG: custom_type/Photo
      string url
      uint8 id
      `;

      const writer = new MessageWriter(parseMessageDefinition(messageDefinition));
      const buff = concat([
        getStringBytes("foo"), // uint32LE length of Account array (2)
        new Uint8Array([0x02, 0x00, 0x00, 0x00]), // name
        getStringBytes("bar"), // id
        new Uint8Array([100, 0x00]), // uint32LE length of Photo array (3)
        new Uint8Array([0x03, 0x00, 0x00, 0x00]), // photo url
        getStringBytes("http://foo.com"), // photo id
        new Uint8Array([10]), // photo url
        getStringBytes("http://bar.com"), // photo id
        new Uint8Array([12]), // photo url
        getStringBytes("http://zug.com"), // photo id
        new Uint8Array([16]), // next account
        getStringBytes("baz"),
        new Uint8Array([101, 0x00]), // uint32LE length of Photo array (0)
        new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      ]);

      const message = {
        username: "foo",
        accounts: [
          {
            name: "bar",
            id: 100,
            photos: [
              {
                url: "http://foo.com",
                id: 10,
              },
              {
                url: "http://bar.com",
                id: 12,
              },
              {
                url: "http://zug.com",
                id: 16,
              },
            ],
          },
          {
            name: "baz",
            id: 101,
            photos: [],
          },
        ],
      };

      expect(writer.writeMessage(message)).toEqual(buff);
    });

    const withBytesAndBools = `
      byte OK=0
      byte WARN=1
      byte ERROR=2
      byte STALE=3
      byte FOO = 3 # the space exists in some topics
      byte FLOAT64      = 8

      bool level\t\t# level of operation enumerated above

      DiagnosticStatus status

      ================================================================================
      MSG: diagnostic_msgs/DiagnosticStatus
      # This message holds the status of an individual component of the robot.
      #

      # Possible levels of operations
      byte OK=0
      byte WARN=1  # Comment        # FLOATING OUT HERE
      byte ERROR=2
      byte STALE=3

      byte    level # level of operation enumerated above
      string name # a description of the test/component reporting`;

    it("writes bytes and constants", () => {
      const writer = new MessageWriter(parseMessageDefinition(withBytesAndBools));
      const buff = concat([new Uint8Array([0x01]), new Uint8Array([0x00]), getStringBytes("foo")]);

      const message = {
        level: true,
        status: {
          leve: 0,
          name: "foo",
        },
      };

      expect(writer.writeMessage(message)).toEqual(buff);
    });
  });

  describe("calculateByteSize", () => {
    it("with a complex type", () => {
      const messageDefinition = `
      string username
      Account[] accounts
      ============
      MSG: custom_type/Account
      string name
      uint16 id
      bool isActive
      Photo[] photos

      =======
      MSG: custom_type/Photo
      string url
      uint8[] ids
      `;
      const message = {
        username: "foo",
        accounts: [
          {
            name: "bar",
            id: 100,
            isActive: true,
            photos: [
              {
                url: "http://foo.com",
                ids: Uint8Array.from([10, 100]),
              },
              {
                url: "http://bar.com",
                ids: Uint8Array.from([12]),
              },
              {
                url: "http://zug.com",
                ids: Uint8Array.from([]),
              },
            ],
          },
          {
            name: "baz",
            id: 101,
            isActive: false,
            photos: [],
          },
        ],
      };

      const writer = new MessageWriter(parseMessageDefinition(messageDefinition));
      expect(writer.calculateByteSize(message)).toEqual(108);
    });
  });
});
