// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { throttle } from "lodash";

const DELAY = 1000;

/* eslint-disable no-restricted-syntax */
const warn = throttle((...args: unknown[]) => console.warn(...args), DELAY);
const error = throttle((...args: unknown[]) => console.error(...args), DELAY);
const info = throttle((...args: unknown[]) => console.info(...args), DELAY);
const debug = throttle((...args: unknown[]) => console.log(...args), DELAY);

export default {
  debug,
  info,
  warn,
  error,
};
