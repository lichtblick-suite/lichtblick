// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// micro-memoize ships with type definitions, but they reference the internal sources, which fail to
// typecheck because of our strict tsconfig settings.
declare module "micro-memoize" {
  export default function microMemoize<T>(
    fn: T,
    options?: {
      isEqual?: (object1: unknown, object2: unknown) => boolean;
      isPromise?: boolean;
      maxSize?: number;
    },
  ): T & {
    cache: {
      keys: unknown[];
      values: unknown[];
    };
  };
}
