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

import lib_es2015_collection from "typescript/lib/lib.es2015.collection.d.ts?raw";
import lib_es2015_core from "typescript/lib/lib.es2015.core.d.ts?raw";
import lib_es2015_dts from "typescript/lib/lib.es2015.d.ts?raw";
import lib_es2015_generator from "typescript/lib/lib.es2015.generator.d.ts?raw";
import lib_es2015_iterable from "typescript/lib/lib.es2015.iterable.d.ts?raw";
import lib_es2015_promise from "typescript/lib/lib.es2015.promise.d.ts?raw";
import lib_es2015_proxy from "typescript/lib/lib.es2015.proxy.d.ts?raw";
import lib_es2015_reflect from "typescript/lib/lib.es2015.reflect.d.ts?raw";
import lib_es2015_symbol from "typescript/lib/lib.es2015.symbol.d.ts?raw";
import lib_es2015_symbol_wellknown from "typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw";
import lib_es2016_array_include from "typescript/lib/lib.es2016.array.include.d.ts?raw";
import lib_es2016_dts from "typescript/lib/lib.es2016.d.ts?raw";
import lib_es2017_dts from "typescript/lib/lib.es2017.d.ts?raw";
import lib_es2017_intl from "typescript/lib/lib.es2017.intl.d.ts?raw";
import lib_es2017_object from "typescript/lib/lib.es2017.object.d.ts?raw";
import lib_es2017_sharedmemory from "typescript/lib/lib.es2017.sharedmemory.d.ts?raw";
import lib_es2017_string from "typescript/lib/lib.es2017.string.d.ts?raw";
import lib_es2017_typedarrays from "typescript/lib/lib.es2017.typedarrays.d.ts?raw";
import lib_es2018_asyncgenerator from "typescript/lib/lib.es2018.asyncgenerator.d.ts?raw";
import lib_es2018_asynciterable from "typescript/lib/lib.es2018.asynciterable.d.ts?raw";
import lib_es2018_dts from "typescript/lib/lib.es2018.d.ts?raw";
import lib_es2018_intl from "typescript/lib/lib.es2018.intl.d.ts?raw";
import lib_es2018_promise from "typescript/lib/lib.es2018.promise.d.ts?raw";
import lib_es2018_regexp from "typescript/lib/lib.es2018.regexp.d.ts?raw";
import lib_es2019_array from "typescript/lib/lib.es2019.array.d.ts?raw";
import lib_es2019_dts from "typescript/lib/lib.es2019.d.ts?raw";
import lib_es2019_object from "typescript/lib/lib.es2019.object.d.ts?raw";
import lib_es2019_string from "typescript/lib/lib.es2019.string.d.ts?raw";
import lib_es2019_symbol from "typescript/lib/lib.es2019.symbol.d.ts?raw";
import lib_es2020_bigint from "typescript/lib/lib.es2020.bigint.d.ts?raw";
import lib_es2020_dts from "typescript/lib/lib.es2020.d.ts?raw";
import lib_es2020_intl from "typescript/lib/lib.es2020.intl.d.ts?raw";
import lib_es2020_promise from "typescript/lib/lib.es2020.promise.d.ts?raw";
import lib_es2020_sharedmemory from "typescript/lib/lib.es2020.sharedmemory.d.ts?raw";
import lib_es2020_string from "typescript/lib/lib.es2020.string.d.ts?raw";
import lib_es2020_symbol_wellknown from "typescript/lib/lib.es2020.symbol.wellknown.d.ts?raw";
import lib_es2021_dts from "typescript/lib/lib.es2021.d.ts?raw";
import lib_es2021_intl from "typescript/lib/lib.es2021.intl.d.ts?raw";
import lib_es2021_promise from "typescript/lib/lib.es2021.promise.d.ts?raw";
import lib_es2021_string from "typescript/lib/lib.es2021.string.d.ts?raw";
import lib_es2021_weakref from "typescript/lib/lib.es2021.weakref.d.ts?raw";
import lib_es2022_array from "typescript/lib/lib.es2022.array.d.ts?raw";
import lib_es2022_dts from "typescript/lib/lib.es2022.d.ts?raw";
import lib_es2022_error from "typescript/lib/lib.es2022.error.d.ts?raw";
import lib_es2022_intl from "typescript/lib/lib.es2022.intl.d.ts?raw";
import lib_es2022_object from "typescript/lib/lib.es2022.object.d.ts?raw";
import lib_es2022_regexp from "typescript/lib/lib.es2022.regexp.d.ts?raw";
import lib_es2022_sharedmemory from "typescript/lib/lib.es2022.sharedmemory.d.ts?raw";
import lib_es2022_string from "typescript/lib/lib.es2022.string.d.ts?raw";
import lib_es5_dts from "typescript/lib/lib.es5.d.ts?raw";

