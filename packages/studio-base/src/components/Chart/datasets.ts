// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import * as R from "ramda";

import { TypedData, ObjectData } from "./types";

export type Point = { index: number; x: number; y: number; label: string | undefined };

const sumTypedDataLength = (prev: number, arr: TypedData) => prev + arr.x.length;

// Get the length of a typed dataset.
export function getTypedLength(data: TypedData[]): number {
  return data.reduce(sumTypedDataLength, 0);
}

/**
 * iterateObjects iterates over ObjectData, yielding a `Point` for each entry.
 */
export function* iterateObjects(dataset: ObjectData): Generator<Point> {
  let index = 0;
  for (const datum of dataset) {
    if (datum == undefined) {
      index++;
      continue;
    }

    const { x, y, label } = datum;
    yield {
      index,
      x,
      y,
      label,
    };
    index++;
  }
}

/**
 * ExtractPoint maps an object type with array properties to one with the
 * arrays replaced by their element type. For example:
 * type Foo = {
 *   foo: Float32Array;
 *   bar: number[];
 *   baz: string[];
 * }
 * would be mapped to:
 * ExtractPoint<Foo> == {
 *   foo: number;
 *   bar: number;
 *   baz: string;
 * }
 * It is used to go from `TypedData`'s various incarnations to what a single
 * point would look like as a `Datum`.
 *
 * These `any`s do not introduce anything unsafe; they are necessary for
 * specifying the type (which is ultimately type-checked at point of use.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtractPoint<T extends { [key: string]: Array<any> | Float32Array }> = {
  [P in keyof T]-?: NonNullable<T[P]>[0];
} & {
  index: number;
  // downsampling requires a label, so even if T does not have a `label` property, we still
  // include one
  label: string | undefined;
};

/**
 *   Iterate over a typed dataset one point at a time. This abstraction is
 *   necessary because the Plot panel extends TypedData with more fields; we
 *   still want those to be available while iterating.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* iterateTyped<T extends { [key: string]: Array<any> | Float32Array }>(
  dataset: T[],
): Generator<ExtractPoint<T>> {
  const point: ExtractPoint<T> = {
    index: 0,
    label: undefined,
  } as ExtractPoint<T>;

  let index = 0;
  for (const slice of dataset) {
    // Find a property for which we can check the length
    const first = R.head(Object.values(slice));
    if (first == undefined) {
      continue;
    }

    for (let j = 0; j < first.length; j++) {
      for (const key of Object.keys(slice) as (keyof typeof slice)[]) {
        point[key] = slice[key]?.[j];
      }

      point.index = index;
      index++;
      yield point;
    }
  }
}

export type Indices = [slice: number, offset: number];
/**
 * Given a dataset and an index inside of that dataset, return the index of the
 * slice and offset inside of that slice.
 */
export function findIndices(dataset: TypedData[], index: number): Indices | undefined {
  let offset = index;
  for (let i = 0; i < dataset.length; i++) {
    const slice = dataset[i];
    if (slice == undefined) {
      continue;
    }

    const {
      x: { length: numElements },
    } = slice;

    if (offset === numElements && i === dataset.length - 1) {
      return [i, offset];
    }

    if (offset >= numElements) {
      offset -= numElements;
      continue;
    }

    return [i, offset];
  }

  return undefined;
}

/**
 * fastFindIndices returns a faster version of findIndices in exchange for
 * doing some compute ahead of time.
 *
 * The "calculations ahead of time" refers to calculating the offsets of all of
 * the slices--in other words, the mapping from an index in the (conceptual)
 * list to the slice it falls into. Doing this ahead of time allows us to use
 * binary search to look up the slice and offset inside of that slice for a
 * given point; since the number of points is accumulative, we can't do this
 * efficiently when we're starting from nothing. In addition, we're also able
 * to "cache" the next offset to make reads of sequential points much faster.
 *
 * You use this in lieu of the slow version when you know you're about to do a
 * lot of reads from a dataset, such as when downsampling.
 */
export const fastFindIndices = (dataset: TypedData[]): ((index: number) => Indices | undefined) => {
  // Calculate the first index of each slice in `dataset`.
  // For example, with two slices of 10 points each, this produces:
  // [0, 10]
  // In other words, the second slice begins at point index=10.
  const sliceOffsets: number[] = R.pipe(
    R.map(({ x: { length } }: TypedData) => length),
    R.reduce(
      (lengths: number[], length: number): number[] => [
        ...lengths,
        (R.last(lengths) ?? 0) + length,
      ],
      [],
    ),
    // remove the last one (can't resolve to greater than end of dataset)
    (offsets) => offsets.slice(0, -1),
  )(dataset);

  // Given the index of a point, use binary search to find its slice and offset
  // inside of that slice.
  const getBinary = (index: number): Indices | undefined => {
    const slice = _.sortedIndex(sliceOffsets, index);
    if (slice === dataset.length) {
      return undefined;
    }

    if (sliceOffsets[slice] === index) {
      return [slice + 1, 0];
    }

    return [slice, index - (sliceOffsets[slice - 1] ?? 0)];
  };

  // Keep track of the last point this lookup returned. If the caller is just
  // getting the next index in the sequence, we do not need to do any more
  // expensive lookups.
  let lastPoint: [index: number, location: Indices] = [0, [0, 0]];
  return (offset: number): Indices | undefined => {
    const [lastOffset, lastIndices] = lastPoint;
    if (offset - 1 === lastOffset) {
      const [slice, sliceOffset] = lastIndices;
      const sliceLength = sliceOffsets[slice];
      if (sliceLength != undefined && offset + 1 < sliceLength) {
        const result: Indices = [slice, sliceOffset + 1];
        lastPoint = [offset, result];
        return result;
      }
    }

    // Fall back to binary search if that optimization did not work
    const result = getBinary(offset);
    if (result == undefined) {
      return undefined;
    }

    lastPoint = [offset, result];
    return result;
  };
};
