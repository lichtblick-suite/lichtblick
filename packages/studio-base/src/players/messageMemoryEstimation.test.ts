// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  estimateMessageObjectSize,
  estimateMessageFieldSizes,
  OBJECT_BASE_SIZE,
  estimateObjectSize,
} from "./messageMemoryEstimation";

describe("memoryEstimationBySchema", () => {
  it("size for empty schema is greater than 0", () => {
    const sizeInBytes = estimateMessageObjectSize(new Map(), "", new Map());
    expect(sizeInBytes).toBeGreaterThan(0);
  });

  it("throws an error for an unknown type", () => {
    expect(() =>
      estimateMessageObjectSize(new Map([["foo", { definitions: [] }]]), "UnknownType", new Map()),
    ).toThrow("Type 'UnknownType' not found in definitions");
  });

  it("handles complex types with arrays of unknown primitive type", () => {
    const datatypes = new Map([
      [
        "ComplexType",
        {
          definitions: [{ type: "unknownType", name: "field1", isArray: true, arrayLength: 2 }],
        },
      ],
    ]);

    expect(() => estimateMessageObjectSize(datatypes, "ComplexType", new Map())).toThrow(
      "Unknown primitive type unknownType",
    );
  });

  it("size for a complex schema is calculated correctly", () => {
    const datatypes = new Map([
      [
        "ComplexType",
        {
          definitions: [
            { type: "int32", name: "field1" },
            { type: "bool", name: "field2" },
          ],
        },
      ],
    ]);

    const sizeInBytes = estimateMessageObjectSize(datatypes, "ComplexType", new Map());
    const expectedSize = 20; // 3 x pointers + 1 x 4 byte smi + 1 x pointer to boolean
    expect(Math.abs(expectedSize - sizeInBytes)).toBeLessThan(10);
  });

  it("handles complex types with arrays", () => {
    const datatypes = new Map([
      [
        "ComplexType",
        {
          definitions: [
            { type: "int32", name: "field1" },
            { type: "float64", name: "field2" },
            { type: "bool", name: "field3", isArray: true, arrayLength: 10 },
          ],
        },
      ],
    ]);

    const sizeInBytes = estimateMessageObjectSize(datatypes, "ComplexType", new Map());
    const expectedSize = 90;
    expect(Math.abs(expectedSize - sizeInBytes)).toBeLessThan(10);
  });

  it.each([
    { numFloats: 2, numInts: 2, measuredSize: 52, tolerancePercent: 5 },
    { numFloats: 10, numInts: 10, measuredSize: 212, tolerancePercent: 5 },
    { numFloats: 10, numInts: 10, measuredSize: 212, tolerancePercent: 5 },
    { numFloats: 50, numInts: 50, measuredSize: 1012, tolerancePercent: 5 },
    { numFloats: 100, numInts: 100, measuredSize: 2012, tolerancePercent: 5 },
    { numFloats: 200, numInts: 200, measuredSize: 4028, tolerancePercent: 5 },
    { numFloats: 400, numInts: 400, measuredSize: 8024, tolerancePercent: 5 },
    { numFloats: 550, numInts: 550, measuredSize: 31220, tolerancePercent: 5 },
    { numFloats: 1000, numInts: 1000, measuredSize: 61196, tolerancePercent: 5 },
    { numFloats: 2000, numInts: 2000, measuredSize: 122348, tolerancePercent: 5 },
  ])(
    "matches the size of objects with int + double fields measured with chrome devtools",
    ({ numFloats, numInts, measuredSize, tolerancePercent }) => {
      const datatypes = new Map([
        [
          "SomeType",
          {
            definitions: [
              ...new Array(numInts).fill({ type: "int16", name: "field" }),
              ...new Array(numFloats).fill({ type: "float64", name: "field" }),
            ],
          },
        ],
      ]);
      const sizeInBytes = estimateMessageObjectSize(datatypes, "SomeType", new Map());
      expect(Math.abs(sizeInBytes - measuredSize)).toBeLessThanOrEqual(
        measuredSize * (tolerancePercent / 100),
      );
    },
  );

  it("sum of field sizes matches total object size", () => {
    const datatypes = new Map([
      [
        "ComplexType",
        {
          definitions: [
            { type: "int32", name: "field1" },
            { type: "bool", name: "field2" },
          ],
        },
      ],
    ]);

    const fieldSizes = estimateMessageFieldSizes(datatypes, "ComplexType", new Map());
    const msgSizeInBytes = estimateMessageObjectSize(datatypes, "ComplexType", new Map());
    const fieldSizesSum = Object.values(fieldSizes).reduce(
      (acc, fieldSize) => acc + fieldSize,
      OBJECT_BASE_SIZE,
    );
    expect(fieldSizesSum).toEqual(msgSizeInBytes);
  });
});

describe("memoryEstimationByObject", () => {
  it("estimates the size of an empty object to be greater than 0", () => {
    const sizeInBytes = estimateObjectSize({});
    expect(sizeInBytes).toBeGreaterThan(0);
  });

  it("estimates size of null object to be greater than 0", () => {
    // eslint-disable-next-line no-restricted-syntax
    const sizeInBytes = estimateObjectSize(null);
    expect(sizeInBytes).toBeGreaterThan(0);
  });

  it("estimates size of undefined object to be greater than 0", () => {
    const sizeInBytes = estimateObjectSize(undefined);
    expect(sizeInBytes).toBeGreaterThan(0);
  });

  it("correctly estimates the size for a simple object", () => {
    const sizeInBytes = estimateObjectSize({
      field1: 1, // 4 bytes, SMI (fits in pointer)
      field2: true, // 4 bytes, pointer to "true" Oddball
      field3: 1.23, // 16 bytes, 4 bytes pointer to 12 byte heap number
    });
    const expectedSize = 36; // 12 (base size) + 4 (smi) + 4 (boolean) + 16 (heap number)
    expect(sizeInBytes).toEqual(expectedSize);
  });

  it("correctly estimates the size of an object with an array", () => {
    const sizeInBytes = estimateObjectSize({
      field1: [1, 2, 3, 4, 5, 6], // 52 bytes, 4 byte pointer to 48 byte array object (24 byte header + 6 * 4 (SMI)
      field2: true, // 4 bytes, pointer to "true" Oddball
      field3: 1.23, // 16 bytes, 4 bytes pointer to 12 byte heap number
    });

    const expectedSize = 84; // 12 (base size) + 52 (array) + 4 (boolean) + 16 (heap number)
    expect(sizeInBytes).toEqual(expectedSize);
  });

  it("correctly estimates the size of an object with a string", () => {
    const sizeInBytes = estimateObjectSize({
      n: 1, // 4 bytes, SMI (fits in pointer)
      str: "abcdef", // 24 bytes, 4 byte pointer to 20 byte string object (12 byte header and 8 bytes content)
    });
    const expectedSize = 40; // 12 (base size) + 4 (smi) + 24 (string)
    expect(sizeInBytes).toEqual(expectedSize);
  });

  it("correctly estimates the size of an object with an array of objects", () => {
    const obj = new Array(20).fill(0).map((_, i) => ({
      n: i, // 4 bytes, SMI (fits in pointer)
      str: `${i}`.padStart(9, "_"), // 24 bytes, 4 byte pointer to 24 byte string object (12 byte header and 12 bytes content)
    }));
    const sizeInBytes = estimateObjectSize({ obj });
    const expectedSize = 920; // 12 + 4 (pointer to array) + 24 (array header) + 20 * 44 (array content)
    expect(sizeInBytes).toEqual(expectedSize);
  });
});