export const lib_filename = "lib.d.ts";

// For users debugging in User Scripts.
const lib_logger = `
  declare type BaseTypes<T> = number | string | boolean | void | null | T;
  declare type LogArgs = { [key: string]: BaseTypes<LogArgs> | BaseTypes<LogArgs>[] };
  declare var log: (...args: Array<BaseTypes<LogArgs> | BaseTypes<LogArgs>[]>) => void;
`;

const libDts = new Map(
  Object.entries({
    es5: lib_es5_dts,
    es2015: lib_es2015_dts,
    es2016: lib_es2016_dts,
    es2017: lib_es2017_dts,
    es2018: lib_es2018_dts,
    es2019: lib_es2019_dts,
    es2020: lib_es2020_dts,
    es2021: lib_es2021_dts,
    es2022: lib_es2022_dts,

    "es2015.core": lib_es2015_core,
    "es2015.collection": lib_es2015_collection,
    "es2015.iterable": lib_es2015_iterable,
    "es2015.generator": lib_es2015_generator,
    "es2015.promise": lib_es2015_promise,
    "es2015.proxy": lib_es2015_proxy,
    "es2015.reflect": lib_es2015_reflect,
    "es2015.symbol": lib_es2015_symbol,
    "es2015.symbol.wellknown": lib_es2015_symbol_wellknown,
    "es2016.array.include": lib_es2016_array_include,
    "es2017.object": lib_es2017_object,
    "es2017.sharedmemory": lib_es2017_sharedmemory,
    "es2017.string": lib_es2017_string,
    "es2017.intl": lib_es2017_intl,
    "es2017.typedarrays": lib_es2017_typedarrays,
    "es2018.asynciterable": lib_es2018_asynciterable,
    "es2018.asyncgenerator": lib_es2018_asyncgenerator,
    "es2018.promise": lib_es2018_promise,
    "es2018.regexp": lib_es2018_regexp,
    "es2018.intl": lib_es2018_intl,
    "es2019.array": lib_es2019_array,
    "es2019.object": lib_es2019_object,
    "es2019.string": lib_es2019_string,
    "es2019.symbol": lib_es2019_symbol,
    "es2020.bigint": lib_es2020_bigint,
    "es2020.promise": lib_es2020_promise,
    "es2020.sharedmemory": lib_es2020_sharedmemory,
    "es2020.string": lib_es2020_string,
    "es2020.symbol.wellknown": lib_es2020_symbol_wellknown,
    "es2020.intl": lib_es2020_intl,
    "es2021.intl": lib_es2021_intl,
    "es2021.promise": lib_es2021_promise,
    "es2021.string": lib_es2021_string,
    "es2021.weakref": lib_es2021_weakref,
    "es2022.array": lib_es2022_array,
    "es2022.error": lib_es2022_error,
    "es2022.intl": lib_es2022_intl,
    "es2022.object": lib_es2022_object,
    "es2022.regexp": lib_es2022_regexp,
    "es2022.sharedmemory": lib_es2022_sharedmemory,
    "es2022.string": lib_es2022_string,
  }),
);

/**
 * Each top-level type definition file (such as lib.es2022.d.ts) is a lightweight wrapper that
 * references other .d.ts files. To produce the complete definitions we manually resolve these
 * references.
 */
function resolveReferences(originalSrc: string): string {
  return originalSrc.replace(/\/\/\/ <reference lib="(.+)" \/>/g, (_, name: string) => {
    const src = libDts.get(name);
    // remove entry so we don't try to load it again if it appears in another referenced file
    libDts.delete(name);

    // if we couldn't find the referenced library or have already inserted it ignore
    if (src == undefined) {
      return "";
    }

    return resolveReferences(src);
  });
}

const resolvedDts = resolveReferences(lib_es2022_dts);
export const lib_dts = `${resolvedDts}\n\n${lib_logger}`;
