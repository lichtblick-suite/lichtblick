// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { TextDecoder } from "util";

import { parse as parseMessageDefinition } from "@foxglove/rosmsg";

import { LazyMessageReader } from "./LazyMessageReader";

// Jest runs in a node environment, TextDecoder is not available globally.
// We provide TextDecoder from the util module.
(global as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

const serializeString = (str: string): Uint8Array => {
  const data = Buffer.from(str, "utf8");
  const len = Buffer.alloc(4);
  len.writeInt32LE(data.byteLength, 0);
  return Uint8Array.from([...len, ...data]);
};

const float32Buffer = (floats: number[]): Uint8Array => {
  return new Uint8Array(Float32Array.from(floats).buffer);
};

describe("LazyReader", () => {
  it.each([
    [`int8 sample # lowest`, [0x80], { sample: -128 }],
    [`int8 sample # highest`, [0x7f], { sample: 127 }],
    [`uint8 sample # lowest`, [0x00], { sample: 0 }],
    [`uint8 sample # highest`, [0xff], { sample: 255 }],
    [`int16 sample # lowest`, [0x00, 0x80], { sample: -32768 }],
    [`int16 sample # highest`, [0xff, 0x7f], { sample: 32767 }],
    [`uint16 sample # lowest`, [0x00, 0x00], { sample: 0 }],
    [`uint16 sample # highest`, [0xff, 0xff], { sample: 65535 }],
    [`int32 sample # lowest`, [0x00, 0x00, 0x00, 0x80], { sample: -2147483648 }],
    [`int32 sample # highest`, [0xff, 0xff, 0xff, 0x7f], { sample: 2147483647 }],
    [`uint32 sample # lowest`, [0x00, 0x00, 0x00, 0x00], { sample: 0 }],
    [`uint32 sample # highest`, [0xff, 0xff, 0xff, 0xff], { sample: 4294967295 }],
    [
      `int64 sample # lowest`,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80],
      { sample: -9223372036854775808n },
    ],
    [
      `int64 sample # highest`,
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f],
      { sample: 9223372036854775807n },
    ],
    [`uint64 sample # lowest`, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], { sample: 0n }],
    [
      `uint64 sample # highest`,
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      { sample: 18446744073709551615n },
    ],
    [`float32 sample`, float32Buffer([5.5]), { sample: 5.5 }],
    [
      `float64 sample`,
      new Uint8Array(Float64Array.of(0.123456789121212121212).buffer),
      { sample: 0.123456789121212121212 },
    ],
    [
      `time stamp`,
      [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
      {
        stamp: {
          sec: 0,
          nsec: 1,
        },
      },
    ],
    [
      `duration stamp`,
      [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
      {
        stamp: {
          sec: 0,
          nsec: 1,
        },
      },
    ],
    [
      `int32[] arr`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...new Uint8Array(Int32Array.of(3, 7).buffer),
      ],
      { arr: Int32Array.from([3, 7]) },
    ],
    [
      `time[1] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
      { arr: [{ sec: 1, nsec: 2 }] },
    ],
    [
      `duration[1] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
      { arr: [{ sec: 1, nsec: 2 }] },
    ],
    [
      `time[] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      { arr: [{ sec: 2, nsec: 3 }] },
    ],
    [
      `duration[] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      { arr: [{ sec: 2, nsec: 3 }] },
    ],
    // unaligned access
    [
      `uint8 blank\nint32[] arr`,
      [
        0x00,
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...new Uint8Array(Int32Array.of(3, 7).buffer),
      ],
      { blank: 0, arr: Int32Array.from([3, 7]) },
    ],
    [
      `uint8 blank\ntime[] arr`,
      [0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      { blank: 0, arr: [{ sec: 2, nsec: 3 }] },
    ],
    [`float32[2] arr`, float32Buffer([5.5, 6.5]), { arr: Float32Array.from([5.5, 6.5]) }],
    [
      `uint8 blank\nfloat32[2] arr`,
      [0x00, ...float32Buffer([5.5, 6.5])],
      { blank: 0, arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `float32[] arr`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
      ],
      { arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `uint8 blank\nfloat32[] arr`,
      [0x00, ...[0x02, 0x00, 0x00, 0x00], ...float32Buffer([5.5, 6.5])],
      { blank: 0, arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `float32[] first\nfloat32[] second`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
      ],
      {
        first: Float32Array.from([5.5, 6.5]),
        second: Float32Array.from([5.5, 6.5]),
      },
    ],
    [`string sample # empty string`, serializeString(""), { sample: "" }],
    [`string sample # some string`, serializeString("some string"), { sample: "some string" }],
    [`int8[4] first`, [0x00, 0xff, 0x80, 0x7f], { first: new Int8Array([0, -1, -128, 127]) }],
    [
      `int8[] first`,
      [
        ...[0x04, 0x00, 0x00, 0x00], // length
        0x00,
        0xff,
        0x80,
        0x7f,
      ],
      { first: new Int8Array([0, -1, -128, 127]) },
    ],
    [`uint8[4] first`, [0x00, 0xff, 0x80, 0x7f], { first: new Uint8Array([0, -1, -128, 127]) }],
    [
      `string[2] first`,
      [...serializeString("one"), ...serializeString("longer string")],
      { first: ["one", "longer string"] },
    ],
    [
      `string[] first`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...serializeString("one"),
        ...serializeString("longer string"),
      ],
      { first: ["one", "longer string"] },
    ],
    // first size value after fixed size value
    [`int8 first\nint8 second`, [0x80, 0x7f], { first: -128, second: 127 }],
    [
      `string first\nint8 second`,
      [...serializeString("some string"), 0x80],
      { first: "some string", second: -128 },
    ],
    [
      `CustomType custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [0x02],
      {
        custom: { first: 0x02 },
      },
    ],
    [
      `CustomType[3] custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [0x02, 0x03, 0x04],
      {
        custom: [{ first: 0x02 }, { first: 0x03 }, { first: 0x04 }],
      },
    ],
    [
      `CustomType[] custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [
        ...[0x03, 0x00, 0x00, 0x00], // length
        0x02,
        0x03,
        0x04,
      ],
      {
        custom: [{ first: 0x02 }, { first: 0x03 }, { first: 0x04 }],
      },
    ],
    // ignore constants
    [
      `int8 STATUS_ONE = 1
       int8 STATUS_TWO = 2
       int8 status`,
      [0x02],
      { status: 2 },
    ],
    // An array of custom types which themselves have a custom type
    // This tests an array's ability to properly size custom types
    [
      `CustomType[] custom
    ============
    MSG: custom_type/CustomType
    MoreCustom another
    ============
    MSG: custom_type/MoreCustom
    uint8 field`,
      [
        ...[0x03, 0x00, 0x00, 0x00], // length
        0x02,
        0x03,
        0x04,
      ],
      {
        custom: [
          { another: { field: 0x02 } },
          { another: { field: 0x03 } },
          { another: { field: 0x04 } },
        ],
      },
    ],
  ])(
    "should deserialize %s",
    (msgDef: string, arr: Iterable<number>, expected: Record<string, unknown>) => {
      const buffer = Uint8Array.from(arr);
      const reader = new LazyMessageReader(parseMessageDefinition(msgDef));
      const read = reader.readMessage(buffer);

      // check that our reader expected size matches the buffer size
      expect(reader.size(buffer)).toEqual(buffer.length);

      // allows for easier review of the generated parser source
      expect(reader.source()).toMatchSnapshot(msgDef);

      // check that our message matches the object
      expect(read.toJSON()).toMatchObject(expected);
    },
  );
});
