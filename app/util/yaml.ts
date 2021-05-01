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

import yaml from "js-yaml";

export default {
  parse: <T>(str: string): T => {
    // @ts-expect-error assuming that yaml.load will load type T is sloppy
    // There should be checking on the result with a schema to ensure object is actually T
    return yaml.load(str);
  },
  stringify: (obj: unknown, options: yaml.DumpOptions = {}): string => {
    // do not quote 'y' and 'yes' for older yaml versions
    return yaml
      .dump(obj, { noCompatMode: true, ...options })
      .replace(/^- - /gm, "\n- - ")
      .trim();
  },
};
