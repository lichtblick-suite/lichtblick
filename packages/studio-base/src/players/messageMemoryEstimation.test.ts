// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  estimateMessageObjectSize,
  estimateMessageFieldSizes,
  OBJECT_BASE_SIZE,
} from "./messageMemoryEstimation";

describe("memoryEstimation", () => {
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
