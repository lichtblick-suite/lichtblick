// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { TypedData, ObjectData } from "./types";

export type Point = { index: number; x: number; y: number; label: string | undefined };

// Get the length of a typed dataset.
export function getTypedLength(data: TypedData[]): number {
  return R.pipe(
    R.map((v: TypedData) => v.x.length),
    R.sum,
  )(data);
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
  for (let i = 0; i < dataset.length; i++) {
    const slice = dataset[i];
    if (slice == undefined) {
      continue;
    }

    // Find a property for which we can check the length
    const first = R.head(R.values(slice));
    if (first == undefined) {
      continue;
    }

    for (let j = 0; j < first.length; j++) {
      for (const key of R.keys(slice)) {
        point[key] = slice[key]?.[j];
      }

      point.index = index;
      index++;
      yield point;
    }
  }
}

/**
 * Given a dataset and an index inside of that dataset, return the index of the
 * slice and offset inside of that slice.
 */
export function findIndices(
  dataset: TypedData[],
  index: number,
): [slice: number, offset: number] | undefined {
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
