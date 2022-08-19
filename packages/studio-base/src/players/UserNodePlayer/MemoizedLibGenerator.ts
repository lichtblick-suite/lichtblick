// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@foxglove/studio";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type Args = { topics: Topic[]; datatypes: RosDatatypes };
type LibGeneratorFn = (args: Args) => Promise<string>;

/**
 * LibGenerator memoizes generating a library from topics and datatypes.
 *
 * Calling `update` returns a boolean to indicate if the library was re-generated and the
 * library source code.
 *
 * If the args to update are unchanged (same topics and datatyes), then the previously
 * generated value from `fn` is returned.
 */
class MemoizedLibGenerator {
  private datatypes?: RosDatatypes;
  private topics?: Topic[];
  private fn: LibGeneratorFn;
  private cached?: string;

  public constructor(fn: LibGeneratorFn) {
    this.fn = fn;
  }

  /**
   * Update the library with new args.
   * If the arg fields have changed, the generator function is run to make a new library.
   *
   * Return whether the cached value was updated and the cached value.
   */
  public async update(args: Args): Promise<{ didUpdate: boolean; lib: string }> {
    if (
      args.topics === this.topics &&
      args.datatypes === this.datatypes &&
      this.cached != undefined
    ) {
      return { didUpdate: false, lib: this.cached };
    }

    const lib = await this.fn(args);
    this.topics = args.topics;
    this.datatypes = args.datatypes;
    this.cached = lib;
    return { didUpdate: true, lib };
  }
}

export { MemoizedLibGenerator };
